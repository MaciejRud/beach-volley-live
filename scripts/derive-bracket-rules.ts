import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { RequestBuilder } from "../src/lib/fivb/requestBuilder";
import { ResponseParser } from "../src/lib/fivb/responseParser";
import { Match, Tournament } from "../src/lib/fivb/types";
import { parseSignature, resolveRules } from "../src/lib/fivb/bracket";

/**
 * Recovers how a bracket is wired -- which match feeds which slot -- by
 * replaying finished tournaments, and writes the result to
 * src/lib/fivb/bracketRules.json.
 *
 * The feed carries no bracket topology: TeamAText and TeamBText, the fields
 * that would say "Winner of match 12", are empty on every match of every
 * tournament checked, and GetBeachRound / GetBeachRoundList answer
 * NotInNewFormat. What a finished tournament does show is where each team came
 * from, so the wiring can be read backwards from the results.
 *
 * Rules are kept per format and only where they are unanimous. Two formats in
 * the sample wire their semi-finals differently, and one wires them
 * inconsistently between its own tournaments -- a single global rule would be
 * wrong for those, and a wrong name on a final is worse than "TBD".
 *
 * Re-run when the tours change their draw formats:
 *   npx tsx scripts/derive-bracket-rules.ts [--seasons 2024,2025,2026] [--limit N]
 */

const API_URL = "https://www.fivb.org/vis2009/XmlRequest.asmx";
const TIMEOUT_MS = 30000;
const USER_AGENT = "beach-volley-live/1.0 (bracket rule derivation)";
const OUTPUT = "src/lib/fivb/bracketRules.json";

/** Tournament status codes that mean "played to the end". */
const FINISHED_STATUS = new Set([7, 8, 9]);

/**
 * A format needs this many finished tournaments before its rules are trusted.
 * With one or two, "every tournament agreed" says nothing -- there was nothing
 * to disagree with.
 */
const MIN_OBSERVATIONS = 3;

/**
 * How often a slot must actually trace back into the bracket before it counts
 * as bracket-fed.
 *
 * A slot fed from the pools is untraceable by design and gets no rule. But a
 * genuinely bracket-fed slot also comes back untraceable now and then -- a
 * walkover leaves the feeding match without a result -- and over hundreds of
 * tournaments those stragglers would sink every rule if untraceable counted
 * as disagreement. Requiring a large majority separates the two: the rule is
 * kept when the slot is normally bracket-fed, dropped when it usually is not.
 */
const MIN_TRACEABLE_SHARE = 0.9;

const POOL = /^P[A-Z]$/;

interface Options {
  seasons: number[];
  limit?: number;
  /** Replay cache, so the matching criterion can be tuned without refetching. */
  cache?: string;
}

function parseArgs(argv: string[]): Options {
  const currentSeason = new Date().getFullYear();
  const opts: Options = { seasons: [currentSeason - 1, currentSeason] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--seasons") opts.seasons = argv[++i].split(",").map(Number);
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--cache") opts.cache = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

async function request(xml: string, label: string): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", "User-Agent": USER_AGENT },
    body: xml,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} ${res.statusText}`);
  return res.text();
}

function normalizeCode(code: string): string {
  return code.replace("/", "-");
}

/** Main-draw elimination rounds, each sorted the way the runtime sorts them. */
function bracketRounds(matches: Match[]): Map<string, Match[]> {
  const rounds = new Map<string, Match[]>();

  for (const m of matches) {
    if (m.roundPhase !== "4") continue;
    const code = normalizeCode(m.roundCode ?? "");
    if (!code || POOL.test(code)) continue;
    const bucket = rounds.get(code);
    if (bucket) bucket.push(m);
    else rounds.set(code, [m]);
  }

  for (const bucket of rounds.values()) {
    bucket.sort((a, b) => Number(a.matchNumber || 0) - Number(b.matchNumber || 0));
  }

  return rounds;
}

function signatureOf(rounds: Map<string, Match[]>): string {
  return Array.from(rounds.entries())
    .map(([code, items]) => `${code}:${items.length}`)
    .sort()
    .join(",");
}

/** Whether a team won or lost a match it played in. */
function outcomeFor(m: Match, teamNo: string): "W" | "L" | null {
  if (m.setsWonA === m.setsWonB) return null;
  const winner = m.setsWonA > m.setsWonB ? m.teamA.teamNo : m.teamB.teamNo;
  return teamNo === winner ? "W" : "L";
}

/**
 * Where each side of each bracket match came from, as slot -> source.
 *
 * A side is traced to the last match that team played before this one. When
 * that match is a pool match, or there is none, the side entered the bracket
 * from outside it and is recorded as unusable rather than as a rule.
 */
function deriveSlots(matches: Match[]): Map<string, string> {
  const rounds = bracketRounds(matches);
  const played = matches
    .filter((m) => m.roundPhase === "4" && m.fixtureState === "drawn")
    .sort((a, b) => Number(a.matchNumber || 0) - Number(b.matchNumber || 0));

  const indexOf = new Map<string, number>();
  for (const [code, items] of rounds) {
    items.forEach((m, i) => indexOf.set(`${code}#${m.no}`, i));
  }

  const slots = new Map<string, string>();

  for (const [code, items] of rounds) {
    for (let index = 0; index < items.length; index++) {
      const target = items[index];
      if (target.fixtureState !== "drawn") continue;
      const targetNumber = Number(target.matchNumber || 0);

      for (const side of ["A", "B"] as const) {
        const teamNo = (side === "A" ? target.teamA : target.teamB).teamNo;
        if (!teamNo) continue;

        const earlier = played.filter(
          (p) =>
            Number(p.matchNumber || 0) < targetNumber &&
            (p.teamA.teamNo === teamNo || p.teamB.teamNo === teamNo)
        );
        const source = earlier[earlier.length - 1];
        const key = `${code}#${index}${side}`;

        if (!source) {
          slots.set(key, "(entry)");
          continue;
        }

        const sourceCode = normalizeCode(source.roundCode ?? "");
        if (!sourceCode || POOL.test(sourceCode)) {
          slots.set(key, "(pool)");
          continue;
        }

        const outcome = outcomeFor(source, teamNo);
        const sourceIndex = indexOf.get(`${sourceCode}#${source.no}`);
        if (!outcome || sourceIndex === undefined) {
          slots.set(key, "(unknown)");
          continue;
        }

        slots.set(key, `${sourceCode}#${sourceIndex}${outcome}`);
      }
    }
  }

  return slots;
}

async function collectTournaments(opts: Options): Promise<Tournament[]> {
  const found: Tournament[] = [];
  for (const season of opts.seasons) {
    const xml = await request(RequestBuilder.getTournamentList(season), `season ${season}`);
    for (const t of ResponseParser.parseTournaments(xml)) {
      if (!FINISHED_STATUS.has(t.statusCode)) continue;
      if (t.type === "Test" || t.title.toLowerCase().includes("test")) continue;
      found.push(t);
    }
    console.log(`  season ${season}: ${found.length} finished so far`);
  }
  return opts.limit ? found.slice(0, opts.limit) : found;
}

/** One replayed tournament, reduced to what rule derivation needs. */
interface Replay {
  code: string;
  season: number;
  signature: string;
  slots: Map<string, string>;
}

type Formats = Record<string, { slots: Record<string, string>; observations: number }>;

function deriveFormats(replays: Replay[]): { formats: Formats; dropped: number } {
  const observed = new Map<string, Map<string, Map<string, number>>>();
  const perFormat = new Map<string, number>();

  for (const replay of replays) {
    perFormat.set(replay.signature, (perFormat.get(replay.signature) ?? 0) + 1);
    const forFormat = observed.get(replay.signature) ?? new Map<string, Map<string, number>>();
    for (const [slot, source] of replay.slots) {
      const counts = forFormat.get(slot) ?? new Map<string, number>();
      counts.set(source, (counts.get(source) ?? 0) + 1);
      forFormat.set(slot, counts);
    }
    observed.set(replay.signature, forFormat);
  }

  const formats: Formats = {};
  let dropped = 0;

  for (const [signature, slotMap] of observed) {
    const observations = perFormat.get(signature) ?? 0;
    if (observations < MIN_OBSERVATIONS) continue;

    const slots: Record<string, string> = {};
    for (const [slot, counts] of slotMap) {
      const traced = Array.from(counts.entries()).filter(([source]) => !source.startsWith("("));
      const tracedTotal = traced.reduce((sum, [, hits]) => sum + hits, 0);

      if (traced.length === 0) continue;
      if (tracedTotal < MIN_OBSERVATIONS) continue;
      if (tracedTotal / observations < MIN_TRACEABLE_SHARE) continue;

      // Every tournament that traced this slot has to have traced it to the
      // same match. One dissenter means the format wires it more than one way
      // and no name can be put on it.
      if (traced.length > 1) {
        dropped++;
        continue;
      }

      slots[slot] = traced[0][0];
    }

    if (Object.keys(slots).length > 0) formats[signature] = { slots, observations };
  }

  return { formats, dropped };
}

/**
 * Replays a set of tournaments against rules derived from a different set, and
 * counts how often the rule named the match the tournament actually used.
 *
 * Slots the holdout could not trace are skipped rather than counted as misses:
 * a walkover says nothing about whether the wiring is right.
 */
function verify(formats: Formats, replays: Replay[]): { hits: number; misses: number; examples: string[] } {
  let hits = 0;
  let misses = 0;
  const examples: string[] = [];

  for (const replay of replays) {
    // Resolved exactly as the app resolves them, so the number below is the
    // accuracy of what ships and not of some stricter lookup.
    const applicable = resolveRules(formats, parseSignature(replay.signature));

    for (const [slot, expected] of applicable) {
      const actual = replay.slots.get(slot);
      if (!actual || actual.startsWith("(")) continue;
      if (actual === expected) hits++;
      else {
        misses++;
        if (examples.length < 8) examples.push(`${replay.code} ${slot}: rule ${expected}, actual ${actual}`);
      }
    }
  }

  return { hits, misses, examples };
}

/** The replay set, from the cache when one is present, otherwise from the API. */
async function loadReplays(opts: Options): Promise<Replay[]> {
  if (opts.cache && existsSync(opts.cache)) {
    const raw = JSON.parse(readFileSync(opts.cache, "utf-8")) as Array<
      Omit<Replay, "slots"> & { slots: Record<string, string> }
    >;
    console.log(`Loaded ${raw.length} replays from ${opts.cache}`);
    return raw.map((r) => ({ ...r, slots: new Map(Object.entries(r.slots)) }));
  }

  const replays = await replayFromApi(opts);

  if (opts.cache) {
    mkdirSync(dirname(opts.cache), { recursive: true });
    const raw = replays.map((r) => ({ ...r, slots: Object.fromEntries(r.slots) }));
    writeFileSync(opts.cache, JSON.stringify(raw), "utf-8");
    console.log(`Cached ${replays.length} replays to ${opts.cache}`);
  }

  return replays;
}

async function replayFromApi(opts: Options): Promise<Replay[]> {
  console.log(`Collecting finished tournaments for ${opts.seasons.join(", ")}...`);
  const tournaments = await collectTournaments(opts);
  console.log(`Replaying ${tournaments.length} tournaments\n`);

  const replays: Replay[] = [];

  for (const [i, t] of tournaments.entries()) {
    let matches: Match[];
    try {
      const xml = await request(RequestBuilder.getMatchList(t.no), `tournament ${t.no}`);
      matches = ResponseParser.parseMatches(xml, t);
    } catch (err) {
      console.warn(`  ${t.code}: skipped (${(err as Error).message})`);
      continue;
    }

    const rounds = bracketRounds(matches);
    if (rounds.size === 0) continue;

    const slots = deriveSlots(matches);
    if (slots.size === 0) continue;

    replays.push({
      code: t.code,
      season: Number(t.startDate.slice(0, 4)),
      signature: signatureOf(rounds),
      slots,
    });

    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${tournaments.length}...`);
  }

  return replays;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const replays = await loadReplays(opts);

  // Out-of-sample check first: rules learned from the earlier seasons have to
  // predict the newest one they have never seen. Deriving and verifying on the
  // same tournaments would prove nothing -- unanimity makes that circular.
  const holdoutSeason = Math.max(...replays.map((r) => r.season));
  const training = replays.filter((r) => r.season < holdoutSeason);
  const holdout = replays.filter((r) => r.season === holdoutSeason);

  if (training.length > 0 && holdout.length > 0) {
    const trial = deriveFormats(training);
    const result = verify(trial.formats, holdout);
    const total = result.hits + result.misses;
    const pct = total > 0 ? ((result.hits / total) * 100).toFixed(2) : "n/a";
    console.log(`\n=== Out-of-sample check ===`);
    console.log(`  trained on ${training.length} tournaments before ${holdoutSeason}`);
    console.log(`  checked against ${holdout.length} from ${holdoutSeason}`);
    console.log(`  slot predictions: ${result.hits} correct, ${result.misses} wrong (${pct}%)`);
    for (const example of result.examples) console.log(`    ${example}`);
  }

  const { formats, dropped } = deriveFormats(replays);
  const keptSlots = Object.values(formats).reduce((sum, f) => sum + Object.keys(f.slots).length, 0);

  const output = {
    generatedAt: new Date().toISOString().split("T")[0],
    sampleSize: replays.length,
    formats,
  };
  writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf-8");

  console.log(`\nReplayed ${replays.length} tournaments`);
  console.log(`Kept ${Object.keys(formats).length} formats, ${keptSlots} slots`);
  console.log(`Dropped ${dropped} slots whose source varied between tournaments`);
  console.log(`\nWrote ${OUTPUT}`);
  for (const [signature, rule] of Object.entries(formats)) {
    console.log(`  ${Object.keys(rule.slots).length.toString().padStart(3)} slots  ${rule.observations.toString().padStart(3)} events  ${signature}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

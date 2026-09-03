import { Match } from "./types";
import rules from "./bracketRules.json";

/**
 * Names the sides of a bracket match before the draw reaches it: "Winner M69"
 * in place of a bare "TBD".
 *
 * The feed does not publish the bracket's topology -- TeamAText and TeamBText,
 * which would carry exactly this, come back empty on every match of every
 * tournament checked -- so the wiring is recovered from finished tournaments
 * instead. `scripts/derive-bracket-rules.ts` replays them, reads which match
 * each team came from, and keeps a rule only where every tournament of that
 * format agreed. The result is `bracketRules.json`.
 *
 * Rules are derived per format, not globally: the same "QF#0" slot is fed by
 * the first Round of 12 winner in the Beach Pro Tour's 4-pool draw and by
 * nothing predictable in a draw that goes straight from pools to
 * quarter-finals. A format whose tournaments disagreed has no rule and keeps
 * showing TBD, which is the honest answer.
 *
 * Applying them is a two-step lookup. A draw whose exact shape has been seen
 * before uses that format and nothing else. A shape not seen before -- a tour
 * bolting a 5th-place match onto a draw that is otherwise familiar -- borrows
 * from the formats it fully contains, provided they account for most of it.
 * Both bounds are measured, not guessed: see MIN_FORMAT_COVERAGE.
 */

/** Rounds that feed the bracket from outside it; they never carry a rule. */
const POOL = /^P[A-Z]$/;

/** "C5/8" and "C5-8" are the same round; the feed uses both spellings. */
function normalizeCode(code: string): string {
  return code.replace("/", "-");
}

/** One side of a fixture, as the rules file addresses it: "SF#0A". */
type SlotKey = string;

interface RuleSet {
  /** Slot key -> source, e.g. "F1#0A" -> "SF#0W" (winner of the first semi). */
  slots: Record<SlotKey, string>;
  /** How many finished tournaments this format was derived from. */
  observations: number;
}

const RULES = rules as { formats: Record<string, RuleSet>; generatedAt: string; sampleSize: number };

const SOURCE = /^(.+)#(\d+)([WL])$/;

/**
 * How much of a draw a borrowed format has to account for before its rules
 * are trusted on that draw. Tuned against the 2026 season: at this level the
 * borrowed rules were right 5707 times out of 5707.
 */
const MIN_FORMAT_COVERAGE = 0.8;

/** "F1:1,QF:4" -> how many matches each round holds. */
export function parseSignature(signature: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const part of signature.split(",")) {
    const [code, size] = part.split(":");
    if (code) counts.set(code, Number(size));
  }
  return counts;
}

/** The inverse of parseSignature, for looking a draw up by its own shape. */
function signatureFromCounts(counts: Map<string, number>): string {
  return Array.from(counts, ([code, size]) => `${code}:${size}`)
    .sort()
    .join(",");
}

/**
 * The rules that apply to a draw with these round sizes.
 *
 * Exported so the derivation script can verify against exactly what the app
 * will apply, rather than against its own idea of a matching format.
 */
export function resolveRules(
  formats: Record<string, RuleSet>,
  counts: Map<string, number>
): Map<string, string> {
  // A draw that has been seen before answers for itself. Borrowing anything
  // from another format on top of it only introduces error: measured against
  // the 2026 season, the exact format alone was right 5613 times out of 5613.
  const exact = formats[signatureFromCounts(counts)];
  if (exact) return new Map(Object.entries(exact.slots));

  const resolved = new Map<string, string>();
  const conflicted = new Set<string>();

  for (const [signature, rule] of Object.entries(formats)) {
    const learnt = parseSignature(signature);

    // Every round the format knows has to be here at the same size. A draw
    // that merely shares its quarter-finals is a different draw.
    if (![...learnt].every(([code, size]) => counts.get(code) === size)) continue;

    // And it has to account for most of this draw. A fragment that matches
    // only a corner of a larger bracket says nothing about how that bracket
    // is wired: relaxing this to any subset put 113 slot names wrong across
    // 40 tournaments, where the threshold leaves none.
    if (learnt.size / counts.size < MIN_FORMAT_COVERAGE) continue;

    for (const [slot, source] of Object.entries(rule.slots)) {
      const existing = resolved.get(slot);
      if (existing && existing !== source) conflicted.add(slot);
      else if (!existing) resolved.set(slot, source);
    }
  }

  for (const slot of conflicted) resolved.delete(slot);
  return resolved;
}

/**
 * Main-draw matches grouped by round code, each in feed order.
 *
 * Index within the round is what the rules address, and it has to be derived
 * the same way here as in the script that wrote them: sorted by the match's
 * number within the tournament.
 */
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

/**
 * The shape of a draw, as a key into the rules: which elimination rounds it
 * has and how many matches each holds, e.g. "F1:1,F3:1,QF:4,R12:4,SF:2".
 *
 * Pools are left out deliberately. They decide who enters the bracket but not
 * how the bracket is wired, and including their count would split one topology
 * across a separate key for every pool configuration.
 */
export function formatSignature(matches: Match[]): string {
  return Array.from(bracketRounds(matches).entries())
    .map(([code, items]) => `${code}:${items.length}`)
    .sort()
    .join(",");
}

export interface SideLabels {
  A?: string;
  B?: string;
}

/**
 * Labels for the sides of every match whose fixture is not known yet, keyed by
 * match number.
 *
 * Only sides the rules cover are named. A side fed from the pools, or from a
 * round whose wiring varied between tournaments, is absent from the map and
 * stays "TBD" in the UI.
 */
export function describeBracketSides(matches: Match[]): Map<string, SideLabels> {
  const labels = new Map<string, SideLabels>();
  const rounds = bracketRounds(matches);
  const counts = new Map(Array.from(rounds, ([code, items]) => [code, items.length]));
  const applicable = resolveRules(RULES.formats, counts);
  if (applicable.size === 0) return labels;

  for (const [code, items] of rounds) {
    for (let index = 0; index < items.length; index++) {
      const target = items[index];
      if (target.fixtureState === "drawn") continue;

      for (const side of ["A", "B"] as const) {
        // A bye names the pair that advanced on the side that has one; only
        // the empty side needs describing.
        const known = side === "A" ? target.teamA : target.teamB;
        if (known.name !== "TBD") continue;

        const source = applicable.get(`${code}#${index}${side}`);
        if (!source) continue;

        const parsed = source.match(SOURCE);
        if (!parsed) continue;

        const [, sourceCode, sourceIndex, outcome] = parsed;
        const sourceMatch = rounds.get(sourceCode)?.[Number(sourceIndex)];
        if (!sourceMatch?.matchNumber) continue;

        const label = `${outcome === "W" ? "Winner" : "Loser"} M${sourceMatch.matchNumber}`;
        const entry = labels.get(target.no) ?? {};
        entry[side] = label;
        labels.set(target.no, entry);
      }
    }
  }

  return labels;
}

/** How many formats the rules cover, for the smoke test to report. */
export const ruleStats = {
  formats: Object.keys(RULES.formats).length,
  generatedAt: RULES.generatedAt,
  sampleSize: RULES.sampleSize,
};

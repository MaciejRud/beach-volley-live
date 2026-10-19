import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FivbClient } from "../../src/lib/fivb/client";
import { CountryHelper } from "../../src/lib/countryHelper";
import { Tournament } from "../../src/lib/fivb/types";

/**
 * Research, not app code: can we compute FIVB entry points ourselves?
 *
 * Recomputes every player's entry points for one finished tournament from the
 * results of the 365 days before its reference date, and compares them with
 * the per-player values FIVB published on that tournament's entry list
 * (EntryPoints1/EntryPoints2). Findings: docs/PLAN-ZGLOSZONE-PARY.md.
 *
 * The rule, FIVB Sport Operations Manual 2026 p. 23: the best three of the
 * last four results from Beach Pro Tour events and the senior World
 * Championships, counted 28 days before the qualification starts. Results
 * from other FIVB sanctioned events, and Futures played in the player's own
 * country, count only if they improve the total.
 *
 * Usage:
 *   npx tsx scripts/research/entry-points-backtest.ts <tournamentNo> [--cache <dir>] [--bpt-only]
 *
 * Team lists are cached as raw XML (default: the OS temp dir); a rerun makes
 * no requests. --bpt-only skips the sanctioned events, to compare the rules.
 */

const API_URL = "https://www.fivb.org/vis2009/XmlRequest.asmx";
const USER_AGENT = "beach-volley-live/1.0 (entry points research)";
const TEAM_FIELDS =
  "No Name FederationCode Status EarnedPointsPlayer EntryPoints1 EntryPoints2 IsInMainDraw IsInQualification NoPlayer1 NoPlayer2";

/** Types whose results always count: Elite, Challenge, Futures, senior World Championships. */
const MANDATORY_TYPES = new Set(["51", "52", "53", "4"]);
const FUTURES = "53";
/** Pro Tour Finals award no ranking points; Test events are not tournaments. */
const EXCLUDED_TYPES = new Set(["54", "35"]);

/**
 * Tournament country codes CountryHelper does not map from ISO-2 to the FIVB
 * code a team carries. Without them the home-Futures rule silently misses.
 */
const EXTRA_COUNTRY_CODES: Record<string, string> = {
  HU: "HUN", BG: "BUL", TH: "THA", CV: "CPV", CK: "COK", BI: "BDI",
};

/**
 * Host federation per tournament where VIS has no usable country code.
 * Bridlington 2026 comes back as "01"; English pairs enter as ENG, not GBR.
 */
const HOST_OVERRIDES: Record<string, string> = { "9039": "ENG" };

interface Result {
  tournamentNo: string;
  type: string;
  end: string;
  points: number;
  /** Counts only when it raises the total. */
  optional: boolean;
}

interface Options {
  tournamentNo: string;
  cacheDir: string;
  bptOnly: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    tournamentNo: "",
    cacheDir: path.join(os.tmpdir(), "beach-volley-live-entry-points"),
    bptOnly: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cache") opts.cacheDir = argv[++i];
    else if (arg === "--bpt-only") opts.bptOnly = true;
    else if (/^\d+$/.test(arg)) opts.tournamentNo = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!opts.tournamentNo) throw new Error("Pass a tournament number");
  return opts;
}

function attrs(xml: string): Record<string, string>[] {
  return [...xml.matchAll(/<BeachTeam ([^>]*)\/>/g)].map((m) =>
    Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]))
  );
}

/** Any failure aborts: a missing list would read as a player with no results. */
async function teamList(tournamentNo: string, cacheDir: string): Promise<Record<string, string>[]> {
  const file = path.join(cacheDir, `${tournamentNo}.xml`);
  if (fs.existsSync(file)) return attrs(fs.readFileSync(file, "utf8"));

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8", "User-Agent": USER_AGENT },
    body: `<Request Type="GetBeachTeamList" Fields="${TEAM_FIELDS}"><Filter NoTournament="${tournamentNo}"/></Request>`,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for tournament ${tournamentNo}`);
  const xml = await res.text();
  if (!xml.includes("<BeachTeams")) throw new Error(`Unexpected answer for ${tournamentNo}: ${xml.slice(0, 200)}`);
  fs.writeFileSync(file, xml);
  await new Promise((r) => setTimeout(r, 250));
  return attrs(xml);
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function endOf(t: Tournament): string {
  return t.endDateMain || t.endDate || t.startDateMain || t.startDate;
}

function bestThree(results: Result[]): number {
  return [...results].sort((a, b) => b.points - a.points).slice(0, 3).reduce((s, r) => s + r.points, 0);
}

/**
 * Best three of the last four mandatory results, plus any optional result
 * played since the oldest of those four.
 *
 * Optional results sit beside the last four rather than among them: they
 * never push a mandatory result out of the window. Reading them as taking a
 * slot in the four (the first version of this script) left 20 of Montreal's
 * 148 players short; this reading leaves 4, none of them too high. With fewer
 * than four mandatory results, every optional result in the year counts.
 */
function entryPoints(results: Result[]): number {
  const sorted = [...results].sort((a, b) => b.end.localeCompare(a.end));
  const lastFour = sorted.filter((r) => !r.optional).slice(0, 4);
  const oldest = lastFour.length === 4 ? lastFour[3].end : "";
  const extra = sorted.filter((r) => r.optional && r.end >= oldest);
  return bestThree([...lastFour, ...extra]);
}

/**
 * Why a team-list row is not a result, or null when it is one. Every rule
 * lives here, so whatever it throws away can be shown next to a miss.
 */
function dropReason(r: Record<string, string>, points: number, mandatory: boolean): string | null {
  // Zonal tours award points to rows with neither draw flag set (WEVZA
  // Modena 2025: 108 points, both flags 0), so points alone make a result.
  if (r.IsInMainDraw !== "1" && r.IsInQualification !== "1" && points === 0) return "in no draw";
  // Sanctioned events with no points cannot help, and cannot hurt either.
  if (!mandatory && points === 0) return "optional, no points";
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  fs.mkdirSync(opts.cacheDir, { recursive: true });

  const year = new Date().getFullYear();
  const seasons = [year - 2, year - 1, year];
  const all = (await Promise.all(seasons.map((s) => FivbClient.getTournaments(s)))).flat();
  const target = all.find((t) => t.no === opts.tournamentNo);
  if (!target) throw new Error(`Tournament ${opts.tournamentNo} not in seasons ${seasons.join(", ")}`);

  // Counted 28 days before the qualification (SOM p. 23); startDate is the qualification start.
  const ref = shiftDays(target.startDate, -28);
  const from = shiftDays(ref, -365);
  const pool = all.filter(
    (t) =>
      t.no !== target.no &&
      t.gender === target.gender &&
      !EXCLUDED_TYPES.has(t.type) &&
      (!opts.bptOnly || MANDATORY_TYPES.has(t.type)) &&
      endOf(t) >= from &&
      endOf(t) < ref
  );
  console.log(
    `${target.no} ${target.title} (${target.gender}, type ${target.type}), qualification ${target.startDate}, ` +
      `points as of ${ref}, window from ${from}: ${pool.length} tournaments`
  );

  const byPlayer = new Map<string, Result[]>();
  const dropped = new Map<string, string[]>();
  let fetched = 0;
  for (const t of pool) {
    const rows = await teamList(t.no, opts.cacheDir);
    fetched++;
    if (fetched % 50 === 0) console.log(`  ${fetched}/${pool.length} team lists`);
    const country =
      HOST_OVERRIDES[t.no] ?? EXTRA_COUNTRY_CODES[t.countryCode] ?? CountryHelper.getCountryCode(t.countryCode);
    for (const r of rows) {
      const points = Number(r.EarnedPointsPlayer || 0);
      const mandatory = MANDATORY_TYPES.has(t.type);
      const reason = dropReason(r, points, mandatory);
      if (reason) {
        // A dropped row that carried points is a blind spot of this script,
        // not data missing from VIS: keep it to print under the miss.
        if (points > 0)
          for (const playerNo of [r.NoPlayer1, r.NoPlayer2]) {
            const list = dropped.get(playerNo) ?? [];
            list.push(`${endOf(t)} ${t.no} type ${t.type} ${points} pts (${reason})`);
            dropped.set(playerNo, list);
          }
        continue;
      }
      for (const playerNo of [r.NoPlayer1, r.NoPlayer2]) {
        if (!playerNo || playerNo === "0") continue;
        const homeFutures = t.type === FUTURES && country === r.FederationCode;
        const list = byPlayer.get(playerNo) ?? [];
        list.push({ tournamentNo: t.no, type: t.type, end: endOf(t), points, optional: !mandatory || homeFutures });
        byPlayer.set(playerNo, list);
      }
    }
  }

  const entries = (await teamList(target.no, opts.cacheDir)).filter((r) => r.EntryPoints1 !== undefined && r.EntryPoints1 !== "");
  const players = entries.flatMap((r) => [
    { no: r.NoPlayer1, official: Number(r.EntryPoints1), team: r.Name.trim() },
    { no: r.NoPlayer2, official: Number(r.EntryPoints2), team: r.Name.trim() },
  ]);

  let exact = 0;
  let lower = 0;
  let higher = 0;
  let noResults = 0;
  const teams = new Map<string, { official: number; ours: number }>();
  const misses: string[] = [];
  for (const p of players) {
    const results = byPlayer.get(p.no) ?? [];
    const ours = entryPoints(results);
    const diff = ours - p.official;
    if (diff === 0) exact++;
    else if (diff < 0) lower++;
    else higher++;
    if (results.length === 0 && p.official > 0) noResults++;
    const team = teams.get(p.team) ?? { official: 0, ours: 0 };
    team.official += p.official;
    team.ours += ours;
    teams.set(p.team, team);
    if (diff === 0) continue;
    // Equal gaps for both partners point at an event they played together.
    const counted = [...results]
      .sort((a, b) => b.end.localeCompare(a.end))
      .slice(0, 8)
      .map((r) => `${r.end} ${r.tournamentNo} ${r.points}${r.optional ? " opt" : ""}`);
    misses.push(
      `  ${p.team.padEnd(28)} ${p.no.padStart(7)} official ${p.official} ours ${ours} (${diff > 0 ? "+" : ""}${diff})`,
      `      counted (newest 8): ${counted.join(", ") || "none"}`,
      ...(dropped.get(p.no) ?? []).map((d) => `      dropped: ${d}`)
    );
  }

  const teamTotals = [...teams.values()];
  const teamsExact = teamTotals.filter((t) => t.official === t.ours).length;
  const teamsClose = teamTotals.filter((t) => Math.abs(t.official - t.ours) <= 50).length;
  console.log(
    `\nplayers exact ${exact}/${players.length} (lower ${lower}, higher ${higher}, no results at all ${noResults})` +
      ` | teams exact ${teamsExact}/${teamTotals.length}, within 50 points ${teamsClose}`
  );
  console.log(misses.join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

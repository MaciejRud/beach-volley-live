import { RequestBuilder } from "../src/lib/fivb/requestBuilder";
import { ResponseParser } from "../src/lib/fivb/responseParser";
import { isMeasured } from "../src/lib/fivb/statistics";
import { Gender, PlayerStatLine, Tournament } from "../src/lib/fivb/types";
import {
  ArchivedTournament,
  FIRST_ARCHIVED_SEASON,
  PlayerDirectory,
  STATISTIC_TOURNAMENT_TYPES,
  STAT_COLUMNS,
  StatTuple,
  archivedTournamentNumbers,
  encodeStatLine,
  readPlayerDirectory,
  writePlayerDirectory,
  writeTournament,
} from "../src/lib/stats/archive";

/**
 * Downloads player statistics for every finished tournament that carries them
 * and writes them to data/stats/, one file per tournament.
 *
 * Idempotent: tournaments already in the archive are skipped, so the script can
 * be re-run to pick up only what is new. Pass --force to refetch everything.
 *
 * Any HTTP failure aborts the run. FIVB answers unmeasured matches with zeros
 * rather than an error, so a failed request written as data would be
 * indistinguishable from a genuinely unmeasured tournament -- and wrong forever,
 * because the archive is never refreshed.
 *
 * Usage:
 *   npx tsx scripts/backfill-stats.ts [--force] [--season 2026] [--gender M|W] [--limit N]
 */

const API_URL = "https://www.fivb.org/vis2009/XmlRequest.asmx";
const TIMEOUT_MS = 30000;
/** FIVB rejects some default clients; identifying ourselves avoids the question. */
const USER_AGENT = "beach-volley-live/1.0 (statistics backfill)";

/** Tournament status codes that mean "played to the end". */
const FINISHED_STATUS = new Set([7, 8, 9]);

interface Options {
  force: boolean;
  season?: number;
  gender?: Gender;
  limit?: number;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--force") opts.force = true;
    else if (arg === "--season") opts.season = Number(argv[++i]);
    else if (arg === "--gender") opts.gender = argv[++i] as Gender;
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
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

  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status} ${res.statusText}`);
  }

  return res.text();
}

/** Every finished statistics-bearing tournament, both genders, newest season first. */
async function collectTournaments(opts: Options): Promise<Tournament[]> {
  const currentSeason = new Date().getFullYear();
  const seasons = opts.season
    ? [opts.season]
    : Array.from(
        { length: currentSeason - FIRST_ARCHIVED_SEASON + 1 },
        (_, i) => FIRST_ARCHIVED_SEASON + i
      );

  const found: Tournament[] = [];
  for (const season of seasons) {
    const xml = await request(RequestBuilder.getTournamentList(season), `season ${season}`);
    const all = ResponseParser.parseTournaments(xml);

    for (const t of all) {
      if (!STATISTIC_TOURNAMENT_TYPES.has(t.type)) continue;
      if (!FINISHED_STATUS.has(t.statusCode)) continue;
      if (opts.gender && t.gender !== opts.gender) continue;
      found.push(t);
    }
    console.log(`  season ${season}: ${found.length} qualifying so far`);
  }

  return found;
}

/** Fetches one tournament's statistics and roster, returning null if nothing was measured. */
async function fetchTournament(
  tournament: Tournament,
  players: PlayerDirectory
): Promise<ArchivedTournament | null> {
  const statsXml = await request(
    RequestBuilder.getTournamentStatistics(tournament.no),
    `stats ${tournament.no}`
  );
  const rows = ResponseParser.parseStatistics(statsXml);

  // Group by match, then drop matches FIVB reported as all-zero: those were
  // played without a statistician and must never reach an average.
  const byMatch = new Map<string, PlayerStatLine[]>();
  for (const row of rows) {
    if (!row.matchNo) continue;
    const list = byMatch.get(row.matchNo) ?? [];
    list.push(row);
    byMatch.set(row.matchNo, list);
  }

  const matches: Record<string, StatTuple[]> = {};
  for (const [matchNo, lines] of byMatch) {
    if (isMeasured(lines)) matches[matchNo] = lines.map(encodeStatLine);
  }

  const measuredMatchCount = Object.keys(matches).length;
  if (measuredMatchCount === 0) return null;

  const matchesXml = await request(
    RequestBuilder.getMatchList(tournament.no),
    `matches ${tournament.no}`
  );
  const matchCount = ResponseParser.parseMatches(matchesXml).length;

  // The entry list is the only source of player names and federations; the
  // statistics rows carry nothing but a number.
  const teamsXml = await request(
    RequestBuilder.getTeamList(tournament.no),
    `teams ${tournament.no}`
  );
  for (const entry of ResponseParser.parseTeamEntries(teamsXml).values()) {
    for (const player of [entry.player1, entry.player2]) {
      if (!player) continue;
      players[player.no] = {
        no: player.no,
        name: player.name,
        federationCode: entry.federationCode,
        gender: tournament.gender,
      };
    }
  }

  return {
    tournamentNo: tournament.no,
    code: tournament.code,
    title: tournament.title,
    season: Number((tournament.startDateMain || tournament.startDate).slice(0, 4)),
    gender: tournament.gender,
    type: tournament.type,
    startDate: tournament.startDateMain || tournament.startDate,
    endDate: tournament.endDateMain || tournament.endDate,
    matchCount,
    measuredMatchCount,
    columns: STAT_COLUMNS,
    matches,
    fetchedAt: new Date().toISOString().slice(0, 10),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("Collecting tournament list...");
  const tournaments = await collectTournaments(opts);

  const existing = opts.force ? new Set<string>() : await archivedTournamentNumbers();
  let pending = tournaments.filter((t) => !existing.has(t.no));
  if (opts.limit) pending = pending.slice(0, opts.limit);

  console.log(
    `\n${tournaments.length} qualifying tournaments, ${existing.size} already archived, ` +
      `${pending.length} to fetch.\n`
  );
  if (pending.length === 0) return;

  const players = await readPlayerDirectory();
  let written = 0;
  let skipped = 0;

  for (const [index, tournament] of pending.entries()) {
    const label = `[${index + 1}/${pending.length}] ${tournament.no} ${tournament.code} ${tournament.title}`;
    const archived = await fetchTournament(tournament, players);

    if (!archived) {
      // No statistics at all: a cancelled event or one played without a
      // statistician. Left unwritten so a later run checks it again.
      console.log(`${label}: no statistics, skipped`);
      skipped++;
      continue;
    }

    await writeTournament(archived);
    written++;
    console.log(
      `${label}: ${archived.measuredMatchCount}/${archived.matchCount} matches measured`
    );
  }

  await writePlayerDirectory(players);

  console.log(
    `\nDone. ${written} tournaments written, ${skipped} skipped, ` +
      `${Object.keys(players).length} players in the directory.`
  );
}

main().catch((err) => {
  console.error("\nBackfill failed:", err?.message || err);
  console.error("Nothing partial was written for the tournament in progress.");
  process.exit(1);
});

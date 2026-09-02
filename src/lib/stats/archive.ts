import { promises as fs } from "fs";
import path from "path";
import { Gender, PlayerStatLine } from "../fivb/types";

/**
 * The statistics archive: one JSON file per tournament under data/stats/,
 * plus a player directory.
 *
 * Historical statistics never change -- FIVB does not backfill matches that
 * were played without a statistician, and coverage gaps are structural rather
 * than a matter of time -- so a tournament is fetched once and then frozen.
 * Files rather than a database: roughly 12 KB per tournament, a few megabytes
 * for the whole archive, and no environment variables on Vercel Hobby.
 */

export const ARCHIVE_DIR = path.join(process.cwd(), "data", "stats");
export const PLAYERS_FILE = path.join(process.cwd(), "data", "players.json");

/** Tournament types that carry statistics: Elite16, Challenge, Finals, Worlds, Olympics. */
export const STATISTIC_TOURNAMENT_TYPES = new Set(["51", "52", "54", "4", "5"]);

/** First season with usable coverage; before 2022 the feed is nearly empty. */
export const FIRST_ARCHIVED_SEASON = 2022;

/**
 * Column order for the stored stat tuples. Append-only: changing the order or
 * removing an entry silently reinterprets every file already in the archive.
 */
export const STAT_COLUMNS = [
  "playerNo",
  "spikeTotal",
  "spikePoint",
  "spikeFault",
  "spikeContinue",
  "blockTotal",
  "blockPoint",
  "blockFault",
  "blockContinue",
  "serveTotal",
  "servePoint",
  "serveFault",
  "serveContinue",
  "receptionTotal",
  "receptionFault",
  "receptionContinue",
  "digTotal",
  "digExcellent",
  "digFault",
  "digContinue",
  "setTotal",
  "setFault",
  "setContinue",
  "pointTotal",
  "nbRallies",
  "nbSets",
] as const;

/** One player's match line as stored: values positioned by STAT_COLUMNS. */
export type StatTuple = [string, ...number[]];

/**
 * The context of one match: who played whom, and how it ended.
 *
 * Statistics rows carry nothing but numbers, so without this a match cannot be
 * labelled with an opponent or a result. Field names are single letters because
 * this repeats for every match in the archive.
 */
export interface ArchivedMatchInfo {
  /** Team A name, team B name. */
  a: string;
  b: string;
  /** Player numbers on each side, for deciding which side a player was on. */
  pa: string[];
  pb: string[];
  /** Set scores as played, e.g. "21:19, 18:21, 15:12". */
  s: string;
  /** Winning side, or null for a match with no decided winner. */
  w: "A" | "B" | null;
}

/**
 * A tournament as stored in the archive.
 *
 * `matches` holds only measured matches: an unmeasured one carries no
 * information beyond "not measured", which the absence of the key already says.
 *
 * Rows are stored as positional tuples rather than objects. Repeating 25 key
 * names across roughly 250 rows per tournament costs five times the file size
 * for nothing -- 22 MB against 4 MB across the archive -- and this data is read
 * by code, never by hand.
 */
export interface ArchivedTournament {
  tournamentNo: string;
  code: string;
  title: string;
  season: number;
  gender: Gender;
  type: string;
  startDate: string;
  endDate: string;
  /** Matches played in the tournament, whether measured or not. */
  matchCount: number;
  /** How many of them carry statistics. */
  measuredMatchCount: number;
  /** Column order of the tuples below, so a file can be read on its own. */
  columns: readonly string[];
  /** Statistics per match, keyed by match number. */
  matches: Record<string, StatTuple[]>;
  /**
   * Opponent and result per match, keyed the same way.
   *
   * Optional: files written before this was added simply lack it, and readers
   * fall back to showing the numbers without match labels.
   */
  matchInfo?: Record<string, ArchivedMatchInfo>;
  /** When this file was written, ISO date. */
  fetchedAt: string;
}

/** Packs a parsed stat line into the stored tuple form. */
export function encodeStatLine(line: PlayerStatLine): StatTuple {
  const [, ...numeric] = STAT_COLUMNS;
  return [line.playerNo, ...numeric.map((c) => (line[c as keyof PlayerStatLine] as number) ?? 0)];
}

/**
 * Unpacks a stored tuple, using the column order recorded in the file rather
 * than the current constant, so an older file stays readable after a column is
 * appended.
 */
export function decodeStatTuple(
  tuple: StatTuple,
  columns: readonly string[] = STAT_COLUMNS
): PlayerStatLine {
  const line: Record<string, unknown> = {};
  columns.forEach((column, index) => {
    line[column] = tuple[index];
  });
  return line as unknown as PlayerStatLine;
}

export interface ArchivedPlayer {
  no: string;
  name: string;
  federationCode: string;
  gender: Gender;
}

export type PlayerDirectory = Record<string, ArchivedPlayer>;

export function tournamentFile(tournamentNo: string | number): string {
  return path.join(ARCHIVE_DIR, `${tournamentNo}.json`);
}

/** Tournament numbers already in the archive. */
export async function archivedTournamentNumbers(): Promise<Set<string>> {
  try {
    const files = await fs.readdir(ARCHIVE_DIR);
    return new Set(
      files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
    );
  } catch (err: any) {
    // A missing archive directory is the normal state before the first backfill.
    if (err?.code === "ENOENT") return new Set();
    throw err;
  }
}

export async function readTournament(
  tournamentNo: string | number
): Promise<ArchivedTournament | null> {
  try {
    const raw = await fs.readFile(tournamentFile(tournamentNo), "utf-8");
    return JSON.parse(raw) as ArchivedTournament;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function readAllTournaments(): Promise<ArchivedTournament[]> {
  const numbers = [...(await archivedTournamentNumbers())];
  const all = await Promise.all(numbers.map((no) => readTournament(no)));
  return all.filter((t): t is ArchivedTournament => t !== null);
}

export async function readPlayerDirectory(): Promise<PlayerDirectory> {
  try {
    const raw = await fs.readFile(PLAYERS_FILE, "utf-8");
    return JSON.parse(raw) as PlayerDirectory;
  } catch (err: any) {
    if (err?.code === "ENOENT") return {};
    throw err;
  }
}

export async function writeTournament(data: ArchivedTournament): Promise<void> {
  await fs.mkdir(ARCHIVE_DIR, { recursive: true });
  // Compact, not pretty-printed: these files are read by code and their size
  // is the reason the archive fits in the repository at all.
  await fs.writeFile(tournamentFile(data.tournamentNo), JSON.stringify(data) + "\n", "utf-8");
}

export async function writePlayerDirectory(directory: PlayerDirectory): Promise<void> {
  await fs.mkdir(path.dirname(PLAYERS_FILE), { recursive: true });
  // Sorted by player number so re-running the backfill produces no diff noise.
  const sorted: PlayerDirectory = {};
  for (const key of Object.keys(directory).sort((a, b) => Number(a) - Number(b))) {
    sorted[key] = directory[key];
  }
  await fs.writeFile(PLAYERS_FILE, JSON.stringify(sorted) + "\n", "utf-8");
}

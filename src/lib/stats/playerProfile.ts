import { promises as fs } from "fs";
import { Gender } from "../fivb/types";
import { StatTotals, addTotals, emptyTotals } from "./aggregate";
import { AGGREGATES_FILE, AggregateFile, decodeTotals } from "./aggregateFile";
import { PLAYERS_FILE, PlayerDirectory } from "./archive";
import {
  PERCENTILE_METRICS,
  PERCENTILE_MIN_MATCHES,
  PLAYER_FORM_FILE,
  PLAYER_INDEX_FILE,
  PercentileMetric,
  PlayerFormFile,
  PlayerIndexFile,
  decodeTotalsArray,
  metricValues,
} from "./playerFiles";

/**
 * Server-side reads for the players section.
 *
 * All four files are part of the deployment and cannot change while the process
 * runs, so each is parsed once and kept. The form file is the large one -- two
 * and a half megabytes -- which is exactly why it is read here and never sent
 * to the browser.
 */

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as T;
  } catch (err: any) {
    // No archive yet is a legitimate state: the section reports itself empty.
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

function once<T>(loader: () => Promise<T | null>): () => Promise<T | null> {
  let cached: Promise<T | null> | undefined;
  return () => (cached ??= loader());
}

export const loadPlayerIndex = once(() => readJson<PlayerIndexFile>(PLAYER_INDEX_FILE));
const loadForm = once(() => readJson<PlayerFormFile>(PLAYER_FORM_FILE));
const loadAggregates = once(() => readJson<AggregateFile>(AGGREGATES_FILE));
const loadDirectory = once(() => readJson<PlayerDirectory>(PLAYERS_FILE));

export interface SeasonRow {
  season: number;
  totals: StatTotals;
  /** Percentile per metric, 0-100, or null where the sample is too small to rank. */
  percentiles: Partial<Record<PercentileMetric, number | null>>;
}

export interface TournamentRow {
  tournamentNo: string;
  code: string;
  title: string;
  season: number;
  startDate: string;
  /** FIVB tournament type, for tier colouring on the form chart. */
  type: string;
  /** Percentage of the event's matches that were measured. */
  coverage: number;
  totals: StatTotals;
  /** The matches behind the totals, in playing order. */
  matches: {
    opponent: string;
    score: string;
    won: boolean;
    totals: StatTotals;
  }[];
}

export interface PlayerProfile {
  playerNo: string;
  name: string;
  federationCode: string;
  gender: Gender;
  career: StatTotals;
  /** Newest season first. */
  seasons: SeasonRow[];
  /** Newest tournament first. */
  tournaments: TournamentRow[];
}

/**
 * Where a value sits among the season's field, as a 0-100 percentile.
 *
 * Ranked ascending, so a high percentile always means "more of this" -- for
 * error rates that is worse, not better, and the UI has to say which way round
 * a given metric reads.
 */
function percentileOf(value: number, population: number[]): number | null {
  if (population.length < 2) return null;
  const below = population.filter((v) => v < value).length;
  const equal = population.filter((v) => v === value).length;
  return ((below + equal / 2) / population.length) * 100;
}

/**
 * Metric values for every player who reached the match threshold in a season,
 * grouped by gender -- men and women are not a single population.
 */
async function seasonPopulations(
  season: number,
  gender: Gender
): Promise<Partial<Record<PercentileMetric, number[]>>> {
  const [aggregates, directory] = await Promise.all([loadAggregates(), loadDirectory()]);
  if (!aggregates) return {};

  const populations: Partial<Record<PercentileMetric, number[]>> = {};
  for (const metric of PERCENTILE_METRICS) populations[metric] = [];

  for (const [playerNo, entry] of Object.entries(aggregates.players)) {
    if ((directory?.[playerNo]?.gender ?? entry.gender) !== gender) continue;

    const values = entry.seasons[String(season)];
    if (!values) continue;

    const totals = decodeTotals(values, aggregates.columns);
    if (totals.matches < PERCENTILE_MIN_MATCHES) continue;

    const metrics = metricValues(totals);
    for (const metric of PERCENTILE_METRICS) {
      const v = metrics[metric];
      if (v !== null) populations[metric]!.push(v);
    }
  }

  return populations;
}

export async function loadPlayerProfile(playerNo: string): Promise<PlayerProfile | null> {
  const [aggregates, form, directory] = await Promise.all([
    loadAggregates(),
    loadForm(),
    loadDirectory(),
  ]);

  const entry = aggregates?.players[playerNo];
  if (!aggregates || !entry) return null;

  const known = directory?.[playerNo];
  const gender = known?.gender ?? entry.gender;

  const career = emptyTotals();

  const seasonNumbers = Object.keys(entry.seasons)
    .map(Number)
    .sort((a, b) => b - a);

  const seasons: SeasonRow[] = [];
  for (const season of seasonNumbers) {
    const totals = decodeTotals(entry.seasons[String(season)], aggregates.columns);
    addTotals(career, totals);

    const populations = await seasonPopulations(season, gender);
    const metrics = metricValues(totals);
    const percentiles: SeasonRow["percentiles"] = {};

    // A player below the threshold is shown their numbers but not a rank: with
    // three matches played, a percentile would describe luck, not standing.
    if (totals.matches >= PERCENTILE_MIN_MATCHES) {
      for (const metric of PERCENTILE_METRICS) {
        const value = metrics[metric];
        percentiles[metric] =
          value === null ? null : percentileOf(value, populations[metric] ?? []);
      }
    }

    seasons.push({ season, totals, percentiles });
  }

  const tournaments: TournamentRow[] = (form?.players[playerNo] ?? []).map((t) => ({
    tournamentNo: t.tournamentNo,
    code: t.code,
    title: t.title,
    season: t.season,
    startDate: t.startDate,
    type: t.type ?? "",
    coverage: t.coverage ?? 100,
    totals: decodeTotalsArray(t.totals, form!.columns),
    matches: (t.matches ?? []).map((m) => ({
      opponent: m.o,
      score: m.s,
      won: m.w,
      totals: decodeTotalsArray(m.t, form!.columns),
    })),
  }));

  return {
    playerNo,
    name: known?.name ?? `#${playerNo}`,
    federationCode: known?.federationCode ?? "",
    gender,
    career,
    seasons,
    tournaments,
  };
}

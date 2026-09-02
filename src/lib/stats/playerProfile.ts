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

/** Where a player stands on one metric: their place, out of how many ranked. */
export interface MetricRank {
  place: number;
  outOf: number;
}

export interface SeasonRow {
  season: number;
  totals: StatTotals;
  /** Percentile per metric, 0-100, or null where the sample is too small to rank. */
  percentiles: Partial<Record<PercentileMetric, number | null>>;
  /** Placing per metric -- 1st is best, which for error rates means the lowest. */
  ranks: Partial<Record<PercentileMetric, MetricRank | null>>;
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

/** The headline figures, summed over everything in the archive. */
export interface CareerSummary {
  tournaments: number;
  matches: number;
  won: number;
  lost: number;
  /** Points the player's side scored, across their measured matches. */
  teamPoints: number;
  /** Points the pair scored themselves. */
  pairPoints: number;
  /** The remainder: points the opponents handed over. */
  opponentErrors: number;
}

export interface PlayerProfile {
  playerNo: string;
  name: string;
  federationCode: string;
  gender: Gender;
  career: StatTotals;
  summary: CareerSummary;
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
 * The player's placing on one metric, 1st being best.
 *
 * "Best" depends on the metric: most points is first, but fewest reception
 * errors is. Ties share a place, as in any ranking -- two players level on 5th
 * are both 5th.
 */
function rankOf(
  value: number,
  population: number[],
  higherIsBetter: boolean
): MetricRank | null {
  if (population.length < 2) return null;
  const ahead = population.filter((v) => (higherIsBetter ? v > value : v < value)).length;
  return { place: ahead + 1, outOf: population.length };
}

/** Metrics where a lower number is the better result. */
const LOWER_IS_BETTER = new Set<PercentileMetric>(["receptionFaultRate"]);

/**
 * Metric values for every player who reached the match threshold in a season,
 * grouped by gender -- men and women are not a single population.
 */
const populationCache = new Map<string, Partial<Record<PercentileMetric, number[]>>>();

async function seasonPopulations(
  season: number,
  gender: Gender
): Promise<Partial<Record<PercentileMetric, number[]>>> {
  // Every player page asks for the same five seasons, and the aggregate file
  // does not change while the process runs -- so scan it once per season.
  const cacheKey = `${season}:${gender}`;
  const cached = populationCache.get(cacheKey);
  if (cached) return cached;

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

  populationCache.set(cacheKey, populations);
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
    const ranks: SeasonRow["ranks"] = {};

    // A player below the threshold is shown their numbers but not a standing:
    // with three matches played, a placing would describe luck, not form.
    if (totals.matches >= PERCENTILE_MIN_MATCHES) {
      for (const metric of PERCENTILE_METRICS) {
        const value = metrics[metric];
        const population = populations[metric] ?? [];
        percentiles[metric] = value === null ? null : percentileOf(value, population);
        ranks[metric] =
          value === null ? null : rankOf(value, population, !LOWER_IS_BETTER.has(metric));
      }
    }

    seasons.push({ season, totals, percentiles, ranks });
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

  const rawForm = form?.players[playerNo] ?? [];
  const won = rawForm.reduce((total, t) => total + (t.won ?? 0), 0);
  const teamPoints = rawForm.reduce((total, t) => total + (t.teamPoints ?? 0), 0);
  const pairPoints = rawForm.reduce((total, t) => total + (t.pairPoints ?? 0), 0);

  const summary: CareerSummary = {
    tournaments: tournaments.length,
    matches: career.matches,
    won,
    lost: career.matches - won,
    teamPoints,
    pairPoints,
    opponentErrors: Math.max(0, teamPoints - pairPoints),
  };

  return {
    playerNo,
    name: known?.name ?? `#${playerNo}`,
    federationCode: known?.federationCode ?? "",
    gender,
    career,
    summary,
    seasons,
    tournaments,
  };
}

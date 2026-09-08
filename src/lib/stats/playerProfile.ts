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
 * runs, so each is parsed once and kept. The form file is the large one -- some
 * eight megabytes -- which is exactly why it is read here and never sent to the
 * browser.
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

/** How many bars the field's distribution is drawn with. */
export const HISTOGRAM_BINS = 22;

/**
 * One metric set against its field, as the distribution view draws it.
 *
 * The bins are the field's real shape, not a curve fitted to it. That matters:
 * several of these metrics are not bell-shaped. Block points per match is
 * openly bimodal -- in a pair one player blocks and the other defends, so
 * roughly 40% of the field sits at almost zero blocks and a second group sits
 * around four. A fitted normal curve would peak between the two, where hardly
 * anybody is, and would quietly turn a role into a weakness.
 */
export interface MetricDistribution {
  metric: PercentileMetric;
  /** The player's own figure; null when the metric has no denominator. */
  value: number | null;
  percentile: number | null;
  rank: MetricRank | null;
  /** Lowest and highest figure in the field -- the ends of the bin range. */
  min: number;
  max: number;
  /** How many players fall in each equal-width bin between min and max. */
  bins: number[];
}

/** One selectable period: the whole archive, or a single season. */
export interface ScopeRow {
  /** CAREER_SCOPE, or the season as a string. */
  key: string;
  label: string;
  totals: StatTotals;
  /** How many players this period's field holds, whether or not it is ranked. */
  fieldSize: number;
  /** Measured matches this period needs before a standing is drawn. */
  minMatches: number;
  /** Empty when the player is under `minMatches` for this period. */
  distributions: MetricDistribution[];
  /**
   * Whether this period's block counters carry a real outcome split.
   *
   * In 2022 the feed reported almost nothing but successful blocks -- across
   * the whole field, 95% of blockTotal is blockPoint, against roughly 30% in
   * every later season -- so a won / continues / error bar for that season is
   * all green and says nothing. Decided per period from the field as a whole,
   * because per player the two regimes overlap: a 2022 player can reach 45%
   * non-point blocks and a 2023 one can sit as low as 18%.
   */
  blockMeasured: boolean;
}

export const CAREER_SCOPE = "career";

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

/**
 * One partner, and how this player did alongside them.
 *
 * Measured matches only. A pair can have played two full seasons together with
 * statistics from a handful of events, so the figures here describe the record,
 * not the partnership -- which the table has to say out loud.
 */
export interface PartnerRow {
  playerNo: string;
  name: string;
  federationCode: string;
  /** Whether this partner clears the listing bar and so has a page to link to. */
  listed: boolean;
  /** Seasons they were measured together, oldest first. */
  seasons: number[];
  matches: number;
  won: number;
  lost: number;
  /** This player's own totals in those matches -- not the pair's combined. */
  totals: StatTotals;
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
  /** The whole archive first, then one entry per season, newest first. */
  scopes: ScopeRow[];
  /** Most-played partner first. */
  partners: PartnerRow[];
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

/** One metric's field: the values themselves, plus the histogram drawn from them. */
interface FieldStats {
  values: number[];
  min: number;
  max: number;
  bins: number[];
}

/** Everything one period's field says: per-metric shape, plus what it can be trusted on. */
interface FieldSummary {
  metrics: Partial<Record<PercentileMetric, FieldStats>>;
  blockMeasured: boolean;
}

/**
 * Least share of a field's block actions that must be something other than a
 * point before the block split is treated as measured.
 *
 * Sits far from both regimes -- 2022 lands at 5%, every later season above
 * 65% -- so it separates them without being tuned to either.
 */
const BLOCK_DECOMPOSED_MIN_SHARE = 0.25;

/**
 * Bins a field into equal-width bars between its lowest and highest value.
 *
 * A field of one has no shape to draw and no ranking to give, so it is dropped
 * rather than rendered as a single full-height bar.
 */
function summarise(values: number[]): FieldStats | null {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const bins = new Array<number>(HISTOGRAM_BINS).fill(0);

  for (const value of values) {
    // The highest value lands exactly on the upper edge; it belongs in the last
    // bin rather than one past the end of the array.
    const index =
      span > 0
        ? Math.min(HISTOGRAM_BINS - 1, Math.floor(((value - min) / span) * HISTOGRAM_BINS))
        : 0;
    bins[index] += 1;
  }

  return { values, min, max, bins };
}

/**
 * Metric values for every player the standing is measured against, by period
 * and gender -- men and women are not a single population.
 *
 * The field is the players the section actually lists: someone with two
 * qualification appearances across their whole career is not a peer to measure
 * a tour regular against, and counting them only inflates everyone's placing.
 *
 * Career carries no threshold of its own. Being in the form file already means
 * ten measured matches, which is exactly the bar for having a page at all; a
 * season needs PERCENTILE_MIN_MATCHES on top of that, because a season is a
 * short enough window for three matches to describe luck rather than form.
 */
const fieldCache = new Map<string, FieldSummary>();

async function fieldFor(scopeKey: string, gender: Gender): Promise<FieldSummary> {
  // Every player page asks for the same handful of periods, and the files do
  // not change while the process runs -- so scan them once per period.
  const cacheKey = `${scopeKey}:${gender}`;
  const cached = fieldCache.get(cacheKey);
  if (cached) return cached;

  const [aggregates, directory, form] = await Promise.all([
    loadAggregates(),
    loadDirectory(),
    loadForm(),
  ]);
  if (!aggregates) return { metrics: {}, blockMeasured: true };

  const minMatches = scopeKey === CAREER_SCOPE ? 0 : PERCENTILE_MIN_MATCHES;
  const raw: Record<string, number[]> = {};
  for (const metric of PERCENTILE_METRICS) raw[metric] = [];

  // Block actions over the whole field, to judge whether the feed split them
  // this period or only counted the ones that scored.
  let blockTotal = 0;
  let blockOther = 0;

  for (const [playerNo, entry] of Object.entries(aggregates.players)) {
    if ((directory?.[playerNo]?.gender ?? entry.gender) !== gender) continue;
    if (form && !form.players[playerNo]) continue;

    const totals = emptyTotals();
    if (scopeKey === CAREER_SCOPE) {
      for (const values of Object.values(entry.seasons)) {
        addTotals(totals, decodeTotals(values, aggregates.columns));
      }
    } else {
      const values = entry.seasons[scopeKey];
      if (!values) continue;
      addTotals(totals, decodeTotals(values, aggregates.columns));
    }
    if (totals.matches < minMatches) continue;

    blockTotal += totals.blockTotal;
    blockOther += totals.blockFault + totals.blockContinue;

    const metrics = metricValues(totals);
    for (const metric of PERCENTILE_METRICS) {
      const value = metrics[metric];
      if (value !== null) raw[metric].push(value);
    }
  }

  const metrics: Partial<Record<PercentileMetric, FieldStats>> = {};
  for (const metric of PERCENTILE_METRICS) {
    const stats = summarise(raw[metric]);
    if (stats) metrics[metric] = stats;
  }

  const summary: FieldSummary = {
    metrics,
    // A field with no blocks at all has nothing to disprove, so it is left
    // trusted rather than reported as a feed problem.
    blockMeasured: blockTotal === 0 || blockOther / blockTotal >= BLOCK_DECOMPOSED_MIN_SHARE,
  };

  fieldCache.set(cacheKey, summary);
  return summary;
}

/** Assembles one selectable period: the player's totals against that field. */
async function buildScope(
  key: string,
  label: string,
  totals: StatTotals,
  gender: Gender
): Promise<ScopeRow> {
  const minMatches = key === CAREER_SCOPE ? 0 : PERCENTILE_MIN_MATCHES;
  const field = await fieldFor(key, gender);
  const { blockMeasured } = field;

  // Points per match has a denominator for everyone in the field, so its
  // population is the field itself. Metrics needing a skill the player never
  // performed rank against fewer, and each carries its own `outOf`.
  const fieldSize = field.metrics.pointsPerMatch?.values.length ?? 0;

  // Below the threshold the numbers are still shown, but not a placing: with
  // three matches played, a placing would describe luck rather than form.
  if (totals.matches < minMatches) {
    return { key, label, totals, fieldSize, minMatches, distributions: [], blockMeasured };
  }

  const metrics = metricValues(totals);
  const distributions: MetricDistribution[] = [];

  for (const metric of PERCENTILE_METRICS) {
    const stats = field.metrics[metric];
    if (!stats) continue;

    const value = metrics[metric];
    distributions.push({
      metric,
      value,
      percentile: value === null ? null : percentileOf(value, stats.values),
      rank: value === null ? null : rankOf(value, stats.values, !LOWER_IS_BETTER.has(metric)),
      min: stats.min,
      max: stats.max,
      bins: stats.bins,
    });
  }

  return { key, label, totals, fieldSize, minMatches, distributions, blockMeasured };
}

export async function loadPlayerProfile(playerNo: string): Promise<PlayerProfile | null> {
  const [aggregates, form, directory] = await Promise.all([
    loadAggregates(),
    loadForm(),
    loadDirectory(),
  ]);

  const entry = aggregates?.players[playerNo];
  if (!aggregates || !entry) return null;

  // The aggregate file still holds everyone, so that season rankings are drawn
  // from the whole field. The form file holds only the players the section
  // lists -- absence from it means this player is below the listing threshold
  // and has no page.
  if (form && !form.players[playerNo]) return null;

  const known = directory?.[playerNo];
  const gender = known?.gender ?? entry.gender;

  const career = emptyTotals();

  const seasonNumbers = Object.keys(entry.seasons)
    .map(Number)
    .sort((a, b) => b - a);

  const seasonTotals = seasonNumbers.map((season) => {
    const totals = decodeTotals(entry.seasons[String(season)], aggregates.columns);
    addTotals(career, totals);
    return { season, totals };
  });

  // Career leads, because it is the period every player has and the one the
  // page opens on; seasons follow newest first, matching the table below them.
  const scopes: ScopeRow[] = [
    await buildScope(CAREER_SCOPE, "All seasons", career, gender),
    ...(await Promise.all(
      seasonTotals.map(({ season, totals }) =>
        buildScope(String(season), String(season), totals, gender)
      )
    )),
  ];

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

  // Who this player was standing next to, match by match. Grouped on the
  // partner's number rather than their name: the tour has two Mols, and a pair
  // that changes mid-tournament through injury has to split correctly.
  const byPartner = new Map<string, PartnerRow>();
  for (const event of rawForm) {
    for (const match of event.matches ?? []) {
      if (!match.p) continue;

      let row = byPartner.get(match.p);
      if (!row) {
        const known = directory?.[match.p];
        row = {
          playerNo: match.p,
          name: known?.name ?? `#${match.p}`,
          federationCode: known?.federationCode ?? "",
          // Absence from the form file is the listing threshold talking: that
          // partner has no page, so their name must not become a dead link.
          listed: Boolean(form?.players[match.p]),
          seasons: [],
          matches: 0,
          won: 0,
          lost: 0,
          totals: emptyTotals(),
        };
        byPartner.set(match.p, row);
      }

      row.matches += 1;
      if (match.w) row.won += 1;
      else row.lost += 1;
      if (!row.seasons.includes(event.season)) row.seasons.push(event.season);
      addTotals(row.totals, decodeTotalsArray(match.t, form!.columns));
    }
  }

  const partners = [...byPartner.values()]
    .map((row) => ({ ...row, seasons: row.seasons.sort((a, b) => a - b) }))
    // Most-played first: the reader is looking for the long-standing pairing,
    // not the one-off stand-in from a single qualifier. Name last, so two
    // one-match partners level on points order alphabetically rather than by
    // whichever tournament the archive happened to be read in.
    .sort(
      (a, b) =>
        b.matches - a.matches ||
        b.totals.pointTotal - a.totals.pointTotal ||
        a.name.localeCompare(b.name)
    );

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
    scopes,
    partners,
    tournaments,
  };
}

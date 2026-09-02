import path from "path";
import { Gender } from "../fivb/types";
import { StatTotals } from "./aggregate";
import { AGGREGATE_COLUMNS } from "./aggregateFile";

/**
 * Files behind the players section, split by who reads them.
 *
 * The index is small and goes to the browser so search can run without a round
 * trip. The form file is an order of magnitude larger and is only ever read on
 * the server, when a single player's page is rendered.
 */

export const PLAYER_INDEX_FILE = path.join(process.cwd(), "data", "player-index.json");
export const PLAYER_FORM_FILE = path.join(process.cwd(), "data", "player-form.json");

/** One searchable player. Field names are short because this ships to the client. */
export interface PlayerIndexEntry {
  /** Player number. */
  n: string;
  /** Display name, "Lastname Firstname". */
  d: string;
  /** Federation code. */
  f: string;
  /** Gender. */
  g: Gender;
  /** Measured matches in the archive -- drives default ordering. */
  m: number;
  /** Most recent season with a measured match. */
  s: number;
}

export interface PlayerIndexFile {
  /** Seasons covered by the archive, ascending. */
  seasons: number[];
  players: PlayerIndexEntry[];
}

/**
 * One match inside a tournament, as the chart tooltip lists it.
 *
 * Short keys: this repeats for every match of every player in the archive, and
 * the file is already the largest thing the server reads.
 */
export interface PlayerFormMatch {
  /** Opponent pair name. */
  o: string;
  /** Set scores from this player's point of view, e.g. "21:19, 15:21, 15:11". */
  s: string;
  /** Did this player's side win. */
  w: boolean;
  /** This player's totals in the match, positional -- see AGGREGATE_COLUMNS. */
  t: number[];
}

/** One tournament in a player's career, as stored: totals in AGGREGATE_COLUMNS order. */
export interface PlayerFormEntry {
  tournamentNo: string;
  code: string;
  title: string;
  season: number;
  startDate: string;
  /** FIVB tournament type, used to colour the point by tier. */
  type: string;
  /**
   * Share of the tournament's matches that were measured, 0-100.
   *
   * A partially recorded event is real data covering part of the draw, so it is
   * plotted -- but marked, because the average behind the point rests on fewer
   * matches than the tournament actually had.
   */
  coverage: number;
  /** Totals, positional -- see AGGREGATE_COLUMNS. */
  totals: number[];
  /** The matches behind those totals, oldest first. */
  matches: PlayerFormMatch[];
}

export interface PlayerFormFile {
  columns: readonly string[];
  /** Per player number, tournaments newest first. */
  players: Record<string, PlayerFormEntry[]>;
}

/**
 * Percentile rank of a player among their peers, per season and metric.
 *
 * Comparing a player against the whole field is only meaningful with a real
 * sample behind both sides, so ranks are computed over players who reached the
 * match threshold in that season and gender.
 */
export const PERCENTILE_MIN_MATCHES = 8;

export const PERCENTILE_METRICS = [
  "pointsPerMatch",
  "spikeSuccess",
  "spikeEfficiency",
  "blockPointsPerMatch",
  "serveRisk",
  "receptionFaultRate",
] as const;

export type PercentileMetric = (typeof PERCENTILE_METRICS)[number];

/** Metric values for one player-season, used both for display and for ranking. */
export function metricValues(totals: StatTotals): Record<PercentileMetric, number | null> {
  const perMatch = (value: number) => (totals.matches > 0 ? value / totals.matches : null);
  const share = (numerator: number, denominator: number) =>
    denominator > 0 ? (numerator / denominator) * 100 : null;

  return {
    pointsPerMatch: perMatch(totals.pointTotal),
    spikeSuccess: share(totals.spikePoint, totals.spikeTotal),
    spikeEfficiency: share(totals.spikePoint - totals.spikeFault, totals.spikeTotal),
    blockPointsPerMatch: perMatch(totals.blockPoint),
    serveRisk: share(totals.servePoint + totals.serveFault, totals.serveTotal),
    receptionFaultRate: share(totals.receptionFault, totals.receptionTotal),
  };
}

export function decodeTotalsArray(
  values: number[],
  columns: readonly string[] = AGGREGATE_COLUMNS
): StatTotals {
  const totals: Record<string, number> = {};
  columns.forEach((column, index) => {
    totals[column] = values[index] ?? 0;
  });
  return totals as unknown as StatTotals;
}

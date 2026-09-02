import path from "path";
import { Gender } from "../fivb/types";
import { StatTotals } from "./aggregate";

/**
 * The pre-computed aggregate file: per-player, per-season totals.
 *
 * Built from the archive by scripts/build-aggregates.ts and read at runtime,
 * so a page showing a season average never touches the tournament files.
 */

export const AGGREGATES_FILE = path.join(process.cwd(), "data", "aggregates.json");

/**
 * Column order of the stored totals. Append-only, like the archive's own
 * columns: reordering silently reinterprets every number in the file.
 */
export const AGGREGATE_COLUMNS = [
  "matches",
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

export interface AggregateFile {
  columns: readonly string[];
  players: Record<string, { gender: Gender; seasons: Record<string, number[]> }>;
}

export function encodeTotals(totals: StatTotals): number[] {
  return AGGREGATE_COLUMNS.map((column) => (totals[column as keyof StatTotals] as number) ?? 0);
}

/** Unpacks stored totals using the column order recorded in the file itself. */
export function decodeTotals(values: number[], columns: readonly string[]): StatTotals {
  const totals: Record<string, number> = {};
  columns.forEach((column, index) => {
    totals[column] = values[index] ?? 0;
  });
  return totals as unknown as StatTotals;
}

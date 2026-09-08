import type { PercentileMetric } from "./playerFiles";

/**
 * How each ranked metric is labelled, formatted and read.
 *
 * Kept apart from playerFiles.ts, which reaches for `path` and so cannot be
 * imported by a client component. This module is plain data and travels to
 * either side of the boundary.
 *
 * `higherIsBetter` is not decoration: percentiles are always computed
 * ascending, so for reception errors a high percentile is a bad result and
 * colouring it green would invert the meaning.
 */
export interface MetricDisplay {
  key: PercentileMetric;
  label: string;
  /** Column head where the full label will not fit -- a phone-width table. */
  short: string;
  format: (value: number) => string;
  higherIsBetter: boolean;
  /** Read under the distribution, saying what the number actually counts. */
  note: string;
}

export const METRIC_DISPLAY: MetricDisplay[] = [
  {
    key: "pointsPerMatch",
    label: "Points / match",
    short: "PTS",
    format: (v) => v.toFixed(1),
    higherIsBetter: true,
    note: "points this player scored themselves",
  },
  {
    key: "spikeSuccess",
    label: "Kill %",
    short: "KILL",
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
    note: "attacks that ended in a point",
  },
  {
    key: "spikeEfficiency",
    label: "Attack efficiency",
    short: "ATK",
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
    note: "kills minus errors, over all attacks",
  },
  {
    key: "blockPointsPerMatch",
    label: "Block points / match",
    short: "BLK",
    format: (v) => v.toFixed(1),
    higherIsBetter: true,
    // The field splits in two here rather than clustering: in a pair one player
    // blocks and the other defends, so a low figure is usually a role and not a
    // weakness. Said out loud, because the distribution alone shows the two
    // humps but not why they are there.
    note: "splits the field by role -- defenders sit near zero",
  },
  {
    key: "serveRisk",
    label: "Serve risk",
    short: "SRV",
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: true,
    note: "serves that ended the rally either way -- ace or error",
  },
  {
    key: "receptionFaultRate",
    label: "Reception errors",
    short: "REC",
    format: (v) => `${v.toFixed(1)}%`,
    higherIsBetter: false,
    note: "receptions that lost the point outright -- lower is better",
  },
];

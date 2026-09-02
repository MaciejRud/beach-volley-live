import { PlayerStatLine, SetScore, TeamPointBreakdown } from "./types";

/**
 * Metric definitions for FIVB beach statistics.
 *
 * Terminology follows Polish volleyball convention: "skuteczność" counts only
 * the points, "efektywność" subtracts the errors and can therefore be negative.
 * Changing a formula here invalidates every aggregate built on top of it.
 */

/**
 * Below this many attempts a percentage says more about the sample than about
 * the player -- a blocker can genuinely finish a match with six spikes. Absolute
 * counts are always shown; percentages are suppressed.
 */
export const MIN_ATTEMPTS_FOR_PERCENT = 10;

/** Returns a percentage, or null when the denominator is too small to mean anything. */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator < MIN_ATTEMPTS_FOR_PERCENT) return null;
  return (numerator / denominator) * 100;
}

/** Kill percentage: points as a share of all spikes. */
export function spikeSuccess(line: PlayerStatLine): number | null {
  return ratio(line.spikePoint, line.spikeTotal);
}

/**
 * Attack efficiency: points minus errors, as a share of all spikes.
 *
 * SpikeFault already includes spikes stopped by the opposing block (verified on
 * 96 matches: one pair's attack errors always cover the other's block points),
 * so this matches the indoor (kills - errors - blocked) / attempts without any
 * correction. Negative values are legitimate.
 */
export function spikeEfficiency(line: PlayerStatLine): number | null {
  return ratio(line.spikePoint - line.spikeFault, line.spikeTotal);
}

/** Share of block touches that ended the rally in the blocker's favour. */
export function blockSuccess(line: PlayerStatLine): number | null {
  return ratio(line.blockPoint, line.blockTotal);
}

/** Aces plus service errors: how much the player gambles from the line. */
export function serveRisk(line: PlayerStatLine): number | null {
  return ratio(line.servePoint + line.serveFault, line.serveTotal);
}

/**
 * Share of receptions lost outright.
 *
 * Reception has no positive grade in this feed -- ReceptionExcellent is always
 * empty -- so errors are the only thing that can be reported.
 */
export function receptionFaultRate(line: PlayerStatLine): number | null {
  return ratio(line.receptionFault, line.receptionTotal);
}

/**
 * Tells a measured match from an unmeasured one.
 *
 * FIVB answers for unmeasured matches with a valid response in which every
 * counter is zero, so the zeros have to be recognised here and turned into
 * "no data" -- a zero kept as a number would drag down every average.
 */
export function isMeasured(lines: PlayerStatLine[]): boolean {
  if (lines.length === 0) return false;
  return lines.some((l) => l.spikeTotal > 0 || l.receptionTotal > 0 || l.serveTotal > 0);
}

/** Adds up the counters of several rows -- e.g. both players of a pair. */
export function sumLines(lines: PlayerStatLine[]): number {
  return lines.reduce((total, l) => total + l.pointTotal, 0);
}

/**
 * Splits a team's points into points the pair scored and points the opponent
 * gave away.
 *
 * The feed does not publish the second number, and summing the opponent's
 * FaultTotal would double-count: a blocked spike counts as their attack error
 * and as our block point at the same time. The remainder is the only correct
 * route. Verified on 1597 matches: no gaps, no negative results -- a negative
 * here would mean the set scores and the statistics disagree, so it is returned
 * as-is rather than clamped away.
 */
export function teamPointBreakdown(
  sets: SetScore[],
  side: "A" | "B",
  pairLines: PlayerStatLine[]
): TeamPointBreakdown {
  const teamPoints = sets.reduce((total, s) => total + (side === "A" ? s.scoreA : s.scoreB), 0);
  const playerPoints = sumLines(pairLines);

  return {
    teamPoints,
    playerPoints,
    opponentErrors: teamPoints - playerPoints,
  };
}

/** A team's points split by the action that won them, plus what the opponent gave away. */
export interface PointOriginSplit {
  spike: number;
  block: number;
  serve: number;
  opponentErrors: number;
  total: number;
}

/**
 * Splits one team's points for a single set or a whole match.
 *
 * `teamPoints` is the scoreboard figure; everything the pair did not win with
 * an attack, a block or a serve is by definition an opponent error. Summing the
 * opponent's own fault counters instead would double-count -- a blocked attack
 * is booked as their error and as our block point at the same time.
 */
export function pointOrigin(teamPoints: number, pairLines: PlayerStatLine[]): PointOriginSplit {
  const spike = pairLines.reduce((total, l) => total + l.spikePoint, 0);
  const block = pairLines.reduce((total, l) => total + l.blockPoint, 0);
  const serve = pairLines.reduce((total, l) => total + l.servePoint, 0);

  return {
    spike,
    block,
    serve,
    opponentErrors: Math.max(0, teamPoints - spike - block - serve),
    total: teamPoints,
  };
}

/** Adds several stat lines together -- both players of a pair, or several sets. */
export function mergeLines(lines: PlayerStatLine[]): PlayerStatLine | undefined {
  if (lines.length === 0) return undefined;

  const merged: PlayerStatLine = { ...lines[0] };
  const keys = [
    "spikeTotal", "spikePoint", "spikeFault", "spikeContinue",
    "blockTotal", "blockPoint", "blockFault", "blockContinue",
    "serveTotal", "servePoint", "serveFault", "serveContinue",
    "receptionTotal", "receptionFault", "receptionContinue",
    "digTotal", "digExcellent", "digFault", "digContinue",
    "setTotal", "setFault", "setContinue", "pointTotal",
  ] as const;

  for (const line of lines.slice(1)) {
    for (const key of keys) merged[key] += line[key];
  }

  return merged;
}

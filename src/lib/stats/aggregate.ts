import { Gender, PlayerStatLine } from "../fivb/types";
import { ArchivedTournament, decodeStatTuple, readAllTournaments } from "./archive";

/**
 * Season and career averages built from the archive.
 *
 * Every denominator here counts measured matches only. The backfill already
 * drops unmeasured matches rather than storing them as zeros, so anything read
 * back from a file is real -- but that invariant is worth stating, because a
 * single unmeasured match folded in would quietly deflate a career average.
 */

/** Counters summed over a set of matches, plus how many matches were involved. */
export interface StatTotals extends Omit<PlayerStatLine, "playerNo" | "matchNo" | "setNumber"> {
  matches: number;
}

export interface PlayerSeasonTotals {
  playerNo: string;
  season: number;
  totals: StatTotals;
}

export interface PlayerAggregate {
  playerNo: string;
  gender: Gender;
  /** Totals over everything in the archive. */
  career: StatTotals;
  /** Totals per season, newest first. */
  seasons: PlayerSeasonTotals[];
}

const COUNTER_KEYS = [
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

function emptyTotals(): StatTotals {
  const totals = { matches: 0 } as StatTotals;
  for (const key of COUNTER_KEYS) totals[key] = 0;
  return totals;
}

function addLine(totals: StatTotals, line: PlayerStatLine): void {
  totals.matches += 1;
  for (const key of COUNTER_KEYS) {
    totals[key] += line[key] ?? 0;
  }
}

/**
 * Per-match average of one counter.
 *
 * Returns null rather than 0 when nothing was measured -- the difference
 * between "averages no points" and "we have no matches for this player" is the
 * whole reason the archive distinguishes them.
 */
export function perMatch(totals: StatTotals, key: (typeof COUNTER_KEYS)[number]): number | null {
  if (totals.matches === 0) return null;
  return (totals[key] ?? 0) / totals.matches;
}

/**
 * Builds per-player aggregates from the whole archive.
 *
 * Reads every tournament file once; intended for build-time or a cached route,
 * not for a per-request call.
 */
export async function buildAggregates(
  tournaments?: ArchivedTournament[]
): Promise<Map<string, PlayerAggregate>> {
  const source = tournaments ?? (await readAllTournaments());
  const players = new Map<string, PlayerAggregate>();
  const seasonTotals = new Map<string, StatTotals>();

  for (const tournament of source) {
    for (const tuples of Object.values(tournament.matches)) {
      for (const tuple of tuples) {
        const line = decodeStatTuple(tuple, tournament.columns);

        let player = players.get(line.playerNo);
        if (!player) {
          player = {
            playerNo: line.playerNo,
            gender: tournament.gender,
            career: emptyTotals(),
            seasons: [],
          };
          players.set(line.playerNo, player);
        }
        addLine(player.career, line);

        const seasonKey = `${line.playerNo}:${tournament.season}`;
        let totals = seasonTotals.get(seasonKey);
        if (!totals) {
          totals = emptyTotals();
          seasonTotals.set(seasonKey, totals);
          player.seasons.push({ playerNo: line.playerNo, season: tournament.season, totals });
        }
        addLine(totals, line);
      }
    }
  }

  for (const player of players.values()) {
    player.seasons.sort((a, b) => b.season - a.season);
  }

  return players;
}

/** Season totals for one player, or null when that player has no measured match that season. */
export function seasonTotals(
  aggregate: PlayerAggregate | undefined,
  season: number
): StatTotals | null {
  return aggregate?.seasons.find((s) => s.season === season)?.totals ?? null;
}

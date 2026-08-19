import { Match, Tournament } from "./types";

/**
 * Which events count as "headline" competition.
 *
 * The FIVB feed mixes the Beach Pro Tour with hundreds of national tours and
 * age-group events. The live ticker only shows headline matches, and the live
 * page sorts them to the top, so this is the single place that decides what
 * qualifies.
 */

/** Senior European Championship. CEV brands it "EuroBeachVolley". */
const EURO_CHAMPS_PATTERN = /eurobeachvolley/i;

/**
 * Age-group events carry the same branding as the senior tournament, so they
 * are excluded explicitly rather than by circuit.
 */
const AGE_GROUP_PATTERN = /\bU(?:15|16|17|18|19|20|21|22|23)\b/i;

export function isEuropeanChampionship(title: string | undefined): boolean {
  if (!title) return false;
  return EURO_CHAMPS_PATTERN.test(title) && !AGE_GROUP_PATTERN.test(title);
}

export function isBeachProTour(circuit: string | undefined): boolean {
  return circuit === "BPT";
}

/** True for Beach Pro Tour events and the senior European Championship. */
export function isProminentTournament(t: Pick<Tournament, "circuit" | "title">): boolean {
  return isBeachProTour(t.circuit) || isEuropeanChampionship(t.title);
}

export function isProminentMatch(m: Match): boolean {
  return isBeachProTour(m.tournamentCircuit) || isEuropeanChampionship(m.tournamentTitle);
}

/**
 * Ranks matches for display: headline events first, then by tier within them.
 * Lower sorts earlier.
 */
export function matchProminenceRank(m: Match): number {
  if (!isProminentMatch(m)) return 100;

  switch (m.tournamentTier) {
    case "WorldChamps":
      return 0;
    case "Elite16":
      return 1;
    case "Finals":
      return 2;
    case "Challenge":
      return 3;
    case "Continental":
      return 4;
    case "Futures":
      return 5;
    default:
      return 6;
  }
}

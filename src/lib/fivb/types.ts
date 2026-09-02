export type Gender = "M" | "W" | "C";

export type TournamentTier = "Elite16" | "Challenge" | "Futures" | "Finals" | "WorldChamps" | "Continental" | "National" | "Other";

export type TournamentCircuit = "BPT" | "CEV" | "National" | "Other";

export type TournamentStatus = "upcoming" | "running" | "finished" | "cancelled" | "unknown";

export type MatchStatus = "scheduled" | "live" | "break" | "finished" | "interrupted" | "cancelled" | "unknown";

export interface Tournament {
  id: string;
  no: string;
  title: string;
  code: string;
  startDate: string;
  endDate: string;
  startDateMain?: string;
  endDateMain?: string;
  city: string;
  countryCode: string;
  countryName?: string;
  gender: Gender;
  type: string;
  typeDescription: string;
  tier: TournamentTier;
  circuit: TournamentCircuit;
  statusCode: number;
  status: TournamentStatus;
  statusText: string;
}

export interface SetScore {
  setNumber: number;
  scoreA: number;
  scoreB: number;
  /** Set length in seconds, as the feed sends it (e.g. 1267 = 21 minutes). */
  duration?: number;
  isFinished?: boolean;
}

export interface Team {
  name: string;
  player1?: string;
  player2?: string;
  countryCode: string;
  countryName?: string;
  seed?: number;
  rank?: number;
  /** Team id in the FIVB feed, used to join entry-list seeding onto a match. */
  teamNo?: string;
}

/** Seeding for one team, read from the tournament entry list. */
export interface TeamSeed {
  teamNo: string;
  seed?: number;
}

/** One player as listed on a tournament entry. */
export interface PlayerRef {
  no: string;
  firstName: string;
  lastName: string;
  /** "Lastname Firstname" as shown in the UI. */
  name: string;
}

/**
 * A team's entry-list record: seeding plus the two player ids.
 *
 * The player ids are the only reliable way to attach statistics to a side of
 * the match -- the tour has two Mols and two Grimalts, so names do not work.
 */
export interface TeamEntry {
  teamNo: string;
  name: string;
  federationCode: string;
  seed?: number;
  player1?: PlayerRef;
  player2?: PlayerRef;
}

/**
 * Raw counters for one player, either summed over a match or over one set.
 *
 * Field set is what FIVB actually fills for beach volleyball -- roughly 28 of
 * the 100+ attributes VolleyStatistic declares. Attributes that always come
 * back empty (ReceptionExcellent, TimePlayed, every *Key and *Percentage) are
 * deliberately absent.
 */
export interface PlayerStatLine {
  /** FIVB player number, read from NoItem on rows with ItemType="30". */
  playerNo: string;
  /** Match this row belongs to; set when a whole tournament is fetched at once. */
  matchNo?: string;
  /** Set number on a per-set row; undefined on the match total row. */
  setNumber?: number;
  spikeTotal: number;
  spikePoint: number;
  spikeFault: number;
  spikeContinue: number;
  blockTotal: number;
  blockPoint: number;
  blockFault: number;
  blockContinue: number;
  serveTotal: number;
  servePoint: number;
  serveFault: number;
  serveContinue: number;
  receptionTotal: number;
  receptionFault: number;
  receptionContinue: number;
  digTotal: number;
  digExcellent: number;
  digFault: number;
  digContinue: number;
  setTotal: number;
  setFault: number;
  setContinue: number;
  pointTotal: number;
  /** Rallies played; only sent on match rows. */
  nbRallies?: number;
  /** Sets played; only sent on match rows. */
  nbSets?: number;
}

/**
 * Statistics for a single match.
 *
 * Absent statistics are `null` at the call site, never an empty object: FIVB
 * answers for unmeasured matches with a valid response full of zeros, and a
 * zero that means "not measured" would poison every average.
 */
export interface MatchStatistics {
  matchNo: string;
  /** One row per player, summed over the match. */
  match: PlayerStatLine[];
  /** One row per player per set, ordered by set number. */
  sets: PlayerStatLine[];
}

/**
 * Where one team's points came from.
 *
 * Points off opponent errors are not published; they are the remainder after
 * the pair's own scoring actions. Summing the opponent's FaultTotal instead
 * would double-count -- a blocked spike is both their fault and our block point.
 */
export interface TeamPointBreakdown {
  /** Points scored by the team, summed from the set scores. */
  teamPoints: number;
  /** Points the pair scored themselves (spike + block + serve). */
  playerPoints: number;
  /** Remainder: points handed over by the opponent's errors. */
  opponentErrors: number;
}

export interface Match {
  id: string;
  no: string;
  tournamentId: string;
  tournamentTitle?: string;
  tournamentCity?: string;
  tournamentCountry?: string;
  tournamentTier?: TournamentTier;
  tournamentCircuit?: TournamentCircuit;
  matchNumber?: string;
  round: string;
  roundName: string;
  roundPhase?: string;
  /** Pool letter for pool-stage matches (e.g. "A"). */
  roundBracket?: string;
  /** Local date at the venue, YYYY-MM-DD. */
  date: string;
  /** Local kick-off at the venue, HH:MM. */
  time: string;
  /** Kick-off as an ISO instant, so clients can render it in their own zone. */
  startsAtUtc?: string;
  court?: string;
  status: MatchStatus;
  statusCode: number;
  statusText: string;
  currentSet?: number;
  teamA: Team;
  teamB: Team;
  setsWonA: number;
  setsWonB: number;
  sets: SetScore[];
  winner?: "A" | "B" | null;
  duration?: string;
  isPolishMatch?: boolean;
}

export interface PolishTeamsSummary {
  activeMatches: Match[];
  upcomingMatches: Match[];
  recentMatches: Match[];
  tournamentsInvolved: Tournament[];
  lastUpdated: string;
}

export interface LiveCenterData {
  liveMatches: Match[];
  breakMatches: Match[];
  upcomingToday: Match[];
  activeTournaments: Tournament[];
  lastUpdated: string;
}
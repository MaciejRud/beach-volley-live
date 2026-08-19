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
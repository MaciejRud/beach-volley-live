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
}

export interface Match {
  id: string;
  no: string;
  tournamentId: string;
  tournamentTitle?: string;
  tournamentCity?: string;
  tournamentCountry?: string;
  matchNumber?: string;
  round: string;
  roundName: string;
  roundPhase?: string;
  date: string;
  time: string;
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
export class RequestBuilder {
  /**
   * Builds XML for tournament list request
   */
  static getTournamentList(season: number = new Date().getFullYear()): string {
    const firstDate = `${season}-01-01`;
    const lastDate = `${season}-12-31`;

    return `<Request Type="GetBeachTournamentList" Fields="No Code Name Title StartDate EndDate StartDateMainDraw EndDateMainDraw City CountryCode Gender Type TypeDescription Status">
      <Filter FirstDate="${firstDate}" LastDate="${lastDate}" />
    </Request>`.trim();
  }

  /**
   * Builds XML for matches in a tournament
   */
  static getMatchList(tournamentNo: string | number): string {
    return `<Request Type="GetBeachMatchList" Fields="No NoTournament NoInTournament Round RoundName RoundPhase RoundBracket MatchNumber LocalDate LocalTime UtcDate UtcTime Court CourtName NoTeamA NoTeamB TeamAName TeamBName TeamAFederationCode TeamBFederationCode MatchPointsA MatchPointsB PointsTeamASet1 PointsTeamBSet1 PointsTeamASet2 PointsTeamBSet2 PointsTeamASet3 PointsTeamBSet3 DurationSet1 DurationSet2 DurationSet3 Status">
      <Filter NoTournament="${tournamentNo}" />
    </Request>`.trim();
  }

  /**
   * Builds XML for single match details
   */
  static getMatch(matchNo: string | number): string {
    return `<Request Type="GetBeachMatch" Fields="No NoTournament NoInTournament Round RoundName RoundPhase RoundBracket MatchNumber LocalDate LocalTime UtcDate UtcTime Court CourtName NoTeamA NoTeamB TeamAName TeamBName TeamAFederationCode TeamBFederationCode MatchPointsA MatchPointsB PointsTeamASet1 PointsTeamBSet1 PointsTeamASet2 PointsTeamBSet2 PointsTeamASet3 PointsTeamBSet3 DurationSet1 DurationSet2 DurationSet3 Status">
      <Filter No="${matchNo}" />
    </Request>`.trim();
  }

  /**
   * Builds XML for team / player details
   */
  static getTeam(teamNo: string | number): string {
    return `<Request Type="GetBeachTeam" Fields="No Name PlayerAName PlayerBName CountryCode Rank">
      <Filter No="${teamNo}" />
    </Request>`.trim();
  }

  /**
   * Builds XML for the entry list of a tournament.
   *
   * Seeds are not exposed on the match list -- TeamASeed comes back empty --
   * so the draw positions have to be read from the team list and joined on
   * NoTeamA / NoTeamB.
   */
  static getTeamList(tournamentNo: string | number): string {
    return `<Request Type="GetBeachTeamList" Fields="No Name FederationCode PositionInMainDraw PositionInQualification IsInMainDraw IsInQualification">
      <Filter NoTournament="${tournamentNo}" />
    </Request>`.trim();
  }
}
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
   * Builds XML for single match details.
   *
   * Single-object requests take No as an attribute of Request; putting it in
   * a Filter returns HTTP 400 ParameterMissing.
   */
  static getMatch(matchNo: string | number): string {
    return `<Request Type="GetBeachMatch" No="${this.numeric(matchNo)}" Fields="No NoTournament NoInTournament Round RoundName RoundPhase RoundBracket MatchNumber LocalDate LocalTime UtcDate UtcTime Court CourtName NoTeamA NoTeamB TeamAName TeamBName TeamAFederationCode TeamBFederationCode MatchPointsA MatchPointsB PointsTeamASet1 PointsTeamBSet1 PointsTeamASet2 PointsTeamBSet2 PointsTeamASet3 PointsTeamBSet3 DurationSet1 DurationSet2 DurationSet3 Status" />`.trim();
  }

  /**
   * Builds XML for the entry list of a tournament.
   *
   * Seeds are not exposed on the match list -- TeamASeed comes back empty --
   * so the draw positions have to be read from the team list and joined on
   * NoTeamA / NoTeamB. The same response carries the player ids and names,
   * which is the only reliable key for attaching statistics to a side.
   */
  static getTeamList(tournamentNo: string | number): string {
    return `<Request Type="GetBeachTeamList" Fields="No Name FederationCode PositionInMainDraw PositionInQualification IsInMainDraw IsInQualification NoPlayer1 NoPlayer2 Player1FirstName Player1LastName Player2FirstName Player2LastName">
      <Filter NoTournament="${this.numeric(tournamentNo)}" />
    </Request>`.trim();
  }

  /**
   * Builds XML for one match's statistics, per set and summed over the match.
   *
   * SumBy="Match Set" returns both granularities in one response: match rows
   * carry an empty NoSet, per-set rows carry the set number.
   */
  static getMatchStatistics(matchNo: string | number): string {
    return `<Request Type="GetBeachStatisticList" SumBy="Match Set" Fields="${this.STATISTIC_FIELDS}">
      <Filter NoMatches="${this.numeric(matchNo)}" />
    </Request>`.trim();
  }

  /**
   * Builds XML for a whole tournament's statistics, one row per player per match.
   *
   * One request covers the entire event -- Hamburg 2026 comes back as 284 rows
   * in about 100 KB -- so there is no reason to walk the matches one by one.
   */
  static getTournamentStatistics(tournamentNo: string | number): string {
    return `<Request Type="GetBeachStatisticList" SumBy="Match" Fields="${this.STATISTIC_FIELDS}">
      <Filter NoTournaments="${this.numeric(tournamentNo)}" />
    </Request>`.trim();
  }

  /**
   * Fields VolleyStatistic actually fills for beach volleyball. NoItem is the
   * player number -- NoPlayer is accepted in Fields but silently never sent.
   */
  private static readonly STATISTIC_FIELDS =
    "No NoItem ItemType NoMatch NoSet SpikeTotal SpikePoint SpikeFault SpikeContinue " +
    "BlockTotal BlockPoint BlockFault BlockContinue ServeTotal ServePoint ServeFault ServeContinue " +
    "ReceptionTotal ReceptionFault ReceptionContinue DigTotal DigExcellent DigFault DigContinue " +
    "SetTotal SetFault SetContinue PointTotal NbRallies NbSets";

  /**
   * Ids reach these builders from public route params, and they end up inside
   * an XML request body -- so only digits are allowed through.
   */
  private static numeric(value: string | number): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`Invalid FIVB id: ${String(value)}`);
    }
    return n;
  }
}
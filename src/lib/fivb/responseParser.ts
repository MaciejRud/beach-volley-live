import { XMLParser } from "fast-xml-parser";
import { Tournament, Match, Team, TeamEntry, PlayerRef, PlayerStatLine, SetScore, TournamentTier, TournamentCircuit, TournamentStatus, MatchStatus } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  trimValues: true,
});

export class ResponseParser {
  /**
   * Parses XML response containing tournament list
   */
  static parseTournaments(xml: string): Tournament[] {
    try {
      const parsed = xmlParser.parse(xml);
      const root = parsed.Responses?.BeachTournaments || parsed.BeachTournaments || parsed.Responses?.BeachTournament || parsed;
      const rawList = root?.BeachTournament || [];
      const list = Array.isArray(rawList) ? rawList : [rawList];

      return list
        .filter((item: any) => item && (item["@_No"] || item.No))
        .map((item: any) => {
          const no = String(item["@_No"] ?? item.No ?? "");
          const title = String(item["@_Title"] ?? item.Title ?? item["@_Name"] ?? item.Name ?? "Turniej FIVB");
          const code = String(item["@_Code"] ?? item.Code ?? "");
          const startDate = String(item["@_StartDate"] ?? item.StartDate ?? "");
          const endDate = String(item["@_EndDate"] ?? item.EndDate ?? "");
          const startDateMain = String(item["@_StartDateMainDraw"] ?? item.StartDateMainDraw ?? startDate);
          const endDateMain = String(item["@_EndDateMainDraw"] ?? item.EndDateMainDraw ?? endDate);
          const city = String(item["@_City"] ?? item.City ?? "");
          const countryCode = String(item["@_CountryCode"] ?? item.CountryCode ?? "").toUpperCase();
          const rawGender = String(item["@_Gender"] ?? item.Gender ?? "C");
          const gender = rawGender === "0" || rawGender === "M" ? "M" : rawGender === "1" || rawGender === "W" ? "W" : "C";
          const type = String(item["@_Type"] ?? item.Type ?? "");
          const typeDescription = String(item["@_TypeDescription"] ?? item.TypeDescription ?? "");
          const statusCode = Number(item["@_Status"] ?? item.Status ?? 0);

          const { status, statusText } = this.mapTournamentStatus(statusCode, startDateMain, endDateMain);
          const { tier, circuit } = this.classifyTournament(title, typeDescription, code, countryCode);

          return {
            id: no,
            no,
            title,
            code,
            startDate,
            endDate,
            startDateMain,
            endDateMain,
            city,
            countryCode,
            gender,
            type,
            typeDescription,
            tier,
            circuit,
            statusCode,
            status,
            statusText,
          };
        });
    } catch (err) {
      console.error("Error parsing tournaments XML:", err);
      return [];
    }
  }

  /**
   * Parses XML response containing matches list
   */
  static parseMatches(xml: string, tournament?: Partial<Tournament>): Match[] {
    try {
      const parsed = xmlParser.parse(xml);
      const root = parsed.Responses?.BeachMatches || parsed.BeachMatches || parsed.Responses?.BeachMatch || parsed;
      const rawList = root?.BeachMatch || [];
      const list = Array.isArray(rawList) ? rawList : [rawList];

      return list
        .filter((item: any) => item && (item["@_No"] || item.No))
        .map((item: any) => {
          const no = String(item["@_No"] ?? item.No ?? "");
          const tournamentId = String(item["@_NoTournament"] ?? item.NoTournament ?? tournament?.no ?? "");
          const matchNumber = String(item["@_NoInTournament"] ?? item.NoInTournament ?? item["@_MatchNumber"] ?? item.MatchNumber ?? "");
          const round = String(item["@_Round"] ?? item.Round ?? "");
          const roundName = String(item["@_RoundName"] ?? item.RoundName ?? item["@_RoundPhase"] ?? item.RoundPhase ?? round);
          const roundCode = String(item["@_RoundCode"] ?? item.RoundCode ?? "");
          const roundPhase = String(item["@_RoundPhase"] ?? item.RoundPhase ?? "");
          const roundBracket = String(item["@_RoundBracket"] ?? item.RoundBracket ?? "");
          const winnerRank = Number(item["@_WinnerRank"] ?? item.WinnerRank ?? 0);
          const loserRank = Number(item["@_LoserRank"] ?? item.LoserRank ?? 0);
          const date = String(item["@_LocalDate"] ?? item.LocalDate ?? "");
          const rawTime = String(item["@_LocalTime"] ?? item.LocalTime ?? "");
          const time = rawTime.length >= 5 ? rawTime.slice(0, 5) : rawTime;
          // The feed gives the same kick-off twice: local to the venue and in
          // UTC. The UTC pair is what lets the client re-render in its own zone
          // -- the venue's timezone itself is not resolvable from this API.
          const utcDate = String(item["@_UtcDate"] ?? item.UtcDate ?? "");
          const rawUtcTime = String(item["@_UtcTime"] ?? item.UtcTime ?? "");
          const startsAtUtc =
            utcDate && rawUtcTime ? `${utcDate}T${rawUtcTime}Z` : undefined;

          const court = String(item["@_Court"] ?? item.Court ?? item["@_CourtName"] ?? item.CourtName ?? "");
          const statusCode = Number(item["@_Status"] ?? item.Status ?? 1);

          const { status, statusText, currentSet } = this.mapMatchStatus(statusCode);

          // Extract teams and countries
          const teamAName = String(item["@_TeamAName"] ?? item.TeamAName ?? "TBD");
          const teamBName = String(item["@_TeamBName"] ?? item.TeamBName ?? "TBD");
          const teamAFed = String(item["@_TeamAFederationCode"] ?? item.TeamAFederationCode ?? "");
          const teamBFed = String(item["@_TeamBFederationCode"] ?? item.TeamBFederationCode ?? "");

          const teamANo = String(item["@_NoTeamA"] ?? item.NoTeamA ?? "");
          const teamBNo = String(item["@_NoTeamB"] ?? item.NoTeamB ?? "");

          const teamA = this.parseTeam(teamAName, teamAFed, teamANo);
          const teamB = this.parseTeam(teamBName, teamBFed, teamBNo);

          // A named side is the only reliable marker: the feed leaves the name
          // empty and puts -1 (bye) or 0 (undrawn slot) in NoTeam. Both sides
          // named means a real fixture even when it ended in a forfeit.
          const isNamed = (raw: string) => raw.trim() !== "" && raw.trim() !== "TBD";
          const hasA = isNamed(teamAName);
          const hasB = isNamed(teamBName);
          const fixtureState: Match["fixtureState"] =
            hasA && hasB ? "drawn" : hasA || hasB ? "bye" : "undrawn";
          const isRealFixture = fixtureState === "drawn";

          // Extract set scores
          const sets: SetScore[] = [];
          const set1A = Number(item["@_PointsTeamASet1"] ?? item.PointsTeamASet1 ?? 0);
          const set1B = Number(item["@_PointsTeamBSet1"] ?? item.PointsTeamBSet1 ?? 0);
          const dur1 = Number(item["@_DurationSet1"] ?? item.DurationSet1 ?? 0);

          const set2A = Number(item["@_PointsTeamASet2"] ?? item.PointsTeamASet2 ?? 0);
          const set2B = Number(item["@_PointsTeamBSet2"] ?? item.PointsTeamBSet2 ?? 0);
          const dur2 = Number(item["@_DurationSet2"] ?? item.DurationSet2 ?? 0);

          const set3A = Number(item["@_PointsTeamASet3"] ?? item.PointsTeamASet3 ?? 0);
          const set3B = Number(item["@_PointsTeamBSet3"] ?? item.PointsTeamBSet3 ?? 0);
          const dur3 = Number(item["@_DurationSet3"] ?? item.DurationSet3 ?? 0);

          if (isRealFixture && (set1A > 0 || set1B > 0 || currentSet >= 1 || status === "finished")) {
            sets.push({ setNumber: 1, scoreA: set1A, scoreB: set1B, duration: dur1, isFinished: currentSet > 1 || status === "finished" });
          }
          if (set2A > 0 || set2B > 0 || currentSet >= 2 || (status === "finished" && (set2A > 0 || set2B > 0))) {
            sets.push({ setNumber: 2, scoreA: set2A, scoreB: set2B, duration: dur2, isFinished: currentSet > 2 || status === "finished" });
          }
          if (set3A > 0 || set3B > 0 || currentSet >= 3 || (status === "finished" && (set3A > 0 || set3B > 0))) {
            sets.push({ setNumber: 3, scoreA: set3A, scoreB: set3B, duration: dur3, isFinished: status === "finished" });
          }

          const setsWonA = Number(item["@_MatchPointsA"] ?? item.MatchPointsA ?? 0);
          const setsWonB = Number(item["@_MatchPointsB"] ?? item.MatchPointsB ?? 0);

          let winner: "A" | "B" | null = null;
          if (status === "finished") {
            if (setsWonA > setsWonB) winner = "A";
            else if (setsWonB > setsWonA) winner = "B";
          }

          const isPolishMatch = teamA.countryCode === "POL" || teamB.countryCode === "POL";

          return {
            id: no,
            no,
            tournamentId,
            tournamentTitle: tournament?.title,
            tournamentCity: tournament?.city,
            tournamentCountry: tournament?.countryCode,
            tournamentTier: tournament?.tier,
            tournamentCircuit: tournament?.circuit,
            matchNumber,
            round,
            roundName,
            roundCode,
            roundPhase,
            roundBracket,
            winnerRank,
            loserRank,
            fixtureState,
            date,
            time,
            startsAtUtc,
            court,
            status,
            statusCode,
            statusText,
            currentSet,
            teamA,
            teamB,
            setsWonA,
            setsWonB,
            sets,
            winner,
            isPolishMatch,
          };
        });
    } catch (err) {
      console.error("Error parsing matches XML:", err);
      return [];
    }
  }

  private static parseTeam(rawName: string, federationCode?: string, teamNo?: string): Team {
    const no = teamNo && teamNo !== "0" ? teamNo : undefined;

    if (!rawName || rawName === "TBD") {
      return { name: "TBD", countryCode: federationCode?.toUpperCase() || "", teamNo: no };
    }

    // Prefer federation code from API; fall back to regex extraction from name
    const countryMatch = rawName.match(/\s+\[?([A-Za-z]{3})\]?$/);
    const countryCode = (federationCode || (countryMatch ? countryMatch[1] : "")).toUpperCase();
    const cleanName = countryMatch ? rawName.replace(countryMatch[0], "").trim() : rawName.trim();

    const parts = cleanName.split("/");
    const player1 = parts[0]?.trim();
    const player2 = parts[1]?.trim();

    return {
      name: cleanName,
      player1,
      player2,
      countryCode,
      teamNo: no,
    };
  }

  /**
   * Parses a tournament entry list, keyed by team id.
   *
   * The match list does not expose seeds (TeamASeed comes back empty), so draw
   * positions are read here and joined onto matches via NoTeamA / NoTeamB. The
   * same response carries the two player ids, which is what statistics rows are
   * matched against.
   */
  static parseTeamEntries(xml: string): Map<string, TeamEntry> {
    const entries = new Map<string, TeamEntry>();

    try {
      const parsed = xmlParser.parse(xml);
      const root = parsed.Responses?.BeachTeams || parsed.BeachTeams || parsed;
      const rawList = root?.BeachTeam || [];
      const list = Array.isArray(rawList) ? rawList : [rawList];

      for (const item of list) {
        if (!item) continue;
        const teamNo = String(item["@_No"] ?? item.No ?? "");
        if (!teamNo) continue;

        const mainPos = Number(item["@_PositionInMainDraw"] ?? item.PositionInMainDraw ?? 0);
        const qualPos = Number(item["@_PositionInQualification"] ?? item.PositionInQualification ?? 0);

        const seed = mainPos > 0 ? mainPos : qualPos > 0 ? qualPos : undefined;

        entries.set(teamNo, {
          teamNo,
          name: String(item["@_Name"] ?? item.Name ?? ""),
          federationCode: String(item["@_FederationCode"] ?? item.FederationCode ?? "").toUpperCase(),
          seed,
          player1: this.parsePlayerRef(item, 1),
          player2: this.parsePlayerRef(item, 2),
        });
      }
    } catch (err) {
      console.error("Error parsing team list XML:", err);
    }

    return entries;
  }

  private static parsePlayerRef(item: any, slot: 1 | 2): PlayerRef | undefined {
    const no = String(item[`@_NoPlayer${slot}`] ?? item[`NoPlayer${slot}`] ?? "");
    if (!no || no === "0") return undefined;

    const firstName = String(item[`@_Player${slot}FirstName`] ?? item[`Player${slot}FirstName`] ?? "");
    const lastName = String(item[`@_Player${slot}LastName`] ?? item[`Player${slot}LastName`] ?? "");
    const name = [lastName, firstName].filter(Boolean).join(" ") || no;

    return { no, firstName, lastName, name };
  }

  /**
   * Parses a GetBeachStatisticList response into player rows.
   *
   * Only ItemType="30" (players) is kept: team rows (ItemType="11") come back
   * with every counter zeroed even for fully measured matches, so feeding them
   * into the "is this match measured?" test would mark everything unmeasured.
   *
   * Rows are identified by NoItem. NoPlayer is accepted in the request's Fields
   * but never sent back.
   */
  static parseStatistics(xml: string): PlayerStatLine[] {
    try {
      const parsed = xmlParser.parse(xml);
      const root = parsed.Responses?.VolleyStatistics || parsed.VolleyStatistics || parsed;
      const rawList = root?.VolleyStatistic || [];
      const list = Array.isArray(rawList) ? rawList : [rawList];

      return list
        .filter((item: any) => item && String(item["@_ItemType"] ?? item.ItemType ?? "") === "30")
        .map((item: any) => {
          const num = (field: string): number => this.statNumber(item, field) ?? 0;
          const setNumber = this.statNumber(item, "NoSet");

          const matchNo = String(item["@_NoMatch"] ?? item.NoMatch ?? "");

          return {
            playerNo: String(item["@_NoItem"] ?? item.NoItem ?? ""),
            matchNo: matchNo || undefined,
            // Match rows send NoSet as an empty attribute, per-set rows as 1..3.
            setNumber,
            spikeTotal: num("SpikeTotal"),
            spikePoint: num("SpikePoint"),
            spikeFault: num("SpikeFault"),
            spikeContinue: num("SpikeContinue"),
            blockTotal: num("BlockTotal"),
            blockPoint: num("BlockPoint"),
            blockFault: num("BlockFault"),
            blockContinue: num("BlockContinue"),
            serveTotal: num("ServeTotal"),
            servePoint: num("ServePoint"),
            serveFault: num("ServeFault"),
            serveContinue: num("ServeContinue"),
            receptionTotal: num("ReceptionTotal"),
            receptionFault: num("ReceptionFault"),
            receptionContinue: num("ReceptionContinue"),
            digTotal: num("DigTotal"),
            digExcellent: num("DigExcellent"),
            digFault: num("DigFault"),
            digContinue: num("DigContinue"),
            setTotal: num("SetTotal"),
            setFault: num("SetFault"),
            setContinue: num("SetContinue"),
            pointTotal: num("PointTotal"),
            nbRallies: this.statNumber(item, "NbRallies"),
            nbSets: this.statNumber(item, "NbSets"),
          };
        })
        .filter((row: PlayerStatLine) => row.playerNo !== "");
    } catch (err) {
      console.error("Error parsing statistics XML:", err);
      return [];
    }
  }

  /**
   * Reads one statistic attribute. Empty attributes -- which the feed uses for
   * "not applicable", e.g. NbSets on a per-set row -- become undefined, never 0.
   */
  private static statNumber(item: any, field: string): number | undefined {
    const raw = item[`@_${field}`] ?? item[field];
    if (raw === undefined || raw === null || raw === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  private static mapTournamentStatus(code: number, startDate?: string, endDate?: string): { status: TournamentStatus; statusText: string } {
    const today = new Date().toISOString().split("T")[0];

    if (code === 0) return { status: "cancelled", statusText: "Cancelled" };
    if (code === 7 || code === 8) return { status: "finished", statusText: "Finished" };
    if (code >= 2 && code <= 6) return { status: "running", statusText: "In Progress" };
    if (code === 1) {
      if (startDate && startDate <= today && (!endDate || endDate >= today)) {
        return { status: "running", statusText: "In Progress" };
      }
      return { status: "upcoming", statusText: "Upcoming" };
    }

    return { status: "unknown", statusText: "Unknown" };
  }

  private static mapMatchStatus(code: number): { status: MatchStatus; statusText: string; currentSet: number } {
    switch (code) {
      case 0:
        return { status: "cancelled", statusText: "Cancelled", currentSet: 0 };
      case 1:
        return { status: "scheduled", statusText: "Scheduled", currentSet: 0 };
      case 2:
        return { status: "break", statusText: "Before set 1", currentSet: 1 };
      case 3:
        return { status: "live", statusText: "Set 1 live", currentSet: 1 };
      case 4:
        return { status: "break", statusText: "Break before set 2", currentSet: 2 };
      case 5:
        return { status: "live", statusText: "Set 2 live", currentSet: 2 };
      case 6:
        return { status: "break", statusText: "Break before tie-break", currentSet: 3 };
      case 7:
        return { status: "live", statusText: "Tie-break live", currentSet: 3 };
      case 8:
      case 10:
        return { status: "break", statusText: "Technical break", currentSet: 0 };
      case 9:
      case 12:
      case 13:
      case 14:
      case 15:
        return { status: "finished", statusText: "Match finished", currentSet: 0 };
      case 11:
        return { status: "interrupted", statusText: "Interrupted", currentSet: 0 };
      default:
        return { status: "unknown", statusText: "Scheduled", currentSet: 0 };
    }
  }

  /**
   * Classifies tournament into Circuit (BPT / CEV / National) and Tier (Elite16 / Challenge / Futures etc.)
   */
  private static classifyTournament(
    title: string,
    typeDesc: string,
    code: string,
    countryCode: string
  ): { tier: TournamentTier; circuit: TournamentCircuit } {
    const combined = `${title} ${typeDesc} ${code}`.toLowerCase();

    // 1. Elite 16 (includes Elite, Elite16, Elite 16, BPT Finals)
    if (
      combined.includes("elite16") ||
      combined.includes("elite 16") ||
      combined.includes("elite-16") ||
      combined.includes("bpt elite") ||
      combined.includes("finals") ||
      combined.includes("the finals")
    ) {
      return { tier: "Elite16", circuit: "BPT" };
    }

    // 2. Challenge
    if (combined.includes("challenge") || combined.includes("bpt challenge")) {
      return { tier: "Challenge", circuit: "BPT" };
    }

    // 3. Futures
    if (combined.includes("future") || combined.includes("futures") || combined.includes("bpt future")) {
      return { tier: "Futures", circuit: "BPT" };
    }

    // 4. World Championships / Olympic
    if (
      combined.includes("world championship") ||
      combined.includes("wch") ||
      combined.includes("olympic") ||
      combined.includes("mistrzostwa świata")
    ) {
      return { tier: "WorldChamps", circuit: "BPT" };
    }

    // 5. CEV / Continental
    if (
      combined.includes("cev") ||
      combined.includes("european") ||
      combined.includes("eurobeach") ||
      combined.includes("mevza") ||
      combined.includes("wevza") ||
      combined.includes("nevza") ||
      combined.includes("eevza") ||
      code.startsWith("E") ||
      combined.includes("nations cup")
    ) {
      return { tier: "Continental", circuit: "CEV" };
    }

    // 6. National Tours
    if (
      combined.includes("national") ||
      combined.includes("tour") ||
      combined.includes("championship") ||
      combined.includes("mistrzostwa") ||
      combined.includes("puchar") ||
      code.length > 3
    ) {
      return { tier: "National", circuit: "National" };
    }

    return { tier: "Other", circuit: "National" };
  }
}
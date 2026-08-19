import { XMLParser } from "fast-xml-parser";
import { Tournament, Match, Team, SetScore, TournamentTier, TournamentCircuit, TournamentStatus, MatchStatus } from "./types";

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
          const roundPhase = String(item["@_RoundPhase"] ?? item.RoundPhase ?? "");
          const date = String(item["@_LocalDate"] ?? item.LocalDate ?? "");
          const rawTime = String(item["@_LocalTime"] ?? item.LocalTime ?? "");
          const time = rawTime.length >= 5 ? rawTime.slice(0, 5) : rawTime;
          const court = String(item["@_Court"] ?? item.Court ?? item["@_CourtName"] ?? item.CourtName ?? "");
          const statusCode = Number(item["@_Status"] ?? item.Status ?? 1);

          const { status, statusText, currentSet } = this.mapMatchStatus(statusCode);

          // Extract teams and countries
          const teamAName = String(item["@_TeamAName"] ?? item.TeamAName ?? "TBD");
          const teamBName = String(item["@_TeamBName"] ?? item.TeamBName ?? "TBD");
          const teamAFed = String(item["@_TeamAFederationCode"] ?? item.TeamAFederationCode ?? "");
          const teamBFed = String(item["@_TeamBFederationCode"] ?? item.TeamBFederationCode ?? "");

          const teamA = this.parseTeam(teamAName, teamAFed);
          const teamB = this.parseTeam(teamBName, teamBFed);

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

          if (set1A > 0 || set1B > 0 || currentSet >= 1 || status === "finished") {
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
            roundPhase,
            date,
            time,
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

  private static parseTeam(rawName: string, federationCode?: string): Team {
    if (!rawName || rawName === "TBD") {
      return { name: "TBD", countryCode: federationCode?.toUpperCase() || "" };
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
    };
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
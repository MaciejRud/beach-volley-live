import { RequestBuilder } from "./requestBuilder";
import { ResponseParser } from "./responseParser";
import { Tournament, Match, TeamSeed, TeamEntry, MatchStatistics, PolishTeamsSummary, LiveCenterData } from "./types";
import { isMeasured } from "./statistics";
import { globalCache } from "../cache";

export class FivbClient {
  private static readonly API_URL = "https://www.fivb.org/vis2009/XmlRequest.asmx";
  private static readonly TIMEOUT_MS = 10000;

  /**
   * Makes HTTP POST request to FIVB XML Web Service
   */
  private static async request(xml: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

      const res = await fetch(this.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
        },
        body: xml,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error(`FIVB API HTTP error: ${res.status} ${res.statusText}`);
        return null;
      }

      return await res.text();
    } catch (err: any) {
      console.error("FIVB API request error:", err?.message || err);
      return null;
    }
  }

  /**
   * Gets list of tournaments for given season (default current year)
   */
  static async getTournaments(season: number = new Date().getFullYear()): Promise<Tournament[]> {
    const cacheKey = `fivb_tournaments_${season}`;
    return globalCache.getOrSet(
      cacheKey,
      async () => {
        const xmlReq = RequestBuilder.getTournamentList(season);
        const xmlRes = await this.request(xmlReq);
        if (!xmlRes) return [];

        const tournaments = ResponseParser.parseTournaments(xmlRes);
        // Filter out test/dummy tournaments
        return tournaments.filter((t) => t.type !== "Test" && !t.title.toLowerCase().includes("test"));
      },
      3600 // 1 hour TTL
    );
  }

  /**
   * Gets matches for a specific tournament
   */
  static async getMatches(tournamentNo: string | number, tournamentMeta?: Partial<Tournament>): Promise<Match[]> {
    const cacheKey = `fivb_matches_${tournamentNo}`;
    return globalCache.getOrSet(
      cacheKey,
      async () => {
        const xmlReq = RequestBuilder.getMatchList(tournamentNo);
        const xmlRes = await this.request(xmlReq);
        if (!xmlRes) return [];

        return ResponseParser.parseMatches(xmlRes, tournamentMeta);
      },
      25 // 25 seconds TTL for live responsiveness
    );
  }

  /**
   * Gets the entry list of a tournament -- seeding plus both player ids per
   * team -- keyed by team id.
   *
   * Cached for an hour: entry lists only change when the draw is redone.
   */
  static async getTeamEntries(tournamentNo: string | number): Promise<Map<string, TeamEntry>> {
    const cacheKey = `fivb_entries_${tournamentNo}`;
    return globalCache.getOrSet(
      cacheKey,
      async () => {
        const xmlReq = RequestBuilder.getTeamList(tournamentNo);
        const xmlRes = await this.request(xmlReq);
        if (!xmlRes) return new Map<string, TeamEntry>();

        return ResponseParser.parseTeamEntries(xmlRes);
      },
      3600 // 1 hour TTL
    );
  }

  /**
   * Gets seeding for every team entered in a tournament, keyed by team id.
   *
   * Reads the cached entry list rather than issuing its own request.
   */
  static async getTeamSeeds(tournamentNo: string | number): Promise<Map<string, TeamSeed>> {
    const entries = await this.getTeamEntries(tournamentNo);
    const seeds = new Map<string, TeamSeed>();
    for (const entry of entries.values()) {
      seeds.set(entry.teamNo, { teamNo: entry.teamNo, seed: entry.seed });
    }
    return seeds;
  }

  /**
   * Gets a single match record.
   *
   * Kept on the live TTL: the caller needs the status to decide how long the
   * match's statistics may be cached.
   */
  static async getMatch(matchNo: string | number): Promise<Match | null> {
    const cacheKey = `fivb_match_${matchNo}`;
    const cached = await globalCache.getOrSet<{ match: Match | null }>(
      cacheKey,
      async () => {
        const xmlReq = RequestBuilder.getMatch(matchNo);
        const xmlRes = await this.request(xmlReq);
        if (!xmlRes) return { match: null };

        const matches = ResponseParser.parseMatches(xmlRes);
        return { match: matches[0] ?? null };
      },
      25 // 25 seconds TTL for live responsiveness
    );

    return cached.match;
  }

  /**
   * Gets one match's statistics, per set and summed over the match.
   *
   * Returns null when the match was not measured -- roughly one match in
   * fourteen. FIVB answers for those with a valid response full of zeros, so
   * the distinction has to be made here; passing the zeros on would show
   * "0 blocks" where the truth is "not recorded".
   *
   * A finished match's numbers never change, hence the two TTLs.
   */
  static async getMatchStatistics(
    matchNo: string | number,
    isFinished: boolean
  ): Promise<MatchStatistics | null> {
    const cacheKey = `fivb_match_stats_${matchNo}`;
    const cached = await globalCache.getOrSet<{ stats: MatchStatistics | null }>(
      cacheKey,
      async () => {
        const xmlReq = RequestBuilder.getMatchStatistics(matchNo);
        const xmlRes = await this.request(xmlReq);
        if (!xmlRes) return { stats: null };

        const rows = ResponseParser.parseStatistics(xmlRes);
        if (!isMeasured(rows)) return { stats: null };

        const matchRows = rows.filter((r) => r.setNumber === undefined);
        const setRows = rows
          .filter((r) => r.setNumber !== undefined)
          .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));

        return {
          stats: { matchNo: String(matchNo), match: matchRows, sets: setRows },
        };
      },
      isFinished ? 3600 : 25
    );

    return cached.stats;
  }

  /**
   * Gets a tournament's matches with entry-list seeding applied.
   *
   * Kept separate from getMatches so the live center, which spans dozens of
   * tournaments, does not pay for an extra request per tournament.
   */
  static async getMatchesWithSeeds(
    tournamentNo: string | number,
    tournamentMeta?: Partial<Tournament>
  ): Promise<Match[]> {
    const [matches, seeds] = await Promise.all([
      this.getMatches(tournamentNo, tournamentMeta),
      this.getTeamSeeds(tournamentNo),
    ]);

    if (seeds.size === 0) return matches;

    const withSeed = (team: Match["teamA"]): Match["teamA"] => {
      const entry = team.teamNo ? seeds.get(team.teamNo) : undefined;
      if (!entry) return team;
      return { ...team, seed: entry.seed };
    };

    return matches.map((m) => ({ ...m, teamA: withSeed(m.teamA), teamB: withSeed(m.teamB) }));
  }

  /**
   * Gets all live and currently running matches across all active tournaments
   */
  static async getLiveCenterData(): Promise<LiveCenterData> {
    const currentYear = new Date().getFullYear();
    const tournaments = await this.getTournaments(currentYear);

    // Active tournaments: status 'running' or date range includes today
    const today = new Date().toISOString().split("T")[0];
    const activeTournaments = tournaments.filter((t) => {
      if (t.status === "running") return true;
      if (t.startDateMain && t.endDateMain && t.startDateMain <= today && t.endDateMain >= today) return true;
      return false;
    });

    const liveMatches: Match[] = [];
    const breakMatches: Match[] = [];
    const upcomingToday: Match[] = [];

    // Fetch matches for all active tournaments in parallel
    const matchesPromises = activeTournaments.map((t) => this.getMatches(t.no, t));
    const allTournamentMatches = await Promise.all(matchesPromises);

    for (const matches of allTournamentMatches) {
      for (const m of matches) {
        if (m.status === "live") {
          liveMatches.push(m);
        } else if (m.status === "break") {
          breakMatches.push(m);
        } else if (m.status === "scheduled" && m.date === today) {
          upcomingToday.push(m);
        }
      }
    }

    // Sort live by court
    liveMatches.sort((a, b) => (a.court || "").localeCompare(b.court || ""));

    return {
      liveMatches,
      breakMatches,
      upcomingToday,
      activeTournaments,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Gets matches involving a specific country (e.g. POL)
   */
  static async getMatchesByCountry(countryCode: string = "POL", limit: number = 30): Promise<Match[]> {
    const cacheKey = `fivb_country_${countryCode}_${limit}`;
    return globalCache.getOrSet(
      cacheKey,
      async () => {
        const currentYear = new Date().getFullYear();
        const tournaments = await this.getTournaments(currentYear);

        // Scan tournaments from current and previous month or active ones
        const relevantTournaments = tournaments.filter((t) => {
          return t.status === "running" || t.status === "upcoming" || t.status === "finished";
        });

        // Sort by start date descending (newest first), then prioritize running/upcoming
        const sortedTournaments = relevantTournaments.sort((a, b) => {
          const aRunning = a.status === "running" ? 0 : a.status === "upcoming" ? 1 : 2;
          const bRunning = b.status === "running" ? 0 : b.status === "upcoming" ? 1 : 2;
          if (aRunning !== bRunning) return aRunning - bRunning;
          return (b.startDateMain || b.startDate).localeCompare(a.startDateMain || a.startDate);
        });

        // Limit search to top 25 most relevant tournaments to avoid hammering API
        const topTournaments = sortedTournaments.slice(0, 25);
        const matchesPromises = topTournaments.map((t) => this.getMatches(t.no, t));
        const results = await Promise.all(matchesPromises);

        const countryMatches: Match[] = [];
        for (const list of results) {
          for (const m of list) {
            if (m.teamA.countryCode === countryCode || m.teamB.countryCode === countryCode) {
              countryMatches.push(m);
            }
          }
        }

        // Sort: Live first, then upcoming (nearest date/time), then finished (newest first)
        countryMatches.sort((a, b) => {
          if (a.status === "live" && b.status !== "live") return -1;
          if (a.status !== "live" && b.status === "live") return 1;

          const dtA = `${a.date} ${a.time}`;
          const dtB = `${b.date} ${b.time}`;
          return dtB.localeCompare(dtA);
        });

        return countryMatches.slice(0, limit);
      },
      60 // 1 minute TTL
    );
  }

  /**
   * Returns structured Polish teams dashboard data
   */
  static async getPolishTeamsSummary(): Promise<PolishTeamsSummary> {
    const matches = await this.getMatchesByCountry("POL", 40);

    const activeMatches = matches.filter((m) => m.status === "live" || m.status === "break");
    const upcomingMatches = matches.filter((m) => m.status === "scheduled");
    const recentMatches = matches.filter((m) => m.status === "finished").slice(0, 15);

    const tournamentIds = new Set(matches.map((m) => m.tournamentId));
    const allTournaments = await this.getTournaments(new Date().getFullYear());
    const tournamentsInvolved = allTournaments.filter((t) => tournamentIds.has(t.no));

    return {
      activeMatches,
      upcomingMatches,
      recentMatches,
      tournamentsInvolved,
      lastUpdated: new Date().toISOString(),
    };
  }
}
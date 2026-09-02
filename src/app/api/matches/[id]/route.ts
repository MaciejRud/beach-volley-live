import { NextResponse } from "next/server";
import { FivbClient } from "@/lib/fivb/client";
import { seasonAveragesFor } from "@/lib/stats/seasonAverages";

export const dynamic = "force-dynamic";

/**
 * One match with its entry-list roster and, when the match was measured, its
 * statistics.
 *
 * Match, roster and statistics come back together because the caching depends
 * on the match: a finished match's numbers are frozen, a live one's change
 * every rally.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const matchNo = Number(id);
    if (!Number.isInteger(matchNo) || matchNo <= 0) {
      return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
    }

    const match = await FivbClient.getMatch(matchNo);
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    const isFinished = match.status === "finished";

    const [stats, entries] = await Promise.all([
      FivbClient.getMatchStatistics(matchNo, isFinished),
      match.tournamentId
        ? FivbClient.getTeamEntries(match.tournamentId)
        : Promise.resolve(new Map()),
    ]);

    const roster = {
      teamA: match.teamA.teamNo ? entries.get(match.teamA.teamNo) ?? null : null,
      teamB: match.teamB.teamNo ? entries.get(match.teamB.teamNo) ?? null : null,
    };

    // Season context for the four players, so a match number can be read
    // against what they usually do. Empty when the archive has nothing on them
    // -- a qualifier, or a season not yet backfilled.
    const playerNos = [roster.teamA, roster.teamB]
      .flatMap((entry) => [entry?.player1?.no, entry?.player2?.no])
      .filter((no): no is string => Boolean(no));

    const season = Number((match.date || "").slice(0, 4)) || new Date().getFullYear();
    const seasonAverages =
      playerNos.length > 0 ? await seasonAveragesFor(playerNos, season) : {};

    // Statistics are null for unmeasured matches -- about one in fourteen. The
    // flag spares every caller from re-deriving the reason from an absent body.
    return NextResponse.json(
      { match, roster, stats, seasonAverages, season, hasStatistics: stats !== null },
      {
        headers: {
          "Cache-Control": isFinished
            ? "public, s-maxage=1800, stale-while-revalidate=3600"
            : "public, s-maxage=25, stale-while-revalidate=50",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch match detail" },
      { status: 500 }
    );
  }
}

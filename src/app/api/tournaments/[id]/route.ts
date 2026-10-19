import { NextResponse } from "next/server";
import { FivbClient } from "@/lib/fivb/client";
import { groupEntries } from "@/lib/fivb/entryList";
import { playersWithPages } from "@/lib/stats/playerProfile";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const season = new Date().getFullYear();
    const all = await FivbClient.getTournaments(season);
    const tournament = all.find((t) => t.no === id || t.id === id);

    const matches = await FivbClient.getMatchesWithSeeds(id, tournament);
    // After the matches, not alongside: getMatchesWithSeeds has just cached the
    // entry list, and globalCache does not merge concurrent misses, so running
    // the two together would send FIVB the same request twice.
    const [entries, linkable] = await Promise.all([FivbClient.getTeamEntries(id), playersWithPages()]);
    const entryGroups = groupEntries(entries.values(), linkable);

    return NextResponse.json({ tournament, matches, count: matches.length, entryGroups }, {
      headers: {
        "Cache-Control": "public, s-maxage=25, stale-while-revalidate=50",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch tournament detail" }, { status: 500 });
  }
}
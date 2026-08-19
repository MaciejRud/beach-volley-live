import { NextResponse } from "next/server";
import { FivbClient } from "@/lib/fivb/client";

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

    return NextResponse.json({ tournament, matches, count: matches.length }, {
      headers: {
        "Cache-Control": "public, s-maxage=25, stale-while-revalidate=50",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch tournament detail" }, { status: 500 });
  }
}
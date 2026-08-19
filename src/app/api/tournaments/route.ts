import { NextResponse } from "next/server";
import { FivbClient } from "@/lib/fivb/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const season = Number(searchParams.get("season") || new Date().getFullYear());
    const tournaments = await FivbClient.getTournaments(season);

    return NextResponse.json({ tournaments, count: tournaments.length }, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch tournaments" }, { status: 500 });
  }
}
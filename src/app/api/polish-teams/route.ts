import { NextResponse } from "next/server";
import { FivbClient } from "@/lib/fivb/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await FivbClient.getPolishTeamsSummary();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch Polish teams" }, { status: 500 });
  }
}
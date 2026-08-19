import { NextResponse } from "next/server";
import { FivbClient } from "@/lib/fivb/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await FivbClient.getLiveCenterData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch live data" }, { status: 500 });
  }
}
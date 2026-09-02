import { NextResponse } from "next/server";
import { loadPlayerIndex } from "@/lib/stats/playerProfile";

export const dynamic = "force-dynamic";

/**
 * The searchable player index.
 *
 * Served whole -- roughly 95 KB for 1363 players -- so the browser can filter
 * as the visitor types without a request per keystroke. It only changes when
 * the archive is rebuilt and redeployed, hence the long cache.
 */
export async function GET() {
  const index = await loadPlayerIndex();

  if (!index) {
    return NextResponse.json(
      { seasons: [], players: [], error: "Player archive has not been built" },
      { status: 503 }
    );
  }

  return NextResponse.json(index, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}

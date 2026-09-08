import { NextRequest, NextResponse } from "next/server";
import { CountryHelper, DEFAULT_COUNTRY } from "@/lib/countryHelper";
import { FivbClient } from "@/lib/fivb/client";

export const dynamic = "force-dynamic";

/**
 * One country's matches across the current tournament window.
 *
 * The country arrives from the query string, so it is coerced before it goes
 * anywhere near a FIVB request: normalised through CountryHelper, then accepted
 * only as three letters. A shape check rather than an allowlist on purpose --
 * the federations on tour change, and a code we happen to have no flag for
 * still deserves its matches -- but it is enough that nothing except a
 * federation code can ever reach the upstream query.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("country") ?? DEFAULT_COUNTRY;
  const code = CountryHelper.getCountryCode(raw);

  if (!/^[A-Z]{3}$/.test(code)) {
    return NextResponse.json({ error: "Invalid country code" }, { status: 400 });
  }

  try {
    const data = await FivbClient.getCountrySummary(code);
    return NextResponse.json(data, {
      headers: {
        // At or below the 60 s in-memory TTL, per the cache table in CLAUDE.md.
        "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch matches for this country" },
      { status: 500 }
    );
  }
}

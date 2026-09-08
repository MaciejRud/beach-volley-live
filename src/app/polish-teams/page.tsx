"use client";

import { useEffect, useState, useCallback } from "react";
import { CountrySummary } from "@/lib/fivb/types";
import { MatchTable } from "@/components/MatchTable";
import { CountryPicker } from "@/components/CountryPicker";
import { CountryFlag } from "@/components/CountryFlag";
import { CountryHelper } from "@/lib/countryHelper";
import { useCountry } from "@/lib/countryContext";

/**
 * One country's matches across the tour.
 *
 * Opens on Poland and stays wherever the reader puts it for the rest of the
 * session. The URL is still /polish-teams: the page is linked from elsewhere
 * and bookmarked, and breaking those to match a rename would cost more than
 * the tidier path is worth.
 */
export default function CountryZonePage() {
  const { country, ready } = useCountry();
  const [summary, setSummary] = useState<CountrySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(
    async (code: string, silent: boolean = false) => {
      try {
        if (!silent) setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/country-matches?country=${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error("Failed to fetch matches for this country");
        const json: CountrySummary = await res.json();
        // A slow response for a country the reader has already moved on from
        // would otherwise overwrite the one they are looking at.
        setSummary((current) => (json.countryCode === code ? json : current));
      } catch (err: any) {
        setError(err?.message || "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // Wait for the stored choice: fetching Poland first would show the wrong
    // country for a beat and cost a request nobody asked for.
    if (!ready) return;
    fetchSummary(country);
    const interval = setInterval(() => fetchSummary(country, true), 30000);
    return () => clearInterval(interval);
  }, [country, ready, fetchSummary]);

  const activeMatches = summary?.activeMatches || [];
  const upcomingMatches = summary?.upcomingMatches || [];
  const recentMatches = summary?.recentMatches || [];
  const allMatches = [...activeMatches, ...upcomingMatches, ...recentMatches];
  const countryName = CountryHelper.getCountryName(country);

  return (
    <div className="space-y-4">
      <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-xs">
        {/* Title and control share one row at every width; the description
            goes underneath, where it can wrap without pushing the button off
            the line. */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex min-w-0 items-center gap-2 text-base sm:text-lg font-black text-slate-900 tracking-tight">
            <CountryFlag code={country} className="shrink-0" />
            <span className="truncate">{countryName} Zone</span>
          </h1>
          <CountryPicker available={summary?.availableCountries ?? []} />
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          All matches of {countryName} representatives in FIVB &amp; Beach Pro Tour events
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {activeMatches.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 px-1">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
            <span>{countryName} matches currently live</span>
          </div>
          <MatchTable matches={activeMatches} title="🔴 Live" showTournamentColumn />
        </div>
      )}

      {isLoading ? (
        <div className="bg-white p-10 text-center rounded-lg border border-slate-200">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading {countryName} matches…</p>
        </div>
      ) : allMatches.length === 0 ? (
        /* An empty country is a real answer, not a failure -- most federations
           are idle most weeks. Saying so beats an empty table. */
        <div className="bg-white p-8 text-center rounded-lg border border-slate-200">
          <p className="text-sm font-bold text-slate-900">
            No {countryName} matches in the current tournaments.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            This covers the events running, coming up and just finished. Pick another country
            above to see who is playing.
          </p>
        </div>
      ) : (
        <MatchTable
          matches={allMatches}
          title={`${countryName} duos matches (Live, Scheduled & Recent)`}
          showTournamentColumn
          groupByDay
        />
      )}
    </div>
  );
}

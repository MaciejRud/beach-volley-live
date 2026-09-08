"use client";

import { useEffect, useState, useCallback } from "react";
import { Tournament, Match, CountrySummary, LiveCenterData } from "@/lib/fivb/types";
import { useCountry } from "@/lib/countryContext";
import { TournamentTable } from "@/components/TournamentTable";
import { LiveTickerBar } from "@/components/LiveTickerBar";
import { Trophy, Calendar, Flag, Activity } from "lucide-react";

export default function CalendarHomePage() {
  const { country, ready } = useCountry();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [liveData, setLiveData] = useState<LiveCenterData | null>(null);
  const [countrySummary, setCountrySummary] = useState<CountrySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (code: string, silent: boolean = false) => {
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const [tourRes, liveRes, countryRes] = await Promise.all([
        fetch("/api/tournaments"),
        fetch("/api/live"),
        fetch(`/api/country-matches?country=${encodeURIComponent(code)}`),
      ]);

      if (tourRes.ok) {
        const tJson = await tourRes.json();
        setTournaments(tJson.tournaments || []);
      }
      if (liveRes.ok) {
        const lJson = await liveRes.json();
        setLiveData(lJson);
      }
      if (countryRes.ok) {
        const pJson: CountrySummary = await countryRes.json();
        // Ignore a response for a country the reader has already left.
        setCountrySummary((current) => (pJson.countryCode === code ? pJson : current));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Wait for the stored country: fetching Poland first would cost a request
    // the reader never asked for.
    if (!ready) return;
    loadData(country);
    // Silent background refresh every 30 seconds -- no full reload
    const interval = setInterval(() => loadData(country, true), 30000);
    return () => clearInterval(interval);
  }, [country, ready, loadData]);

  const liveMatches = liveData?.liveMatches || [];
  const activeCountryCount =
    (countrySummary?.activeMatches?.length || 0) + (countrySummary?.upcomingMatches?.length || 0);

  const upcomingCount = tournaments.filter((t) => t.status === "upcoming").length;

  return (
    <div className="space-y-4">
      {/* Live Ticker Bar */}
      <LiveTickerBar liveMatches={liveMatches} countryMatchesCount={activeCountryCount} />

      {/* Top Header & Season Summary */}
      <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Beach Volleyball Tournament Calendar {new Date().getFullYear()}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Beach Pro Tour (Elite 16, Challenge, Futures), CEV & National Tours
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Grouped Tournament Categories Table */}
      <TournamentTable tournaments={tournaments} isLoading={isLoading} />
    </div>
  );
}
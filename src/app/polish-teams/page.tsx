"use client";

import { useEffect, useState, useCallback } from "react";
import { PolishTeamsSummary, Match } from "@/lib/fivb/types";
import { MatchTable } from "@/components/MatchTable";

export default function PolishTeamsPage() {
  const [summary, setSummary] = useState<PolishTeamsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (silent: boolean = false) => {
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const res = await fetch("/api/polish-teams");
      if (!res.ok) throw new Error("Failed to fetch Polish teams data");
      const json = await res.json();
      setSummary(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    // Silent background refresh every 30 seconds -- no full reload
    const interval = setInterval(() => fetchSummary(true), 30000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  const activeMatches = summary?.activeMatches || [];
  const upcomingMatches = summary?.upcomingMatches || [];
  const recentMatches = summary?.recentMatches || [];
  const allPolishMatches = [...activeMatches, ...upcomingMatches, ...recentMatches];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-xs">
        <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
          Poland Zone
        </h1>
        <p className="text-xs text-slate-500">
          All matches of Polish representatives in FIVB & Beach Pro Tour events
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Active Live Matches */}
      {activeMatches.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 px-1">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
            <span>Polish matches currently live</span>
          </div>
          <MatchTable matches={activeMatches} title="🔴 Live" showTournamentColumn />
        </div>
      )}

      {/* Main Polish Matches Table */}
      {isLoading ? (
        <div className="bg-white p-10 text-center rounded-lg border border-slate-200">
          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading Polish teams matches...</p>
        </div>
      ) : (
        <MatchTable
          matches={allPolishMatches}
          title="Polish duos matches (Live, Scheduled & Recent)"
         
          showTournamentColumn
          groupByDay
        />
      )}
    </div>
  );
}

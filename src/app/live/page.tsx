"use client";

import { useEffect, useState, useCallback } from "react";
import { LiveCenterData } from "@/lib/fivb/types";
import { MatchTable } from "@/components/MatchTable";
import { Radio, RefreshCw } from "lucide-react";

export default function LiveCenterPage() {
  const [data, setData] = useState<LiveCenterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLive = useCallback(async (silent: boolean = false) => {
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const res = await fetch("/api/live");
      if (!res.ok) throw new Error("Failed to fetch live matches");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    // Silent background refresh every 20 seconds -- no full reload
    const interval = setInterval(() => fetchLive(true), 20000);
    return () => clearInterval(interval);
  }, [fetchLive]);

  const liveMatches = data?.liveMatches || [];
  const breakMatches = data?.breakMatches || [];
  const upcomingToday = data?.upcomingToday || [];
  const inProgress = [...liveMatches, ...breakMatches];
  const allCurrent = [...inProgress, ...upcomingToday];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              Live Match Center
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            </h1>
            <p className="text-xs text-slate-500">
              Live and scheduled matches for today with real-time scoring
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchLive(true)}
          disabled={isRefreshing}
          className="p-1.5 rounded hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          title="Refresh results"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Match Tables */}
      {isLoading ? (
        <div className="bg-white p-10 text-center rounded-lg border border-slate-200">
          <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Querying FIVB servers for live matches...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inProgress.length > 0 && (
            <MatchTable matches={inProgress} title="🔴 Matches in progress (LIVE)" showTournamentColumn />
          )}

          {upcomingToday.length > 0 && (
            <MatchTable matches={upcomingToday} title="📅 Scheduled for today" showTournamentColumn />
          )}

          {allCurrent.length === 0 && (
            <div className="bg-white p-8 text-center rounded-lg border border-slate-200 text-slate-400 text-xs">
              <span className="text-2xl block mb-1">🏖️</span>
              No live matches at the moment. Check the main tournament calendar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

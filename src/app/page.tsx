"use client";

import { useEffect, useState, useCallback } from "react";
import { Tournament, Match, PolishTeamsSummary, LiveCenterData } from "@/lib/fivb/types";
import { TournamentTable } from "@/components/TournamentTable";
import { LiveTickerBar } from "@/components/LiveTickerBar";
import { Trophy, Calendar, Flag, Activity } from "lucide-react";

export default function CalendarHomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [liveData, setLiveData] = useState<LiveCenterData | null>(null);
  const [polishSummary, setPolishSummary] = useState<PolishTeamsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (silent: boolean = false) => {
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const [tourRes, liveRes, polRes] = await Promise.all([
        fetch("/api/tournaments"),
        fetch("/api/live"),
        fetch("/api/polish-teams"),
      ]);

      if (tourRes.ok) {
        const tJson = await tourRes.json();
        setTournaments(tJson.tournaments || []);
      }
      if (liveRes.ok) {
        const lJson = await liveRes.json();
        setLiveData(lJson);
      }
      if (polRes.ok) {
        const pJson = await polRes.json();
        setPolishSummary(pJson);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Silent background refresh every 30 seconds -- no full reload
    const interval = setInterval(() => loadData(true), 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const liveMatches = liveData?.liveMatches || [];
  const activePolishCount =
    (polishSummary?.activeMatches?.length || 0) + (polishSummary?.upcomingMatches?.length || 0);

  const upcomingCount = tournaments.filter((t) => t.status === "upcoming").length;

  return (
    <div className="space-y-4">
      {/* Live Ticker Bar */}
      <LiveTickerBar liveMatches={liveMatches} polishMatchesCount={activePolishCount} />

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
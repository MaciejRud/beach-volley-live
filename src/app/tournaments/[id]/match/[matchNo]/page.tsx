"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Match, MatchStatistics, TeamEntry } from "@/lib/fivb/types";
import { CountryFlag } from "@/components/CountryFlag";
import { MatchTime } from "@/components/MatchTime";
import { MatchStats } from "@/components/MatchStats";
import { StatTotals } from "@/lib/stats/aggregate";

interface MatchResponse {
  match: Match;
  roster: { teamA: TeamEntry | null; teamB: TeamEntry | null };
  stats: MatchStatistics | null;
  seasonAverages: Record<string, StatTotals>;
  season: number;
  hasStatistics: boolean;
}

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string; matchNo: string }>;
}) {
  const { id: tournamentId, matchNo } = use(params);

  const [data, setData] = useState<MatchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMatch = async (silent: boolean) => {
      try {
        if (!silent) setIsLoading(true);
        const res = await fetch(`/api/matches/${matchNo}`);
        if (!res.ok) throw new Error(res.status === 404 ? "Match not found" : "Failed to load match");
        const json: MatchResponse = await res.json();
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Failed to load match");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchMatch(false);
    // A finished match never changes again, so only live ones keep polling.
    const interval = setInterval(() => {
      if (data?.match.status !== "finished") fetchMatch(true);
    }, 25000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchNo]);

  const match = data?.match;
  const isLive = match?.status === "live" || match?.status === "break";

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/tournaments/${tournamentId}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to tournament</span>
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {isLoading && !match && (
        <div className="bg-white p-10 text-center rounded-lg border border-slate-200">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading match...</p>
        </div>
      )}

      {match && (
        <>
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-slate-200 shadow-xs space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              {match.matchNumber && <span className="font-mono font-bold">M{match.matchNumber}</span>}
              {match.roundName && <span>{match.roundName}</span>}
              {match.court && <span>• Court {match.court}</span>}
              <span>•</span>
              <MatchTime match={match} className="font-mono font-bold text-slate-600" />
              {isLive && (
                <span className="inline-flex items-center gap-1 font-bold text-red-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  Live
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="min-w-0 flex-1 flex items-center justify-end gap-2 text-right">
                <span
                  className={`min-w-0 truncate text-sm sm:text-base text-slate-900 ${
                    match.winner === "A" ? "font-black" : "font-semibold"
                  }`}
                >
                  {match.teamA.name}
                </span>
                <CountryFlag code={match.teamA.countryCode} className="text-base shrink-0" />
              </div>

              <span className="shrink-0 font-mono text-lg sm:text-xl font-black text-slate-900 tabular-nums">
                {match.setsWonA}:{match.setsWonB}
              </span>

              <div className="min-w-0 flex-1 flex items-center gap-2">
                <CountryFlag code={match.teamB.countryCode} className="text-base shrink-0" />
                <span
                  className={`min-w-0 truncate text-sm sm:text-base text-slate-900 ${
                    match.winner === "B" ? "font-black" : "font-semibold"
                  }`}
                >
                  {match.teamB.name}
                </span>
              </div>
            </div>

            {match.sets.length > 0 && (
              <div className="flex items-center justify-center gap-2 font-mono text-xs tabular-nums">
                {match.sets.map((set) => (
                  <span
                    key={set.setNumber}
                    className={`px-1.5 py-0.5 rounded ${
                      set.isFinished ? "bg-slate-100 text-slate-600" : "bg-red-50 text-red-600 font-bold"
                    }`}
                  >
                    {set.scoreA}:{set.scoreB}
                    {set.duration ? (
                      <span className="ml-1 text-slate-400">{Math.round(set.duration / 60)}&#39;</span>
                    ) : null}
                  </span>
                ))}
              </div>
            )}
          </div>

          {data?.stats ? (
            <MatchStats
              match={match}
              roster={data.roster}
              stats={data.stats}
              seasonAverages={data.seasonAverages}
              season={data.season}
            />
          ) : (
            // Roughly one match in fourteen is played without a statistician;
            // FIVB reports those as zeros, which would read as a shut-out.
            <div className="bg-white p-4 rounded-lg border border-slate-200 text-xs text-slate-500">
              No statistics were recorded for this match. The result above is complete;
              the per-player numbers were simply never collected.
            </div>
          )}
        </>
      )}
    </div>
  );
}

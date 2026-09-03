"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { Tournament, Match } from "@/lib/fivb/types";
import { CountryHelper } from "@/lib/countryHelper";
import { CountryFlag } from "@/components/CountryFlag";
import { MatchTable } from "@/components/MatchTable";
import { groupByDraw } from "@/lib/fivb/phases";
import { ArrowLeft } from "lucide-react";

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const tournamentId = resolvedParams.id;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every tier ships the draw structure -- Beach Pro Tour, continental
  // championships and national tours alike -- so the split is gated on the
  // data rather than on a list of tiers. groupByDraw returns nothing where a
  // feed omits it, and the flat list below takes over.
  const drawGroups = useMemo(() => groupByDraw(matches), [matches]);

  const fetchDetail = async (silent: boolean = false) => {
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const res = await fetch(`/api/tournaments/${tournamentId}`);
      if (!res.ok) throw new Error("Failed to fetch tournament");
      const json = await res.json();
      setTournament(json.tournament || null);
      setMatches(json.matches || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load tournament data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // Silent background refresh every 25 seconds -- no full reload
    const interval = setInterval(() => fetchDetail(true), 25000);
    return () => clearInterval(interval);
  }, [tournamentId]);

  return (
    <div className="space-y-4">
      {/* Back link */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to calendar</span>
        </Link>
      </div>

      {/* Compact Header */}
      {tournament && (
        <div className="bg-white p-3 sm:p-4 rounded-lg border border-slate-200 shadow-xs">
          <div className="space-y-0.5">
            <h1 className="text-base sm:text-lg font-black text-slate-900">{tournament.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
              <span className="flex items-center gap-1 font-medium">
                <CountryFlag code={tournament.countryCode} className="text-sm" />
                <span>
                  {tournament.city ? `${tournament.city}, ` : ""}
                  {CountryHelper.getCountryName(tournament.countryCode)}
                </span>
              </span>
              <span>•</span>
              <span>{tournament.startDateMain || tournament.startDate} - {tournament.endDateMain || tournament.endDate}</span>
              <span>•</span>
              <span>Gender: {tournament.gender === "M" ? "Men" : tournament.gender === "W" ? "Women" : "M & W"}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Match Table */}
      {isLoading ? (
        <div className="bg-white p-10 text-center rounded-lg border border-slate-200">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading match list...</p>
        </div>
      ) : drawGroups.length > 0 ? (
        <div className="space-y-5">
          {drawGroups.map((group) => (
            <section key={group.section} className="space-y-2.5">
              <h2 className="text-sm font-black text-slate-900 tracking-tight">
                Results {group.title}
              </h2>
              {group.blocks.map((block) => (
                <div key={block.kind} className="space-y-2.5">
                  {group.showBlockTitles && (
                    <h3 className="pt-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      {block.title}
                    </h3>
                  )}
                  {block.phases.map((phase) => (
                    <MatchTable
                      key={`${group.section}-${phase.name}`}
                      matches={phase.matches}
                      title={phase.label}
                      subtitle={phase.stake}
                      hidePhase
                    />
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <MatchTable matches={matches} title="Tournament matches" />
      )}
    </div>
  );
}

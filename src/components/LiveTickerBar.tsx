"use client";

import Link from "next/link";
import { Match } from "@/lib/fivb/types";
import { isProminentMatch, matchProminenceRank } from "@/lib/fivb/prominence";
import { Radio, ArrowRight } from "lucide-react";

interface Props {
  liveMatches: Match[];
  polishMatchesCount: number;
}

export function LiveTickerBar({ liveMatches, polishMatchesCount }: Props) {
  // The ticker is deliberately narrow: Beach Pro Tour and the senior European
  // Championship only. National tours would otherwise crowd out the events
  // people actually follow.
  const tickerMatches = liveMatches
    .filter(isProminentMatch)
    .sort((a, b) => matchProminenceRank(a) - matchProminenceRank(b));

  if (tickerMatches.length === 0 && polishMatchesCount === 0) {
    return null;
  }

  return (
    <div className="bg-red-50/80 border border-red-200 rounded-lg px-3 py-1.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar min-w-0">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white font-extrabold text-[9px] uppercase tracking-wider shrink-0">
          <Radio className="w-2.5 h-2.5 animate-pulse" />
          <span>LIVE</span>
        </span>

        {tickerMatches.map((m) => {
          const currentSet = m.sets[m.sets.length - 1];
          const hasScore = currentSet && (currentSet.scoreA > 0 || currentSet.scoreB > 0);
          const isTeamAPolish = m.teamA.countryCode === "POL";
          const isTeamBPolish = m.teamB.countryCode === "POL";
          return (
            <Link
              key={m.id}
              href={`/tournaments/${m.tournamentId}`}
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-white border border-red-200 hover:border-red-300 shrink-0 transition-colors shadow-xs"
            >
              <span className={`text-[10px] text-slate-800 ${isTeamAPolish ? "font-extrabold text-red-700" : "font-medium"}`}>
                {m.teamA.name}
              </span>
              <span className="flex items-center gap-0.5 font-mono">
                <span className="text-[9px] font-bold text-slate-400">{m.setsWonA}</span>
                <span className="text-[11px] font-extrabold text-red-600 bg-red-50 px-0.5 rounded">
                  {hasScore ? `${currentSet.scoreA}:${currentSet.scoreB}` : "0:0"}
                </span>
                <span className="text-[9px] font-bold text-slate-400">{m.setsWonB}</span>
              </span>
              <span className={`text-[10px] text-slate-800 ${isTeamBPolish ? "font-extrabold text-red-700" : "font-medium"}`}>
                {m.teamB.name}
              </span>
            </Link>
          );
        })}

        {tickerMatches.length === 0 && polishMatchesCount > 0 && (
          <span className="text-[10px] text-red-800 font-medium truncate">
            Polish duos matches today ({polishMatchesCount} scheduled).
          </span>
        )}
      </div>

      <Link
        href="/live"
        className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-red-700 hover:text-red-900 transition-colors"
      >
        <span>All live</span>
        <ArrowRight className="w-2.5 h-2.5" />
      </Link>
    </div>
  );
}

"use client";

import { Match } from "@/lib/fivb/types";
import { CountryFlag } from "./CountryFlag";
import { Radio, Clock, MapPin, Trophy } from "lucide-react";

interface Props {
  match: Match;
  highlightPolish?: boolean;
}

export function LiveMatchCard({ match, highlightPolish = true }: Props) {
  const isTeamAPolish = match.teamA.countryCode === "POL";
  const isTeamBPolish = match.teamB.countryCode === "POL";
  const hasPolishTeam = isTeamAPolish || isTeamBPolish;

  const isLive = match.status === "live";
  const isBreak = match.status === "break";
  const isFinished = match.status === "finished";

  return (
    <div
      className={`glass-card rounded-xl p-4 sm:p-5 relative overflow-hidden transition-all ${
        hasPolishTeam && highlightPolish ? "polish-gradient-border border-red-500/30 bg-red-950/10" : ""
      }`}
    >
      {/* Header: Tournament + Court / Round + Live Badge */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10 text-xs">
        <div className="flex items-center gap-1.5 text-gray-300 font-medium truncate">
          <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{match.tournamentTitle || "Turniej FIVB"}</span>
          {match.tournamentCity && (
            <span className="text-gray-500 hidden sm:inline">• {match.tournamentCity}</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/40">
              <span className="w-2 h-2 rounded-full bg-red-500 live-pulse"></span>
              LIVE {match.statusText}
            </span>
          ) : isBreak ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Clock className="w-3 h-3" />
              {match.statusText}
            </span>
          ) : isFinished ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-700/50 text-gray-300 border border-gray-600/30">
              Finished
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {match.time ? `${match.time}` : "Scheduled"}
            </span>
          )}
        </div>
      </div>

      {/* Match Body: Team A vs Team B */}
      <div className="space-y-3">
        {/* Team A */}
        <div className="flex items-center gap-2.5 min-w-0">
          <CountryFlag code={match.teamA.countryCode} className="text-lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-semibold text-sm sm:text-base truncate ${
                  isTeamAPolish ? "text-red-300 font-bold" : "text-white"
                } ${match.winner === "A" ? "text-amber-300 font-bold" : ""}`}
              >
                {match.teamA.name}
              </span>
              {isTeamAPolish && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-red-600 text-white shrink-0">
                  POL
                </span>
              )}
            </div>
            {(match.teamA.player1 || match.teamA.player2) && (
              <p className="text-[11px] text-gray-400 truncate">
                {match.teamA.player1} {match.teamA.player2 ? `/ ${match.teamA.player2}` : ""}
              </p>
            )}
          </div>
        </div>

        {/* Team B */}
        <div className="flex items-center gap-2.5 min-w-0">
          <CountryFlag code={match.teamB.countryCode} className="text-lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`font-semibold text-sm sm:text-base truncate ${
                  isTeamBPolish ? "text-red-300 font-bold" : "text-white"
                } ${match.winner === "B" ? "text-amber-300 font-bold" : ""}`}
              >
                {match.teamB.name}
              </span>
              {isTeamBPolish && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-red-600 text-white shrink-0">
                  POL
                </span>
              )}
            </div>
            {(match.teamB.player1 || match.teamB.player2) && (
              <p className="text-[11px] text-gray-400 truncate">
                {match.teamB.player1} {match.teamB.player2 ? `/ ${match.teamB.player2}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Score Row: [setsWonA]  currentSetScore  [setsWonB] */}
      {(() => {
        const currentSet = match.sets[match.sets.length - 1];
        const hasScore = currentSet && (currentSet.scoreA > 0 || currentSet.scoreB > 0 || isFinished);
        const scoreColor = isLive
          ? "text-red-500 font-bold"
          : isFinished
          ? "text-gray-300"
          : "text-white";

        return (
          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center justify-center gap-4 sm:gap-6">
              {/* Sets won - Team A (left/outer, smaller) */}
              <span
                className={`text-lg font-bold font-mono ${
                  match.winner === "A" ? "text-amber-300" : "text-white/70"
                }`}
              >
                {match.setsWonA}
              </span>

              {/* Current set score - center, prominent */}
              <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${scoreColor}`}>
                {hasScore ? `${currentSet.scoreA}:${currentSet.scoreB}` : "0:0"}
              </span>

              {/* Sets won - Team B (right/outer, smaller) */}
              <span
                className={`text-lg font-bold font-mono ${
                  match.winner === "B" ? "text-amber-300" : "text-white/70"
                }`}
              >
                {match.setsWonB}
              </span>
            </div>

            {/* Set-by-set breakdown + court info */}
            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2">
              <div className="flex items-center gap-1">
                <span>Court: <strong>{match.court || "Main"}</strong></span>
                {match.roundName && <span className="text-gray-500">• {match.roundName}</span>}
              </div>

              {match.sets.length > 0 && (
                <div className="flex items-center gap-1 font-mono">
                  {match.sets.map((set, idx) => (
                    <span
                      key={idx}
                      className={`px-1.5 py-0.5 rounded border text-[10px] ${
                        set.isFinished
                          ? "text-gray-400 bg-white/5 border-white/5"
                          : "text-amber-400 font-bold border-amber-500/30 bg-amber-500/10"
                      }`}
                    >
                      {set.scoreA}:{set.scoreB}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
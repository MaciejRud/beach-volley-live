"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Match } from "@/lib/fivb/types";
import { CountryHelper } from "@/lib/countryHelper";
import { CountryFlag } from "./CountryFlag";

interface Props {
  matches: Match[];
  title?: string;
  defaultOnlyPolish?: boolean;
  showTournamentColumn?: boolean;
}

export function MatchTable({ matches, title, defaultOnlyPolish = false, showTournamentColumn = false }: Props) {
  const [onlyPolish, setOnlyPolish] = useState(defaultOnlyPolish);
  const [selectedRound, setSelectedRound] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const rounds = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      if (m.roundName) set.add(m.roundName);
    }
    return Array.from(set);
  }, [matches]);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (onlyPolish && !m.isPolishMatch) return false;
      if (selectedRound !== "all" && m.roundName !== selectedRound) return false;
      if (selectedStatus === "live" && m.status !== "live" && m.status !== "break") return false;
      if (selectedStatus === "finished" && m.status !== "finished") return false;
      if (selectedStatus === "scheduled" && m.status !== "scheduled") return false;
      return true;
    });
  }, [matches, onlyPolish, selectedRound, selectedStatus]);

  const formatSetsString = (match: Match) => {
    if (!match.sets || match.sets.length === 0) return "";
    return match.sets
      .map((s) => `${s.scoreA}:${s.scoreB}`)
      .join(", ");
  };

  const renderSetScores = (match: Match) => {
    if (!match.sets || match.sets.length === 0) return <span className="text-slate-300">-</span>;
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11px]">
        {match.sets.map((set, idx) => (
          <span key={idx} className={set.isFinished ? "text-slate-500" : "text-red-600 font-bold"}>
            {set.scoreA}:{set.scoreB}
          </span>
        ))}
      </span>
    );
  };

  const renderMatchCards = () => {
    if (filtered.length === 0) {
      return (
        <div className="py-4 text-center text-slate-400 text-xs">
          No matches for the selected criteria.
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100">
        {filtered.map((m) => {
          const isTeamAPolish = m.teamA.countryCode === "POL";
          const isTeamBPolish = m.teamB.countryCode === "POL";
          const isLive = m.status === "live" || m.status === "break";
          const isFinished = m.status === "finished";

          return (
            <Link
              key={m.id}
              href={`/tournaments/${m.tournamentId}`}
              className={`block px-3 py-2.5 transition-colors ${
                isLive ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-slate-50"
              }`}
            >
              {/* Top row: M# / time / phase / status */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                  {m.matchNumber && <span className="font-bold">M{m.matchNumber}</span>}
                  <span className="font-bold text-slate-600">{m.time || "-"}</span>
                  {m.court && <span>C{m.court}</span>}
                  {m.roundName && <span className="text-slate-400">• {m.roundName}</span>}
                </div>
                {isLive ? (
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-red-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                    LIVE
                  </span>
                ) : isFinished ? (
                  <span className="text-[9px] text-slate-400">Done</span>
                ) : (
                  <span className="text-[9px] text-blue-600">Plan</span>
                )}
              </div>

              {/* Tournament name (if enabled) */}
              {showTournamentColumn && m.tournamentTitle && (
                <div className="text-[10px] text-slate-500 font-medium mb-1.5 truncate">
                  {m.tournamentTitle}
                </div>
              )}

              {/* Score row */}
              <div className="flex items-center justify-between gap-2">
                {/* Team A */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                  <span
                    className={`truncate text-xs ${
                      isTeamAPolish ? "text-red-700 font-extrabold" : "text-slate-900"
                    } ${m.winner === "A" ? "font-bold text-slate-950" : "font-medium"}`}
                  >
                    {m.teamA.name}
                  </span>
                  <CountryFlag code={m.teamA.countryCode} className="text-sm" />
                </div>

                {/* Sets + scores */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500">{m.setsWonA}</span>
                  <span className="font-mono font-bold px-1.5 py-0.2 rounded text-xs bg-slate-100 text-slate-800">
                    {m.setsWonA} : {m.setsWonB}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">{m.setsWonB}</span>
                </div>

                {/* Team B */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <CountryFlag code={m.teamB.countryCode} className="text-sm" />
                  <span
                    className={`truncate text-xs ${
                      isTeamBPolish ? "text-red-700 font-extrabold" : "text-slate-900"
                    } ${m.winner === "B" ? "font-bold text-slate-950" : "font-medium"}`}
                  >
                    {m.teamB.name}
                  </span>
                </div>
              </div>

              {/* Set scores breakdown */}
              {m.sets && m.sets.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                  {renderSetScores(m)}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-2.5">
      {/* Table Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          {title && <h3 className="font-bold text-xs sm:text-sm text-slate-900">{title}</h3>}
          <span className="text-[11px] text-slate-400 font-mono">({filtered.length})</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Polish filter toggle button */}
          <button
            onClick={() => setOnlyPolish(!onlyPolish)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
              onlyPolish
                ? "bg-red-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
            }`}
          >
            <span>🇵🇱 Poland only</span>
          </button>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded px-2 py-1 text-[11px] focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="live">🔴 Live</option>
            <option value="scheduled">Scheduled</option>
            <option value="finished">Finished</option>
          </select>

          {/* Round dropdown */}
          {rounds.length > 0 && (
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded px-2 py-1 text-[11px] focus:outline-none"
            >
              <option value="all">All phases</option>
              {rounds.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Dense Table / Cards */}
      {filtered.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          {/* Mobile: card layout */}
          <div className="sm:hidden">
            {renderMatchCards()}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-1.5 px-2.5 whitespace-nowrap">M# / Time</th>
                  {showTournamentColumn && (
                    <th className="py-1.5 px-3 whitespace-nowrap">Tournament</th>
                  )}
                  <th className="py-1.5 px-2 whitespace-nowrap">Phase</th>
                  <th className="py-1.5 px-3 text-right">Team 1</th>
                  <th className="py-1.5 px-2 text-center whitespace-nowrap font-mono">Sets</th>
                  <th className="py-1.5 px-3">Team 2</th>
                  <th className="py-1.5 px-3 whitespace-nowrap font-mono">Scores</th>
                  <th className="py-1.5 px-2.5 text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((m) => {
                  const isTeamAPolish = m.teamA.countryCode === "POL";
                  const isTeamBPolish = m.teamB.countryCode === "POL";
                  const hasPolish = isTeamAPolish || isTeamBPolish;
                  const isLive = m.status === "live" || m.status === "break";
                  const isFinished = m.status === "finished";

                  return (
                    <tr
                      key={m.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        hasPolish ? "polish-row" : ""
                      } ${isLive ? "bg-red-50/50" : ""}`}
                    >
                      {/* Match Number / Time -- single line */}
                      <td className="py-1 px-2.5 whitespace-nowrap font-mono text-slate-500">
                        <span className="inline-flex items-baseline gap-1.5">
                          {m.matchNumber && (
                            <span className="text-[10px] text-slate-400 font-bold">
                              M{m.matchNumber}
                            </span>
                          )}
                          <span className="text-sm font-bold text-slate-700">
                            {m.time || "-"}
                          </span>
                          {m.court && <span className="text-slate-400 text-[10px]">C{m.court}</span>}
                        </span>
                      </td>

                      {/* Tournament name (optional column) */}
                      {showTournamentColumn && (
                        <td className="py-1 px-3 whitespace-nowrap text-[11px] text-slate-600 max-w-[180px] truncate">
                          {m.tournamentTitle ? (
                            <Link
                              href={`/tournaments/${m.tournamentId}`}
                              className="hover:text-amber-600 transition-colors"
                            >
                              {m.tournamentTitle}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      {/* Phase */}
                      <td className="py-1 px-2 whitespace-nowrap text-[11px] text-slate-600">
                        {m.roundName || m.round || "-"}
                      </td>

                      {/* Team 1 */}
                      <td className="py-1 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={`truncate max-w-[140px] sm:max-w-[220px] ${
                              isTeamAPolish ? "text-red-700 font-extrabold" : "text-slate-900"
                            } ${m.winner === "A" ? "font-bold text-slate-950" : ""}`}
                          >
                            {m.teamA.name}
                          </span>
                          <CountryFlag code={m.teamA.countryCode} className="text-sm" />
                        </div>
                      </td>

                      {/* Sets won */}
                      <td className="py-1 px-2 text-center whitespace-nowrap">
                        <span
                          className={`font-mono font-bold px-1.5 py-0.2 rounded text-xs ${
                            isFinished || isLive
                              ? "bg-slate-100 text-slate-800"
                              : "text-slate-400"
                          }`}
                        >
                          {m.setsWonA} : {m.setsWonB}
                        </span>
                      </td>

                      {/* Team 2 */}
                      <td className="py-1 px-3 text-left">
                        <div className="flex items-center justify-start gap-1.5">
                          <CountryFlag code={m.teamB.countryCode} className="text-sm" />
                          <span
                            className={`truncate max-w-[140px] sm:max-w-[220px] ${
                              isTeamBPolish ? "text-red-700 font-extrabold" : "text-slate-900"
                            } ${m.winner === "B" ? "font-bold text-slate-950" : ""}`}
                          >
                            {m.teamB.name}
                          </span>
                        </div>
                      </td>

                      {/* Scores */}
                      <td className="py-1 px-3 whitespace-nowrap">
                        {renderSetScores(m)}
                      </td>

                      {/* Status */}
                      <td className="py-1 px-2.5 text-center whitespace-nowrap">
                        {isLive ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                            LIVE
                          </span>
                        ) : isFinished ? (
                          <span className="text-[10px] text-slate-400">Done</span>
                        ) : (
                          <span className="text-[10px] text-blue-600">Plan</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 text-center rounded-lg border border-slate-200 text-slate-400 text-xs">
          No matches for the selected criteria.
        </div>
      )}
    </div>
  );
}

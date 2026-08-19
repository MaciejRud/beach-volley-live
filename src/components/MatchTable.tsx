"use client";

import { Fragment, useState, useMemo } from "react";
import Link from "next/link";
import { Match } from "@/lib/fivb/types";
import { CountryHelper } from "@/lib/countryHelper";
import { CountryFlag } from "./CountryFlag";
import { MatchTime } from "./MatchTime";
import { formatDateHeading, groupByDate } from "@/lib/dateFormatter";

interface Props {
  matches: Match[];
  title?: string;
  defaultOnlyPolish?: boolean;
  showTournamentColumn?: boolean;
  /** Splits the list into per-day sections with a date heading. */
  groupByDay?: boolean;
  /** Hides the Phase column when the surrounding section already names it. */
  hidePhaseColumn?: boolean;
}

export function MatchTable({ matches, title, defaultOnlyPolish = false, showTournamentColumn = false, groupByDay = false, hidePhaseColumn = false }: Props) {
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

  /** Draw position from the entry list, rendered as results pages do: "[3]". */
  const renderSeed = (team: Match["teamA"]) => {
    if (!team.seed) return null;
    return (
      <span className="ml-1 font-mono text-[10px] font-bold text-slate-400 whitespace-nowrap">
        [{team.seed}]
      </span>
    );
  };

  /**
   * Mobile layout puts one player per line. Falls back to the combined team
   * name for placeholder entries (TBD) where the API sends no player split.
   */
  const renderPlayerLines = (team: Match["teamA"]) => {
    if (!team.player1 && !team.player2) {
      return <div className="truncate">{team.name}</div>;
    }
    return (
      <>
        <div className="truncate">{team.player1 || "—"}</div>
        <div className="truncate">{team.player2 || "—"}</div>
      </>
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

    return groupByDay ? renderGroupedCards() : <div className="divide-y divide-slate-200">{filtered.map(renderCard)}</div>;
  };

  const renderGroupedCards = () => (
    <div className="divide-y divide-slate-200">
      {groupByDate(filtered).map((group) => (
        <div key={group.date || "no-date"}>
          <div className="px-3 py-1.5 bg-slate-100 border-y border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
            {formatDateHeading(group.date)}
            <span className="ml-1.5 font-mono font-bold text-slate-400">({group.items.length})</span>
          </div>
          <div className="divide-y divide-slate-200">{group.items.map(renderCard)}</div>
        </div>
      ))}
    </div>
  );

  const renderCard = (m: Match) => {
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
            <MatchTime match={m} className="font-bold text-slate-600" />
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

        {/* Teams stay left/right; each team's two players stack vertically
            so full surnames fit without truncation on narrow screens. */}
        <div className="flex items-stretch justify-between gap-2">
          {/* Team A -- right-aligned towards the score */}
          <div className="min-w-0 flex-1 flex items-center justify-end gap-1.5">
            <div
              className={`min-w-0 text-right text-xs leading-tight ${
                isTeamAPolish ? "text-red-700 font-extrabold" : "text-slate-900"
              } ${m.winner === "A" ? "font-bold text-slate-950" : "font-medium"}`}
            >
              {renderPlayerLines(m.teamA)}
            </div>
            <CountryFlag code={m.teamA.countryCode} className="text-sm shrink-0" />
          </div>

          {/* Single sets tally -- the per-team numbers used to repeat it */}
          <span className="shrink-0 self-center font-mono font-bold px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-800">
            {m.setsWonA} : {m.setsWonB}
          </span>

          {/* Team B -- left-aligned away from the score */}
          <div className="min-w-0 flex-1 flex items-center gap-1.5">
            <CountryFlag code={m.teamB.countryCode} className="text-sm shrink-0" />
            <div
              className={`min-w-0 text-xs leading-tight ${
                isTeamBPolish ? "text-red-700 font-extrabold" : "text-slate-900"
              } ${m.winner === "B" ? "font-bold text-slate-950" : "font-medium"}`}
            >
              {renderPlayerLines(m.teamB)}
            </div>
          </div>
        </div>

        {/* Set scores, stacked centrally under the match score */}
        {m.sets && m.sets.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex flex-col items-center gap-0.5">
            {m.sets.map((set, idx) => (
              <span
                key={idx}
                className={`font-mono text-[10px] tabular-nums ${
                  set.isFinished ? "text-slate-500" : "text-red-600 font-bold"
                }`}
              >
                {set.scoreA} : {set.scoreB}
              </span>
            ))}
          </div>
        )}
      </Link>
    );
  };

  const renderRow = (m: Match) => {
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
        {/* Match number + court */}
        <td className="py-1 px-2.5 whitespace-nowrap font-mono text-[10px] text-slate-400">
          <span className="inline-flex items-baseline gap-1">
            <span className="font-bold">{m.matchNumber ? `M${m.matchNumber}` : "—"}</span>
            {m.court && <span className="text-slate-300">C{m.court}</span>}
          </span>
        </td>

        {/* Time -- own column so values line up across rows */}
        <td className="py-1 px-2 whitespace-nowrap font-mono text-sm font-bold text-slate-700 tabular-nums">
          <MatchTime match={m} />
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

        {/* Phase -- omitted when the section heading already states it */}
        {!hidePhaseColumn && (
          <td className="py-1 px-2 truncate text-[11px] text-slate-600">
            {m.roundName || m.round || "-"}
          </td>
        )}

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
            {renderSeed(m.teamA)}
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
            {renderSeed(m.teamB)}
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
            <table className="w-full min-w-[860px] table-fixed text-left text-xs border-collapse">
              {/* Fixed widths keep separate section tables aligned with each other. */}
              <colgroup>
                <col className="w-[72px]" />
                <col className="w-[64px]" />
                {showTournamentColumn && <col className="w-[168px]" />}
                {!hidePhaseColumn && <col className="w-[108px]" />}
                <col />
                <col className="w-[64px]" />
                <col />
                <col className="w-[128px]" />
                <col className="w-[72px]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-1.5 px-2.5 whitespace-nowrap">M#</th>
                  <th className="py-1.5 px-2 whitespace-nowrap">Time</th>
                  {showTournamentColumn && (
                    <th className="py-1.5 px-3 whitespace-nowrap">Tournament</th>
                  )}
                  {!hidePhaseColumn && <th className="py-1.5 px-2 whitespace-nowrap">Phase</th>}
                  <th className="py-1.5 px-3 text-right">Team 1</th>
                  <th className="py-1.5 px-2 text-center whitespace-nowrap font-mono">Sets</th>
                  <th className="py-1.5 px-3">Team 2</th>
                  <th className="py-1.5 px-3 whitespace-nowrap font-mono">Scores</th>
                  <th className="py-1.5 px-2.5 text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {groupByDay
                  ? groupByDate(filtered).map((group) => (
                      <Fragment key={group.date || "no-date"}>
                        <tr className="bg-slate-100/90 border-y border-slate-200">
                          <td
                            colSpan={7 + (showTournamentColumn ? 1 : 0) + (hidePhaseColumn ? 0 : 1)}
                            className="py-1 px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-600"
                          >
                            {formatDateHeading(group.date)}
                            <span className="ml-1.5 font-mono text-slate-400">({group.items.length})</span>
                          </td>
                        </tr>
                        {group.items.map(renderRow)}
                      </Fragment>
                    ))
                  : filtered.map(renderRow)}
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

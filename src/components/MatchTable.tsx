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
  showTournamentColumn?: boolean;
  /** Splits the list into per-day sections with a date heading. */
  groupByDay?: boolean;
  /** Hides the phase label where the surrounding section already names it. */
  hidePhase?: boolean;
}

export function MatchTable({ matches, title, showTournamentColumn = false, groupByDay = false, hidePhase = false }: Props) {

  const filtered = matches;

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
    const isLive = m.status === "live" || m.status === "break";
    const hasPolish = m.teamA.countryCode === "POL" || m.teamB.countryCode === "POL";

    return (
      <Link
        key={m.id}
        href={`/tournaments/${m.tournamentId}`}
        className={`block px-3 py-2.5 transition-colors ${
          hasPolish ? "polish-row" : ""
        } ${isLive ? "bg-red-50/40 hover:bg-red-50" : "hover:bg-slate-50"}`}
      >
        {/* One compact row: time and court on the left, teams in the middle,
            sets on the right. */}
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 w-11 font-mono text-[10px] text-slate-400 leading-tight">
            <MatchTime match={m} stacked className="text-[11px] font-bold text-slate-600" />
            {m.court && <div className="mt-0.5">C{m.court}</div>}
          </div>

          {/* Teams stay left/right; each team's players stack vertically so
              full surnames fit without truncation on narrow screens. */}
          <div className="min-w-0 flex-1 flex items-stretch justify-between gap-2">
            <div className="min-w-0 flex-1 flex items-center justify-end gap-1.5">
              <div
                className={`min-w-0 text-right text-xs leading-tight text-slate-900 ${
                  m.winner === "A" ? "font-bold text-slate-950" : "font-medium"
                }`}
              >
                {renderPlayerLines(m.teamA)}
              </div>
              <CountryFlag code={m.teamA.countryCode} className="text-sm shrink-0" />
            </div>

            <span className="shrink-0 self-center font-mono font-bold px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-800">
              {m.setsWonA} : {m.setsWonB}
            </span>

            <div className="min-w-0 flex-1 flex items-center gap-1.5">
              <CountryFlag code={m.teamB.countryCode} className="text-sm shrink-0" />
              <div
                className={`min-w-0 text-xs leading-tight text-slate-900 ${
                  m.winner === "B" ? "font-bold text-slate-950" : "font-medium"
                }`}
              >
                {renderPlayerLines(m.teamB)}
              </div>
            </div>
          </div>

          {/* Set scores sit beside the names rather than under them */}
          <div className="shrink-0 w-12 flex flex-col items-end gap-0.5 font-mono text-[10px] tabular-nums leading-tight">
            {isLive && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" title="Live" />
            )}
            {m.sets?.map((set, idx) => (
              <span key={idx} className={set.isFinished ? "text-slate-500" : "text-red-600 font-bold"}>
                {set.scoreA}:{set.scoreB}
              </span>
            ))}
          </div>
        </div>

        {/* Context line: tournament, phase and match number, only where the
            surrounding section does not already state them. */}
        {(showTournamentColumn || !hidePhase || m.matchNumber) && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
            {m.matchNumber && <span className="font-mono font-bold shrink-0">M{m.matchNumber}</span>}
            {!hidePhase && m.roundName && <span className="truncate">{m.roundName}</span>}
            {showTournamentColumn && m.tournamentTitle && (
              <>
                {(!hidePhase && m.roundName) || m.matchNumber ? <span>•</span> : null}
                <span className="truncate">{m.tournamentTitle}</span>
              </>
            )}
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
        <td className="py-1 px-2 whitespace-nowrap font-mono text-xs font-bold text-slate-700 tabular-nums">
          <MatchTime match={m} />
        </td>

        {/* Tournament name (optional column) */}
        {showTournamentColumn && (
          <td
            className="py-1 px-3 whitespace-nowrap text-[11px] text-slate-600 max-w-[180px] truncate"
            title={m.tournamentTitle || undefined}
          >
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
        {!hidePhase && (
          <td
            className="py-1 px-2 truncate text-[11px] text-slate-600"
            title={m.roundName || m.round || undefined}
          >
            {m.roundName || m.round || "-"}
          </td>
        )}

        {/* Team 1 */}
        <td className="py-1 px-3 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <span
              title={m.teamA.name}
              className={`truncate max-w-[140px] sm:max-w-[220px] text-slate-900 ${
                m.winner === "A" ? "font-bold text-slate-950" : ""
              }`}
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
              title={m.teamB.name}
              className={`truncate max-w-[140px] sm:max-w-[220px] text-slate-900 ${
                m.winner === "B" ? "font-bold text-slate-950" : ""
              }`}
            >
              {m.teamB.name}
            </span>
            {renderSeed(m.teamB)}
          </div>
        </td>

        {/* Scores, with a live dot in place of a status column -- a played
            match is evident from its score. */}
        <td className="py-1 px-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            {renderSetScores(m)}
            {isLive && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse shrink-0"
                title="Live"
              />
            )}
          </span>
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
            <table className="w-full min-w-[840px] table-fixed text-left text-xs border-collapse">
              {/* Fixed widths keep separate section tables aligned with each other. */}
              <colgroup>
                <col className="w-[64px]" />
                <col className="w-[104px]" />
                {showTournamentColumn && <col className="w-[168px]" />}
                {!hidePhase && <col className="w-[108px]" />}
                <col />
                <col className="w-[64px]" />
                <col />
                <col className="w-[140px]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-1.5 px-2.5 whitespace-nowrap">M#</th>
                  <th className="py-1.5 px-2 whitespace-nowrap">Time</th>
                  {showTournamentColumn && (
                    <th className="py-1.5 px-3 whitespace-nowrap">Tournament</th>
                  )}
                  {!hidePhase && <th className="py-1.5 px-2 whitespace-nowrap">Phase</th>}
                  <th className="py-1.5 px-3 text-right">Team 1</th>
                  <th className="py-1.5 px-2 text-center whitespace-nowrap font-mono">Sets</th>
                  <th className="py-1.5 px-3">Team 2</th>
                  <th className="py-1.5 px-3 whitespace-nowrap font-mono">Scores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {groupByDay
                  ? groupByDate(filtered).map((group) => (
                      <Fragment key={group.date || "no-date"}>
                        <tr className="bg-slate-100/90 border-y border-slate-200">
                          <td
                            colSpan={6 + (showTournamentColumn ? 1 : 0) + (hidePhase ? 0 : 1)}
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

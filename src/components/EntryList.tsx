"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { EntryGroup, EntryRow } from "@/lib/fivb/entryList";
import { CountryFlag } from "./CountryFlag";

interface Props {
  groups: EntryGroup[];
  /** Open when the list is the page's main content -- before any match exists. */
  defaultOpen: boolean;
}

/**
 * A tournament's entry list, grouped as FIVB dispatches it: main draw,
 * qualification, reserve list, withdrawn pairs.
 */
export function EntryList({ groups, defaultOpen }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showWithdrawn, setShowWithdrawn] = useState(false);

  const total = groups.filter((g) => g.key !== "withdrawn").reduce((n, g) => n + g.rows.length, 0);
  const hasRank = groups.some((g) => g.rows.some((r) => r.rankText));
  const hasPoints = groups.some((g) => g.rows.some((r) => r.entryPoints));
  // Before the confirmed list there are names and nothing else; say so, or
  // the alphabetical order reads as a seeding.
  const isProvisional = !hasPoints && groups.every((g) => g.key === "registered" || g.key === "withdrawn");

  const renderPlayers = (row: EntryRow) => {
    if (row.players.length === 0) return <div className="truncate">{row.name}</div>;
    return row.players.map((p) => (
      <div key={p.no} className="truncate">
        {p.hasPage ? (
          <Link href={`/players/${p.no}`} className="hover:underline hover:text-slate-950">
            {p.name}
          </Link>
        ) : (
          p.name
        )}
      </div>
    ));
  };

  const renderRow = (row: EntryRow) => (
    <div key={row.teamNo} className="flex items-center gap-2.5 px-3 py-2">
      <div className="shrink-0 w-7 font-mono text-[11px] font-bold text-slate-400">
        {row.position ?? ""}
      </div>
      <CountryFlag code={row.federationCode} className="text-sm shrink-0" />
      <div className="min-w-0 flex-1 text-xs leading-tight font-medium text-slate-900">
        {renderPlayers(row)}
      </div>
      {row.badges.length > 0 && (
        <div className="shrink-0 flex gap-1">
          {row.badges.map((b) => (
            <span
              key={b.label + b.title}
              title={b.title}
              className="font-mono font-bold px-1 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500"
            >
              {b.label}
            </span>
          ))}
        </div>
      )}
      {row.reason && (
        <span className="shrink-0 text-[10px] font-semibold text-slate-500">{row.reason}</span>
      )}
      {hasPoints && (
        <div className="shrink-0 w-14 text-right font-mono text-[11px] text-slate-500">
          {row.entryPoints ?? ""}
        </div>
      )}
      {hasRank && (
        <div className="shrink-0 w-8 text-right font-mono text-[11px] font-bold text-slate-700">
          {row.rankText ?? ""}
        </div>
      )}
    </div>
  );

  const renderGroupHeader = (group: EntryGroup) => (
    <span>
      {group.title}
      <span className="ml-1.5 font-mono font-bold text-slate-400">({group.rows.length})</span>
    </span>
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <h3 className="font-bold text-xs sm:text-sm text-slate-900">Entry list</h3>
          <span className="text-[11px] text-slate-500">{total} teams</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="border-t border-slate-200">
          {isProvisional && (
            <p className="px-3 py-2 text-[11px] text-slate-500 bg-amber-50/60 border-b border-slate-200">
              Provisional list. FIVB publishes entry points and splits teams into the main draw and the
              qualification about four weeks before the event; until then the order is alphabetical.
            </p>
          )}
          {(hasPoints || hasRank) && (
            <div className="flex items-center justify-end gap-2.5 px-3 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {hasPoints && <span className="w-14 text-right">Entry pts</span>}
              {hasRank && <span className="w-8 text-right">Rank</span>}
            </div>
          )}
          {groups.map((group) =>
            group.key === "withdrawn" ? (
              <div key={group.key}>
                <button
                  type="button"
                  onClick={() => setShowWithdrawn((open) => !open)}
                  aria-expanded={showWithdrawn}
                  className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-100 border-y border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 hover:bg-slate-200/60 cursor-pointer"
                >
                  {renderGroupHeader(group)}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showWithdrawn ? "rotate-180" : ""}`} />
                </button>
                {showWithdrawn && <div className="divide-y divide-slate-200">{group.rows.map(renderRow)}</div>}
              </div>
            ) : (
              <div key={group.key}>
                <div className="px-3 py-1.5 bg-slate-100 border-y border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  {renderGroupHeader(group)}
                </div>
                <div className="divide-y divide-slate-200">{group.rows.map(renderRow)}</div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

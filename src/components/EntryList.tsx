"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { EntryGroup, EntryGroupKey, EntryRow } from "@/lib/fivb/entryList";
import { CountryFlag } from "./CountryFlag";

interface Props {
  groups: EntryGroup[];
  /** Open when the list is the page's main content -- before any match exists. */
  defaultOpen: boolean;
}

/**
 * A tournament's entry list, grouped as FIVB dispatches it: main draw,
 * qualification, reserve list, withdrawn pairs. One tab per group.
 */
export function EntryList({ groups, defaultOpen }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeKey, setActiveKey] = useState<EntryGroupKey | undefined>(groups[0]?.key);

  // The polled refresh can drop the group a tab points at; fall back to the first.
  const active = groups.find((g) => g.key === activeKey) ?? groups[0];

  const total = groups.filter((g) => g.key !== "withdrawn").reduce((n, g) => n + g.rows.length, 0);
  // The points column follows the open tab: on a phone an empty column is
  // width the names need.
  const hasPoints = active?.rows.some((r) => r.entryPoints) ?? false;
  // Before the confirmed list there are names and nothing else; say so, or
  // the order reads as a seeding.
  const isProvisional =
    !groups.some((g) => g.rows.some((r) => r.entryPoints)) &&
    groups.every((g) => g.key === "registered" || g.key === "withdrawn");

  /** Both players on one line, each linked when the site has their page. */
  const renderPair = (row: EntryRow) => {
    if (row.players.length === 0) return row.name;
    return row.players.map((p, i) => (
      <Fragment key={p.no}>
        {i > 0 && <span className="text-slate-400"> / </span>}
        {p.hasPage ? (
          <Link href={`/players/${p.no}`} className="hover:underline hover:text-slate-950">
            {p.name}
          </Link>
        ) : (
          p.name
        )}
      </Fragment>
    ));
  };

  const renderRow = (row: EntryRow) => (
    <div key={row.teamNo} className="flex items-center gap-2.5 px-3 py-2">
      <div className="shrink-0 w-7 font-mono text-[11px] font-bold text-slate-400">
        {row.position ?? ""}
      </div>
      <CountryFlag code={row.federationCode} className="text-sm shrink-0" />
      <div className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900">{renderPair(row)}</div>
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
      {hasPoints && (
        <div className="shrink-0 w-14 text-right font-mono text-[11px] text-slate-500">
          {row.entryPoints ?? ""}
        </div>
      )}
    </div>
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

      {isOpen && active && (
        <div className="border-t border-slate-200">
          {isProvisional && (
            <p className="px-3 py-2 text-[11px] text-slate-500 bg-amber-50/60 border-b border-slate-200">
              Provisional list. FIVB publishes entry points and splits teams into the main draw and the
              qualification about four weeks before the event; until then teams are listed by country.
            </p>
          )}

          <div role="tablist" className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-slate-200 bg-slate-50">
            {groups.map((group) => {
              const selected = group.key === active.key;
              return (
                <button
                  key={group.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveKey(group.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                    selected
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {group.title}
                  <span className={`font-mono ${selected ? "text-slate-300" : "text-slate-400"}`}>
                    {group.rows.length}
                  </span>
                </button>
              );
            })}
          </div>

          {hasPoints && (
            <div className="flex items-center justify-end px-3 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <span className="w-14 text-right">Entry pts</span>
            </div>
          )}
          <div role="tabpanel" className="divide-y divide-slate-200">
            {active.rows.map(renderRow)}
          </div>
        </div>
      )}
    </div>
  );
}

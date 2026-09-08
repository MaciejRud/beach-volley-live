"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CountryFlag } from "./CountryFlag";
import { CountryHelper, DEFAULT_COUNTRY } from "@/lib/countryHelper";
import { useCountry } from "@/lib/countryContext";

/**
 * Picks the country the site follows.
 *
 * The options come from the tournaments actually being scanned, so the list
 * never offers a country whose page would open empty -- which a reader cannot
 * tell apart from the app being broken. The selected country and Poland are
 * always present even at nought matches, because losing your way back to the
 * default would be worse than an honest empty page.
 */
export function CountryPicker({
  available,
}: {
  /** Countries with matches in the current window, most first. */
  available: { code: string; matches: number }[];
}) {
  const { country, setCountry } = useCountry();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Opening the list puts the caret in the search box: with two dozen
  // federations, typing three letters beats hunting down a scrolling list.
  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  const options = useMemo(() => {
    const counts = new Map(available.map((c) => [c.code, c.matches]));
    for (const code of [country, DEFAULT_COUNTRY]) {
      if (!counts.has(code)) counts.set(code, 0);
    }
    return [...counts.entries()]
      .map(([code, matches]) => ({
        code,
        matches,
        name: CountryHelper.getCountryName(code),
      }))
      // Busiest first, so whoever is actually playing this week leads; ties by
      // name, in a fixed locale so the order does not depend on the reader.
      .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name, "en"));
  }, [available, country]);

  const current = options.find((o) => o.code === country);

  // Matches on either half of what a reader might type: the country's name or
  // the three-letter code they see on the scoreboard.
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(needle) || o.code.toLowerCase().includes(needle)
    );
  }, [options, query]);

  useEffect(() => setHighlight(0), [query]);

  function choose(code: string) {
    setCountry(code);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 hover:border-slate-400 transition-colors"
      >
        <CountryFlag code={country} className="shrink-0" />
        <span>{current?.name ?? country}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Click anywhere else to dismiss, without trapping focus. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          {/* Anchored to the right: the trigger sits at the right edge of its
              card, so a left-anchored panel hangs off the viewport and gives
              the whole page a horizontal scrollbar. */}
          <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 p-1.5">
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search country…"
                aria-label="Search country"
                autoComplete="off"
                onKeyDown={(e) => {
                  if (e.key === "Escape") { setOpen(false); return; }
                  if (shown.length === 0) return;
                  if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % shown.length); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + shown.length) % shown.length); }
                  else if (e.key === "Enter") { e.preventDefault(); choose(shown[highlight].code); }
                }}
                className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-400"
              />
            </div>

            <ul role="listbox" className="max-h-64 overflow-y-auto">
              {shown.length === 0 && (
                <li className="px-2.5 py-2 text-xs text-slate-400">No country matches that.</li>
              )}
              {shown.map((option, index) => (
                <li key={option.code} role="option" aria-selected={option.code === country}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(option.code)}
                    className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs transition-colors ${
                      option.code === country
                        ? "bg-slate-100 font-bold text-slate-900"
                        : index === highlight
                          ? "bg-slate-50 text-slate-700"
                          : "text-slate-700"
                    }`}
                  >
                    <CountryFlag code={option.code} className="shrink-0" />
                    <span className="truncate">{option.name}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-400">
                      {option.matches}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

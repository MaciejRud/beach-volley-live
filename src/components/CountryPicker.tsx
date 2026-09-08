"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { CountryFlag } from "./CountryFlag";
import { CountryHelper } from "@/lib/countryHelper";
import { useCountry } from "@/lib/countryContext";

/**
 * Sets the country the site follows.
 *
 * A search rather than a list, and closed until asked for. Choosing a country
 * is a setting, not a reading of this week's draw, so it searches every
 * federation the app can name -- England has to be selectable in February,
 * when no English event is anywhere near the calendar. Match counts annotate
 * the results where there are any, as information rather than as the filter.
 *
 * Nothing is suggested before the first keystroke: a panel that opens already
 * full invites scrolling, which is the thing typing is meant to replace.
 */
export function CountryPicker({
  available,
}: {
  /** Match counts for the countries currently playing, to annotate results. */
  available: { code: string; matches: number }[];
}) {
  const { country, setCountry } = useCountry();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery("");
  }, [open]);

  useEffect(() => setHighlight(0), [query]);

  const countries = useMemo(() => {
    const counts = new Map(available.map((c) => [c.code, c.matches]));
    return CountryHelper.getAllCountries().map((c) => ({
      ...c,
      matches: counts.get(c.code) ?? 0,
    }));
  }, [available]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return countries
      .filter(
        (c) => c.name.toLowerCase().includes(needle) || c.code.toLowerCase().includes(needle)
      )
      // A name that begins with what was typed leads: "eng" should offer
      // England before Hungary, which merely contains it.
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name, "en");
      })
      .slice(0, 8);
  }, [countries, query]);

  function choose(code: string) {
    setCountry(code);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
      >
        Change country
      </button>
    );
  }

  return (
    <div className="relative shrink-0">
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a country…"
          aria-label="Search country"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              return;
            }
            if (matches.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => (h + 1) % matches.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => (h - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(matches[highlight].code);
            }
          }}
          // Narrow on a phone so the title beside it keeps enough room to be
          // read rather than truncating to a couple of letters.
          className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-900 outline-none focus:border-slate-500 sm:w-44"
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cancel"
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {matches.length > 0 && (
        <ul
          role="listbox"
          /* Anchored right: the field sits at the right edge of its card, and a
             left-anchored panel hangs off the viewport on a phone. */
          className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          {matches.map((option, index) => (
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
                {/* The match count only where there is one to give: a nought
                    beside every idle federation is noise, so those show the
                    code instead, which is what a scoreboard would say. */}
                <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-400">
                  {option.matches > 0 ? option.matches : option.code}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

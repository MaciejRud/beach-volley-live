"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { CountryFlag } from "@/components/CountryFlag";
import { ArchiveScopeNote } from "@/components/ArchiveScopeNote";
import { PlayerIndexFile, PlayerIndexEntry } from "@/lib/stats/playerFiles";

const GENDERS = [
  { value: "", label: "All" },
  { value: "M", label: "Men" },
  { value: "W", label: "Women" },
] as const;

/** Enough to browse, few enough to stay fast; search narrows before this bites. */
const VISIBLE_LIMIT = 60;

/**
 * Folds accents so "Losiak" finds "Łosiak" and "Sorum" finds "Sørum".
 *
 * Normalising to NFD splits accents off their base letter so the combining
 * marks can be dropped, but Ł, ø, æ and ß are separate letters rather than
 * accented forms and survive it, so they are mapped by hand.
 *
 * Lowercasing comes first: the hand-written mappings are lowercase, and running
 * them against "Łosiak" before that leaves the Ł untouched.
 */
function searchKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss");
}

export default function PlayersPage() {
  const [index, setIndex] = useState<PlayerIndexFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    // The whole index arrives once; every keystroke after that is local.
    fetch("/api/players")
      .then((res) => {
        if (!res.ok) throw new Error("Player archive is unavailable");
        return res.json();
      })
      .then((json: PlayerIndexFile) => {
        if (!cancelled) setIndex(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load players");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const searchable = useMemo(
    () => (index?.players ?? []).map((p) => ({ player: p, key: searchKey(`${p.d} ${p.f}`) })),
    [index]
  );

  const matches = useMemo(() => {
    const needle = searchKey(query.trim());
    const result: PlayerIndexEntry[] = [];

    for (const { player, key } of searchable) {
      if (gender && player.g !== gender) continue;
      if (needle && !key.includes(needle)) continue;
      result.push(player);
    }

    return result;
  }, [searchable, query, gender]);

  const visible = matches.slice(0, VISIBLE_LIMIT);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h1 className="text-base sm:text-lg font-black text-slate-900">Players</h1>
        <ArchiveScopeNote seasons={index?.seasons ?? []} />
      </div>

      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by surname or federation..."
            aria-label="Search players"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {GENDERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setGender(option.value)}
                aria-pressed={gender === option.value}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                  gender === option.value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {index && (
            <span className="text-[11px] text-slate-400 tabular-nums">
              {matches.length} of {index.players.length}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
          {error}
        </div>
      )}

      {!index && !error && (
        <div className="bg-white p-10 text-center rounded-lg border border-slate-200">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading players...</p>
        </div>
      )}

      {index && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          {visible.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No player matches &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visible.map((player) => (
                <li key={player.n}>
                  <Link
                    href={`/players/${player.n}`}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors"
                  >
                    <CountryFlag code={player.f} className="text-sm shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900">
                      {player.d}
                    </span>
                    <span className="shrink-0 text-[10px] font-mono text-slate-400">
                      {player.f}
                    </span>
                    <span className="shrink-0 w-16 text-right text-[10px] font-mono text-slate-500 tabular-nums">
                      {player.m} {player.m === 1 ? "match" : "matches"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {matches.length > visible.length && (
            <div className="px-3 py-2 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              Showing the {VISIBLE_LIMIT} most-played of {matches.length} matching players --
              keep typing to narrow it down.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

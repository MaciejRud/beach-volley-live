"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CountryFlag } from "./CountryFlag";
import { DistributionRow } from "./StatBars";
import { METRIC_DISPLAY } from "@/lib/stats/metricDisplay";
import type { GameCandidate, GameData } from "@/lib/game/pool";

/**
 * Guess the player from their statistical shape.
 *
 * Runs entirely in the browser. The whole pool arrives with the page, so a new
 * round costs no request -- and the answer is therefore in the browser too,
 * which nothing here pretends otherwise about: the candidate list has to ship
 * for the autocomplete regardless, and hiding the answer would need a signed
 * token and a server secret this app does not have.
 */

const MAX_GUESSES = 6;
const STORAGE_KEY = "bvl.guess-the-player.v1";

/**
 * What each wrong guess buys, weakest first.
 *
 * The order is measured, not guessed. Against a 50-player field of one gender,
 * continent leaves you among 24, partners among 14, win% among 8 and matches
 * among 4 -- and cumulatively the ladder runs 50 → 24 → 7 → 2 → 1.3, so the
 * last guess is winnable rather than a coin toss. Putting the strong hints
 * early would end rounds on the second guess.
 */
const HINTS: { after: number; label: string; of: (c: GameCandidate) => string }[] = [
  { after: 1, label: "Gender", of: (c) => (c.gender === "W" ? "Women" : "Men") },
  { after: 2, label: "Continent", of: (c) => c.continent ?? "unknown" },
  {
    after: 3,
    label: "Partners",
    of: (c) => `${c.partners} across the archive`,
  },
  {
    after: 4,
    label: "Matches won",
    // Rounded: the exact record identifies 76 of 100 outright, which is an
    // answer rather than a hint.
    of: (c) => {
      const played = c.won + c.lost;
      return played > 0 ? `about ${Math.round((c.won / played) * 20) * 5}%` : "unknown";
    },
  },
  {
    after: 5,
    label: "Measured matches",
    // Likewise: the exact count pins 60 of 100.
    of: (c) => `about ${Math.round(c.matches.career / 10) * 10}`,
  },
];

/** Folds away the accents and ligatures a keyboard will not produce. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/đ/g, "d")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

interface Stored {
  /** Player numbers not yet used this pass, so endless play stops repeating. */
  deck: string[];
  answer: string;
  guesses: string[];
  history: { answer: string; guesses: number; won: boolean }[];
}

export function GameBoard({ data }: { data: GameData }) {
  const byNo = useMemo(
    () => new Map(data.candidates.map((c) => [c.no, c])),
    [data.candidates]
  );

  // Nothing is drawn until the browser has spoken: picking a random answer
  // during render would differ between the server pass and the client one.
  const [state, setState] = useState<Stored | null>(null);
  const [scopeKey, setScopeKey] = useState(data.scopes[0]?.key ?? "career");
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRound = useCallback(
    (deck: string[], history: Stored["history"]): Stored => {
      // A fresh shuffle only once the pass is exhausted: drawing with
      // replacement would repeat a player within about a dozen rounds.
      const remaining = deck.length > 0 ? deck : shuffle(data.candidates.map((c) => c.no));
      const [answer, ...rest] = remaining;
      return { deck: rest, answer, guesses: [], history };
    },
    [data.candidates]
  );

  useEffect(() => {
    let restored: Stored | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        // A stored answer that is no longer in the pool means the archive moved
        // under an unfinished round; start a new one rather than crash.
        if (parsed?.answer && byNo.has(parsed.answer)) restored = parsed;
      }
    } catch {
      // A blocked or corrupt store is not an error worth showing: the game is
      // perfectly playable without history, it just will not be remembered.
    }
    setState(restored ?? startRound([], []));
  }, [byNo, startRound]);

  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Same again: losing the save is survivable, losing the round is not.
    }
  }, [state]);

  const answer = state ? byNo.get(state.answer) : undefined;
  const wrong = state?.guesses.filter((no) => no !== state.answer).length ?? 0;
  const won = Boolean(state && state.guesses.includes(state.answer));
  const over = won || wrong >= MAX_GUESSES;

  const suggestions = useMemo(() => {
    if (!state || query.trim().length < 2) return [];
    const needle = normalise(query.trim());
    return data.candidates
      .filter((c) => !state.guesses.includes(c.no) && normalise(c.name).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [query, data.candidates, state]);

  function submit(no: string) {
    if (!state || over) return;
    const guesses = [...state.guesses, no];
    const finished = no === state.answer || guesses.filter((g) => g !== state.answer).length >= MAX_GUESSES;
    setState({
      ...state,
      guesses,
      history: finished
        ? [
            ...state.history,
            { answer: state.answer, guesses: guesses.length, won: no === state.answer },
          ]
        : state.history,
    });
    setQuery("");
    setHighlight(0);
  }

  function nextRound() {
    if (!state) return;
    setState(startRound(state.deck, state.history));
    setQuery("");
    setScopeKey(data.scopes[0]?.key ?? "career");
  }

  if (!state || !answer) {
    return (
      <p className="py-8 text-center text-xs text-slate-400">Dealing a player…</p>
    );
  }

  const scope = data.scopes.find((s) => s.key === scopeKey) ?? data.scopes[0];
  const fields = data.fields[`${answer.gender}:${scope.key}`] ?? [];
  const answerValues = answer.values[scope.key];
  const revealed = HINTS.filter((hint) => wrong >= hint.after);

  const played = state.history.length;
  const winRate = played > 0 ? Math.round((state.history.filter((h) => h.won).length / played) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-base sm:text-lg font-black text-slate-900">Guess the player</h1>
        {played > 0 && (
          <span className="font-mono text-[11px] text-slate-400">
            {played} played · {winRate}% solved
          </span>
        )}
      </div>

      {/* Folded away: it is read once and then costs a third of a phone screen
          on every round after that. Collapsed everywhere rather than by
          breakpoint, because <details open> is an attribute and cannot be set
          from a media query without scripting it. */}
      <details className="group text-[11px] leading-relaxed text-slate-500">
        <summary className="cursor-pointer list-none font-bold text-slate-600 marker:content-none hover:text-slate-900">
          How it works
          <span className="ml-1 font-normal text-slate-400 group-open:hidden">
            — six statistics, six guesses
          </span>
        </summary>
        <p className="mt-1.5">
          Six statistics from one player on the Beach Pro Tour, drawn against everyone they are
          measured with. The pool is the 50 men and 50 women with the most Elite16 matches from
          2022 to 2026; the figures cover their whole measured record, Challenge and World
          Championships included. Switch period to see how the shape moves year to year — every
          guess is compared over the period you are looking at.
        </p>
      </details>

      {/* Period picker: the same control as a player page, and the main way of
          working the answer out rather than a decoration. */}
      <div className="flex flex-wrap gap-1">
        {data.scopes.map((option) => {
          const missing = (answer.matches[option.key] ?? 0) === 0;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setScopeKey(option.key)}
              aria-pressed={option.key === scope.key}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                option.key === scope.key
                  ? "bg-slate-900 text-white"
                  : missing
                    ? "bg-slate-50 text-slate-300 hover:bg-slate-100"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-900">Who is this?</h2>
          <span className="text-[11px] text-slate-500">{scope.label}</span>
        </header>

        {(answer.matches[scope.key] ?? 0) === 0 ? (
          <p className="p-3 text-[11px] text-slate-500">
            No measured matches in {scope.label} — which is a clue in itself. Try another period.
          </p>
        ) : (
          <div className="p-3">
            {/* Two columns even on a phone: reading the six shapes against
                each other is the whole activity, and a set you have to scroll
                through cannot be compared. */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:gap-x-6 sm:gap-y-4">
              {METRIC_DISPLAY.map((metric, index) => {
                const field = fields[index];
                const value = answerValues?.[index] ?? null;
                if (!field) return null;
                return (
                  <DistributionRow
                    key={metric.key}
                    label={metric.label}
                    note={metric.note}
                    // Rank and percentile stay hidden: a placing would say more
                    // about who this is than the shape does.
                    distribution={{
                      metric: metric.key,
                      value,
                      percentile: null,
                      rank: null,
                      min: field.min,
                      max: field.max,
                      bins: field.bins,
                    }}
                    format={metric.format}
                    higherIsBetter={metric.higherIsBetter}
                    showRank={false}
                    compact
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Guesses so far, each one carrying its own higher/lower reading. */}
      {state.guesses.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <h2 className="text-xs font-bold text-slate-900">Your guesses</h2>
            <span className="text-[11px] text-slate-500">
              green up, red down &mdash; which way the answer sits from your guess, over{" "}
              {scope.label}
            </span>
          </header>
          {/* Fixed layout with narrow arrow columns, so the name and all six
              readings stay on one line at phone width. The name is the only
              elastic column and truncates; the arrows never wrap or scroll,
              because a row that has to be scrolled sideways to be read is not
              feedback you can act on mid-guess. */}
          <div>
            <table className="w-full table-fixed text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide sm:tracking-wider text-slate-500">
                  <th className="py-1.5 pl-2 sm:pl-3 pr-1 text-left">Guess</th>
                  {METRIC_DISPLAY.map((metric) => (
                    <th
                      key={metric.key}
                      className="w-9 sm:w-20 py-1.5 px-0.5 text-center"
                      title={metric.label}
                    >
                      <span className="sm:hidden">{metric.short}</span>
                      <span className="hidden sm:inline">{metric.label.split(" ")[0]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {state.guesses.map((no, round) => {
                  const guessed = byNo.get(no)!;
                  const correct = no === state.answer;
                  const guessValues = guessed.values[scope.key];

                  return (
                    <tr key={`${no}-${round}`} className={correct ? "bg-emerald-50" : ""}>
                      <td className="py-1.5 pl-2 sm:pl-3 pr-1">
                        <span className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                          <CountryFlag code={guessed.fed} className="shrink-0" />
                          <span
                            title={guessed.name}
                            className={`truncate font-bold ${correct ? "text-emerald-700" : "text-slate-700"}`}
                          >
                            {guessed.name}
                          </span>
                        </span>
                      </td>
                      {METRIC_DISPLAY.map((metric, index) => {
                        const mine = guessValues?.[index] ?? null;
                        const theirs = answerValues?.[index] ?? null;

                        // Direction only, not judgement -- the header says so,
                        // which it has to: on reception errors the green arrow
                        // points at the worse number.
                        let mark = <span className="text-slate-300">·</span>;
                        if (correct) {
                          mark = <span className="text-base text-emerald-600">✓</span>;
                        } else if (mine !== null && theirs !== null) {
                          if (theirs > mine) {
                            mark = <ArrowUp className="mx-auto h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" strokeWidth={3} />;
                          } else if (theirs < mine) {
                            mark = <ArrowDown className="mx-auto h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500" strokeWidth={3} />;
                          } else {
                            mark = <span className="text-sm font-black text-slate-900">=</span>;
                          }
                        }

                        return (
                          <td
                            key={metric.key}
                            className="py-1.5 px-0.5 text-center font-bold"
                            title={
                              correct || mine === null || theirs === null
                                ? metric.label
                                : `${metric.label}: the answer is ${theirs > mine ? "higher" : theirs < mine ? "lower" : "the same"}`
                            }
                          >
                            {mark}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {revealed.length > 0 && (
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <header className="px-3 py-2 bg-slate-50 border-b border-slate-200">
            <h2 className="text-xs font-bold text-slate-900">Hints</h2>
          </header>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-slate-200">
            {revealed.map((hint) => (
              <div key={hint.label} className="px-3 py-2">
                <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  {hint.label}
                </dt>
                <dd className="mt-0.5 text-sm font-bold text-slate-900">{hint.of(answer)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {over ? (
        <section
          className={`rounded-lg border p-3 ${
            won ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
          }`}
        >
          <p className="text-sm font-bold text-slate-900">
            {won
              ? `Got it in ${state.guesses.length} ${state.guesses.length === 1 ? "guess" : "guesses"}.`
              : "Out of guesses."}{" "}
            <CountryFlag code={answer.fed} className="mx-1" />
            <Link
              href={`/players/${answer.no}`}
              className="underline decoration-slate-300 hover:text-amber-600 transition-colors"
            >
              {answer.name}
            </Link>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {answer.won}&ndash;{answer.lost} in {answer.matches.career} measured matches,{" "}
            {answer.partners === 1 ? "one partner" : `${answer.partners} partners`}.
          </p>
          <button
            type="button"
            onClick={nextRound}
            className="mt-2.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors"
          >
            Next player
          </button>
        </section>
      ) : (
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs p-3">
          <label
            htmlFor="guess"
            className="block text-[10px] font-bold uppercase tracking-wider text-slate-500"
          >
            Guess {state.guesses.length + 1} of {MAX_GUESSES}
          </label>
          <div className="relative mt-1">
            <input
              id="guess"
              ref={inputRef}
              type="text"
              autoComplete="off"
              value={query}
              placeholder="Start typing a name…"
              onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={(e) => {
                if (suggestions.length === 0) return;
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); }
                else if (e.key === "Enter") { e.preventDefault(); submit(suggestions[highlight].no); }
              }}
              className="w-full max-w-md rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
            {suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full max-w-md rounded-md border border-slate-200 bg-white shadow-lg overflow-hidden">
                {suggestions.map((c, i) => (
                  <li key={c.no}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => submit(c.no)}
                      className={`flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs ${
                        i === highlight ? "bg-slate-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <CountryFlag code={c.fed} className="shrink-0" />
                      <span className="font-bold text-slate-800">{c.name}</span>
                      <span className="ml-auto text-[10px] text-slate-400">{c.fed}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-slate-400">
            Type at least two letters. A wrong guess is not wasted: it marks each statistic
            higher or lower, and unlocks one more thing about the player.
          </p>
        </section>
      )}
    </div>
  );
}

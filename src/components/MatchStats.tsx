"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Match, PlayerRef, PlayerStatLine, MatchStatistics, TeamEntry } from "@/lib/fivb/types";
import {
  spikeSuccess,
  spikeEfficiency,
  blockSuccess,
  serveRisk,
  receptionFaultRate,
  pointOrigin,
} from "@/lib/fivb/statistics";
import { StatTotals } from "@/lib/stats/aggregate";
import { CountryFlag } from "./CountryFlag";
import {
  BarLegend,
  ORIGIN_LEGEND,
  PointOriginBar,
  RESOLUTION_LEGEND,
  ResolutionBars,
} from "./StatBars";

interface Props {
  match: Match;
  roster: { teamA: TeamEntry | null; teamB: TeamEntry | null };
  stats: MatchStatistics;
  /** Season totals per player number, from the archive. Absent players are simply missing. */
  seasonAverages?: Record<string, StatTotals>;
  season?: number;
}

/** A player together with the side they played on. */
interface Slot {
  player: PlayerRef;
  side: "A" | "B";
  countryCode: string;
}

/**
 * One line of the statistics table: a label plus how to read it off a stat row.
 *
 * `percent` rows return null when the action never happened -- no attacks means
 * no kill percentage -- which is rendered as a dash.
 */
interface StatRow {
  label: string;
  value: (line: PlayerStatLine) => number | null;
  percent?: boolean;
  /** Renders slightly indented, as a detail of the group above it. */
  detail?: boolean;
  /** Negative values are meaningful here and are coloured accordingly. */
  signed?: boolean;
  /** Errors: doing more of it than usual is a worse match, not a better one. */
  lowerIsBetter?: boolean;
  /**
   * What the row means, shown on hovering the label.
   *
   * Plain counts get a line saying what is being counted; the derived figures
   * get the formula, because "efficiency" and "serve risk" are conventions a
   * reader has no way to guess.
   */
  definition: string;
}

const STAT_ROWS: StatRow[] = [
  {
    label: "Points",
    value: (l) => l.pointTotal,
    definition: "Points won by this player: kills, block points and aces added together.",
  },
  {
    label: "Attacks",
    value: (l) => l.spikeTotal,
    definition: "Every attack the player hit, however it ended.",
  },
  {
    label: "Kills",
    value: (l) => l.spikePoint,
    detail: true,
    definition: "Attacks that won the rally outright.",
  },
  {
    label: "Attack errors",
    value: (l) => l.spikeFault,
    detail: true,
    lowerIsBetter: true,
    definition:
      "Attacks that lost the rally -- into the net, out, or stopped by the block. FIVB counts a blocked attack here, so it needs no separate line.",
  },
  {
    label: "Kill %",
    value: spikeSuccess,
    percent: true,
    detail: true,
    definition: "Kills ÷ attacks. Counts only the points, so it is never negative.",
  },
  {
    label: "Efficiency",
    value: spikeEfficiency,
    percent: true,
    detail: true,
    signed: true,
    definition:
      "(Kills − attack errors) ÷ attacks. Goes negative when a player made more attack errors than points, which is why it says more about a match than kill % does.",
  },
  {
    label: "Block points",
    value: (l) => l.blockPoint,
    definition: "Blocks that ended the rally on the spot.",
  },
  {
    label: "Block touches",
    value: (l) => l.blockTotal,
    detail: true,
    definition: "Every time the player's block touched the ball, scoring or not.",
  },
  {
    label: "Block %",
    value: blockSuccess,
    percent: true,
    detail: true,
    definition: "Block points ÷ block touches: how often a touch finished the rally.",
  },
  {
    label: "Aces",
    value: (l) => l.servePoint,
    definition: "Serves that won the point immediately.",
  },
  {
    label: "Serve errors",
    value: (l) => l.serveFault,
    detail: true,
    lowerIsBetter: true,
    definition: "Serves into the net or out.",
  },
  // Serve risk is deliberately unmarked: aces and errors move together, so
  // neither more nor less of it is plainly better.
  {
    label: "Serve risk %",
    value: serveRisk,
    percent: true,
    detail: true,
    definition:
      "(Aces + serve errors) ÷ serves: the share of serves that ended the rally one way or the other. High means an aggressive server -- neither good nor bad on its own, since aces and errors rise together.",
  },
  {
    label: "Receptions",
    value: (l) => l.receptionTotal,
    definition: "Serves the player received.",
  },
  {
    label: "Reception errors",
    value: (l) => l.receptionFault,
    detail: true,
    lowerIsBetter: true,
    definition: "Receptions that lost the point outright.",
  },
  {
    label: "Reception error %",
    value: receptionFaultRate,
    percent: true,
    detail: true,
    lowerIsBetter: true,
    definition:
      "Reception errors ÷ receptions. Errors are all the FIVB feed reports for reception -- it grades nothing positively -- so a low number is the only good news here.",
  },
  {
    label: "Digs",
    value: (l) => l.digTotal,
    definition: "Every defensive touch on an opponent's attack.",
  },
  {
    label: "Clean digs",
    value: (l) => l.digExcellent,
    detail: true,
    definition:
      "Digs controlled well enough to attack from. A dig never scores, so this is the best outcome the statistic has.",
  },
];

/**
 * A row opens a new group when it is not a detail of the one above -- Points,
 * Attacks, Block points, Aces, Receptions, Digs. The first row needs no rule
 * above it, so it is excluded.
 */
function startsGroup(index: number): boolean {
  return index > 0 && !STAT_ROWS[index].detail;
}

/**
 * The table's rules, in one place so the header and body agree.
 *
 * The heavy weight marks the divisions worth seeing at a glance -- skill groups
 * across, players down, and the frame around the whole thing. Every set column
 * gets the same light rule, so S1, S2 and Match all read as separate columns
 * rather than the last one being special.
 */
const GROUP_RULE = "border-t-4 border-slate-400";
const PLAYER_RULE = "border-l-4 border-slate-400";
const COLUMN_RULE = "border-l border-slate-300";

function formatValue(row: StatRow, line: PlayerStatLine | undefined): string {
  if (!line) return "—";
  const v = row.value(line);
  if (v === null) return "—";
  return row.percent ? `${v.toFixed(1)}%` : String(v);
}

/**
 * The player's season figure for the same statistic, shown under the match one.
 *
 * Season totals are summed over many matches, so counts have to be divided back
 * down to a per-match figure to be comparable; percentages are already ratios
 * and are computed over the season's own totals.
 */
function seasonComparison(
  row: StatRow,
  totals: StatTotals | undefined,
  line: PlayerStatLine | undefined
): { text: string; className: string } | null {
  if (!totals || totals.matches === 0) return null;

  const seasonValue = row.value(totals as unknown as PlayerStatLine);
  if (seasonValue === null) return null;

  const average = row.percent ? seasonValue : seasonValue / totals.matches;
  const text = row.percent ? `${average.toFixed(1)}%` : average.toFixed(1);

  // Colour says how this match compared to the player's own season: green when
  // they did more of it than usual, red when less. For error counts "more than
  // usual" is a worse match, so those rows invert.
  const matchValue = line ? row.value(line) : null;
  if (matchValue === null) return { text, className: "text-slate-400" };

  const better = row.lowerIsBetter ? matchValue < average : matchValue > average;
  const worse = row.lowerIsBetter ? matchValue > average : matchValue < average;

  return {
    text,
    className: better ? "text-emerald-600" : worse ? "text-red-500" : "text-slate-400",
  };
}

/**
 * Match figures are plain black; the only colour among them is a negative
 * efficiency, which is worth catching at a glance. Everything else that is
 * coloured in this table is the season average beside the figure, not the
 * figure itself.
 */
function valueClass(row: StatRow, line: PlayerStatLine | undefined): string {
  if (!row.signed || !line) return "text-slate-900";
  const v = row.value(line);
  if (v === null) return "text-slate-400";
  return v < 0 ? "text-red-600" : "text-slate-900";
}

/**
 * A row label that explains itself on hover.
 *
 * Fixed positioning rather than absolute: the table scrolls horizontally and
 * the label cell is sticky, so an absolutely positioned panel would be clipped
 * by the scroll container. Following the pointer avoids that entirely.
 */
function StatLabel({ row, className }: { row: StatRow; className: string }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);

  return (
    <>
      <span
        className={`${className} cursor-help decoration-dotted decoration-slate-300 underline-offset-2 hover:underline`}
        onMouseEnter={(e) => setAt({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setAt({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setAt(null)}
      >
        {row.label}
      </span>

      {at &&
        // Rendered into the body: the label cell is sticky and inside a
        // scrolling table, both of which create stacking contexts the panel
        // would otherwise be trapped behind whatever its z-index.
        createPortal(
          <div
            role="tooltip"
            style={{
              left: Math.min(at.x + 14, window.innerWidth - 264),
              top: Math.min(at.y + 18, window.innerHeight - 130),
            }}
            className="pointer-events-none fixed z-50 w-[248px] rounded-md border border-slate-200 bg-white shadow-lg px-2.5 py-2 text-[11px] font-normal leading-relaxed text-slate-600"
          >
            <div className="font-bold text-slate-900 mb-0.5">{row.label}</div>
            {row.definition}
          </div>,
          document.body
        )}
    </>
  );
}

export function MatchStats({ match, roster, stats, seasonAverages = {}, season }: Props) {
  const hasSeasonContext = Object.keys(seasonAverages).length > 0;
  const slots: Slot[] = [
    ...[roster.teamA?.player1, roster.teamA?.player2]
      .filter((p): p is PlayerRef => Boolean(p))
      .map((player) => ({ player, side: "A" as const, countryCode: match.teamA.countryCode })),
    ...[roster.teamB?.player1, roster.teamB?.player2]
      .filter((p): p is PlayerRef => Boolean(p))
      .map((player) => ({ player, side: "B" as const, countryCode: match.teamB.countryCode })),
  ];

  // Without an entry list there is no way to tell which player played for whom
  // -- the tour has two Mols and two Grimalts, so names cannot stand in for ids.
  if (slots.length === 0) {
    return (
      <div className="bg-white p-4 rounded-lg border border-slate-200 text-xs text-slate-500">
        Statistics are available for this match, but its entry list could not be loaded,
        so players cannot be matched to their teams.
      </div>
    );
  }

  const setNumbers = [...new Set(stats.sets.map((s) => s.setNumber ?? 0))].sort((a, b) => a - b);

  const matchLine = (playerNo: string) => stats.match.find((l) => l.playerNo === playerNo);
  const setLine = (playerNo: string, setNumber: number) =>
    stats.sets.find((l) => l.playerNo === playerNo && l.setNumber === setNumber);

  // Points split per set and for the whole match, per side. The per-set rows
  // are what make the shape of a match visible: a pair can take one set on
  // their own attack and the next on the opponent falling apart.
  const origins = (["A", "B"] as const).map((side) => {
    const entry = side === "A" ? roster.teamA : roster.teamB;
    const playerNos = [entry?.player1?.no, entry?.player2?.no].filter(Boolean) as string[];
    const ours = (rows: PlayerStatLine[]) => rows.filter((l) => playerNos.includes(l.playerNo));
    const scoreOf = (set: (typeof match.sets)[number]) => (side === "A" ? set.scoreA : set.scoreB);

    const rows = setNumbers.map((setNumber) => {
      const set = match.sets.find((s) => s.setNumber === setNumber);
      return {
        label: `Set ${setNumber}`,
        ...pointOrigin(
          set ? scoreOf(set) : 0,
          ours(stats.sets.filter((l) => l.setNumber === setNumber))
        ),
      };
    });

    const matchPoints = match.sets.reduce((total, set) => total + scoreOf(set), 0);
    rows.push({ label: "Whole match", ...pointOrigin(matchPoints, ours(stats.match)) });

    return { side, team: side === "A" ? match.teamA : match.teamB, rows };
  });

  return (
    <div className="space-y-4">
      {/* Desktop: statistics down the side, players across the top, each split
          into their sets plus the match total. */}
      <div className="hidden md:block bg-white rounded-lg border-2 border-slate-400 shadow-xs overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200">
              <th className="py-1.5 px-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky left-0 bg-slate-100/70">
                Statistic
              </th>
              {slots.map((slot) => (
                <th
                  key={slot.player.no}
                  colSpan={setNumbers.length + 1}
                  className={`py-1.5 px-2 text-center ${PLAYER_RULE}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CountryFlag code={slot.countryCode} className="text-xs" />
                    <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap">
                      {slot.player.name}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-1 px-3 sticky left-0 bg-slate-50" />
              {slots.map((slot) =>
                [
                  ...setNumbers.map((n) => (
                    <th
                      key={`${slot.player.no}-s${n}`}
                      className={`py-1 px-2 text-right font-mono ${
                        n === setNumbers[0] ? PLAYER_RULE : COLUMN_RULE
                      }`}
                    >
                      S{n}
                    </th>
                  )),
                  <th
                    key={`${slot.player.no}-m`}
                    className={`py-1 px-2 text-right font-mono text-slate-600 ${COLUMN_RULE}`}
                  >
                    Match
                  </th>,
                ]
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STAT_ROWS.map((row, rowIndex) => (
              <tr
                key={row.label}
                className={`hover:bg-slate-50/70 ${startsGroup(rowIndex) ? GROUP_RULE : ""}`}
              >
                <td className="py-1 px-3 whitespace-nowrap sticky left-0 bg-white">
                  <StatLabel
                    row={row}
                    className={row.detail ? "pl-3 text-slate-500" : "font-semibold text-slate-800"}
                  />
                </td>
                {slots.map((slot) =>
                  [
                    ...setNumbers.map((n) => (
                      <td
                        key={`${slot.player.no}-s${n}-${row.label}`}
                        className={`py-1 px-2 text-right font-mono tabular-nums text-slate-900 ${
                          n === setNumbers[0] ? PLAYER_RULE : COLUMN_RULE
                        }`}
                      >
                        {formatValue(row, setLine(slot.player.no, n))}
                      </td>
                    )),
                    <td
                      key={`${slot.player.no}-m-${row.label}`}
                      className={`py-1 px-2 text-right font-mono tabular-nums font-bold ${COLUMN_RULE} ${valueClass(
                        row,
                        matchLine(slot.player.no)
                      )}`}
                    >
                      {formatValue(row, matchLine(slot.player.no))}
                      {(() => {
                        const avg = seasonComparison(
                          row,
                          seasonAverages[slot.player.no],
                          matchLine(slot.player.no)
                        );
                        return avg ? (
                          <span
                            className={`ml-1 font-normal ${avg.className}`}
                            title="Season average"
                          >
                            ({avg.text})
                          </span>
                        ) : null;
                      })()}
                    </td>,
                  ]
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: one card per player rather than a wide table squeezed sideways. */}
      <div className="md:hidden space-y-2.5">
        {slots.map((slot) => (
          <div
            key={slot.player.no}
            className="bg-white rounded-lg border-2 border-slate-400 shadow-xs overflow-hidden"
          >
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-b border-slate-200">
              <CountryFlag code={slot.countryCode} className="text-sm" />
              <span className="text-xs font-bold text-slate-900 truncate">{slot.player.name}</span>
            </div>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-1 px-3 text-left">Statistic</th>
                  {setNumbers.map((n) => (
                    <th key={n} className={`py-1 px-1.5 text-right font-mono w-9 ${COLUMN_RULE}`}>
                      S{n}
                    </th>
                  ))}
                  <th className={`py-1 px-3 text-right font-mono text-slate-600 w-12 ${COLUMN_RULE}`}>
                    Match
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {STAT_ROWS.map((row, rowIndex) => (
                  <tr key={row.label} className={startsGroup(rowIndex) ? GROUP_RULE : ""}>
                    <td className="py-1 px-3">
                      <StatLabel
                        row={row}
                        className={row.detail ? "pl-2 text-slate-500" : "font-semibold text-slate-800"}
                      />
                    </td>
                    {setNumbers.map((n) => (
                      <td
                        key={n}
                        className={`py-1 px-1.5 text-right font-mono tabular-nums text-slate-900 ${COLUMN_RULE}`}
                      >
                        {formatValue(row, setLine(slot.player.no, n))}
                      </td>
                    ))}
                    <td
                      className={`py-1 px-3 text-right font-mono tabular-nums font-bold ${COLUMN_RULE} ${valueClass(
                        row,
                        matchLine(slot.player.no)
                      )}`}
                    >
                      {formatValue(row, matchLine(slot.player.no))}
                      {(() => {
                        const avg = seasonComparison(
                          row,
                          seasonAverages[slot.player.no],
                          matchLine(slot.player.no)
                        );
                        return avg ? (
                          <span className={`ml-1 font-normal ${avg.className}`}>({avg.text})</span>
                        ) : null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-400">
        {hasSeasonContext && (
          <>
            Figures in brackets are the player&#39;s {season} average -- per match for counts,
            over the whole season for percentages, across Elite16, Challenge, Finals, World
            Championships and Olympic matches only.{" "}
            <span className="text-emerald-600">Green</span> means this match was above that
            average, <span className="text-red-500">red</span> below -- inverted for errors.{" "}
          </>
        )}
        Kill % counts points only; efficiency subtracts errors and can be negative. A dash
        means the action never happened, so there is nothing to take a percentage of.
        Reception has no positive grade in the FIVB feed, so only errors are reported.
      </p>
      {/* Where each team's points came from, set by set. The opponent-errors
          share is not published by the feed -- it is what is left of the score
          after the pair's own attack, block and serve points. */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-900">Where the points came from</h2>
          <span className="text-[11px] text-slate-500">
            attack + block + serve + opponent errors = the set score
          </span>
        </header>
        <div className="p-3">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {origins.map(({ side, team, rows }) => (
              <div key={side}>
                <div className="flex items-center gap-1.5 mb-2">
                  <CountryFlag code={team.countryCode} className="text-sm" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 truncate">
                    {team.name}
                  </span>
                </div>
                {rows.map((row) => (
                  <PointOriginBar key={row.label} origin={row} />
                ))}
              </div>
            ))}
          </div>
          <BarLegend items={ORIGIN_LEGEND} />
          <p className="mt-2.5 text-[10px] leading-relaxed text-slate-400">
            Points off opponent errors are the remainder: the set score minus what the pair
            scored themselves. The feed does not publish them, and summing the opponent&#39;s
            own errors would not work -- a blocked attack is counted there twice.
          </p>
        </div>
      </section>

      {/* Each skill decomposes exactly into won / rally continues / error. */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-900">How the actions ended</h2>
          <span className="text-[11px] text-slate-500">
            every skill splits exactly into point / rally continues / error
          </span>
        </header>
        <div className="p-3">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {slots.map((slot) => (
              <div key={slot.player.no}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2 truncate">
                  {slot.player.lastName || slot.player.name}
                </div>
                <ResolutionBars line={matchLine(slot.player.no)} />
              </div>
            ))}
          </div>
          <BarLegend items={RESOLUTION_LEGEND} />
          <p className="mt-2.5 text-[10px] leading-relaxed text-slate-400">
            Defence and reception do not score. Green on defence means the ball was dug
            cleanly, and reception has no positive grade in the FIVB feed at all -- only
            errors and rallies that carried on.
          </p>
        </div>
      </section>

    </div>
  );
}

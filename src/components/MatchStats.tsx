"use client";

import { Match, PlayerRef, PlayerStatLine, MatchStatistics, TeamEntry } from "@/lib/fivb/types";
import {
  spikeSuccess,
  spikeEfficiency,
  blockSuccess,
  serveRisk,
  receptionFaultRate,
  teamPointBreakdown,
} from "@/lib/fivb/statistics";
import { CountryFlag } from "./CountryFlag";

interface Props {
  match: Match;
  roster: { teamA: TeamEntry | null; teamB: TeamEntry | null };
  stats: MatchStatistics;
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
 * `percent` rows return null below the sample threshold, which is rendered as
 * a dash -- a percentage off six attempts describes the sample, not the player.
 */
interface StatRow {
  label: string;
  value: (line: PlayerStatLine) => number | null;
  percent?: boolean;
  /** Renders slightly indented, as a detail of the group above it. */
  detail?: boolean;
  /** Negative values are meaningful here and are coloured accordingly. */
  signed?: boolean;
}

const STAT_ROWS: StatRow[] = [
  { label: "Points", value: (l) => l.pointTotal },
  { label: "Attacks", value: (l) => l.spikeTotal },
  { label: "Kills", value: (l) => l.spikePoint, detail: true },
  { label: "Attack errors", value: (l) => l.spikeFault, detail: true },
  { label: "Kill %", value: spikeSuccess, percent: true, detail: true },
  { label: "Efficiency", value: spikeEfficiency, percent: true, detail: true, signed: true },
  { label: "Block points", value: (l) => l.blockPoint },
  { label: "Block touches", value: (l) => l.blockTotal, detail: true },
  { label: "Block %", value: blockSuccess, percent: true, detail: true },
  { label: "Aces", value: (l) => l.servePoint },
  { label: "Serve errors", value: (l) => l.serveFault, detail: true },
  { label: "Serve risk %", value: serveRisk, percent: true, detail: true },
  { label: "Receptions", value: (l) => l.receptionTotal },
  { label: "Reception errors", value: (l) => l.receptionFault, detail: true },
  { label: "Reception error %", value: receptionFaultRate, percent: true, detail: true },
  { label: "Digs", value: (l) => l.digTotal },
  { label: "Clean digs", value: (l) => l.digExcellent, detail: true },
];

function formatValue(row: StatRow, line: PlayerStatLine | undefined): string {
  if (!line) return "—";
  const v = row.value(line);
  if (v === null) return "—";
  return row.percent ? `${v.toFixed(1)}%` : String(v);
}

/** Only efficiency can legitimately go below zero; it is worth seeing at a glance. */
function valueClass(row: StatRow, line: PlayerStatLine | undefined): string {
  if (!row.signed || !line) return "text-slate-800";
  const v = row.value(line);
  if (v === null) return "text-slate-400";
  return v < 0 ? "text-red-600 font-bold" : "text-slate-800";
}

export function MatchStats({ match, roster, stats }: Props) {
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

  const breakdowns = (["A", "B"] as const).map((side) => {
    const entry = side === "A" ? roster.teamA : roster.teamB;
    const playerNos = [entry?.player1?.no, entry?.player2?.no].filter(Boolean) as string[];
    const lines = stats.match.filter((l) => playerNos.includes(l.playerNo));
    return {
      side,
      team: side === "A" ? match.teamA : match.teamB,
      breakdown: teamPointBreakdown(match.sets, side, lines),
    };
  });

  return (
    <div className="space-y-4">
      {/* Where each team's points came from. The opponent-errors share is not
          published by the feed -- it is what is left after the pair's own points. */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {breakdowns.map(({ side, team, breakdown }) => (
          <div key={side} className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 mb-2">
              <CountryFlag code={team.countryCode} className="text-sm" />
              <span className="text-xs font-bold text-slate-900 truncate">{team.name}</span>
            </div>
            <div className="flex items-baseline gap-1.5 text-xs text-slate-500">
              <span className="font-mono text-lg font-black text-slate-900 tabular-nums">
                {breakdown.teamPoints}
              </span>
              <span>points</span>
              <span className="text-slate-300">=</span>
              <span className="font-mono font-bold text-slate-700 tabular-nums">
                {breakdown.playerPoints}
              </span>
              <span>scored</span>
              <span className="text-slate-300">+</span>
              <span className="font-mono font-bold text-slate-700 tabular-nums">
                {breakdown.opponentErrors}
              </span>
              <span>off errors</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: statistics down the side, players across the top, each split
          into their sets plus the match total. */}
      <div className="hidden md:block bg-white rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
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
                  className="py-1.5 px-2 text-center border-l border-slate-200"
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
                      className={`py-1 px-2 text-right font-mono ${n === setNumbers[0] ? "border-l border-slate-200" : ""}`}
                    >
                      S{n}
                    </th>
                  )),
                  <th key={`${slot.player.no}-m`} className="py-1 px-2 text-right font-mono text-slate-600">
                    Match
                  </th>,
                ]
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {STAT_ROWS.map((row) => (
              <tr key={row.label} className="hover:bg-slate-50/70">
                <td
                  className={`py-1 px-3 whitespace-nowrap sticky left-0 bg-white ${
                    row.detail ? "pl-6 text-slate-500" : "font-semibold text-slate-800"
                  }`}
                >
                  {row.label}
                </td>
                {slots.map((slot) =>
                  [
                    ...setNumbers.map((n) => (
                      <td
                        key={`${slot.player.no}-s${n}-${row.label}`}
                        className={`py-1 px-2 text-right font-mono tabular-nums text-slate-400 ${
                          n === setNumbers[0] ? "border-l border-slate-200" : ""
                        }`}
                      >
                        {formatValue(row, setLine(slot.player.no, n))}
                      </td>
                    )),
                    <td
                      key={`${slot.player.no}-m-${row.label}`}
                      className={`py-1 px-2 text-right font-mono tabular-nums font-bold ${valueClass(
                        row,
                        matchLine(slot.player.no)
                      )}`}
                    >
                      {formatValue(row, matchLine(slot.player.no))}
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
            className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden"
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
                    <th key={n} className="py-1 px-1.5 text-right font-mono w-9">
                      S{n}
                    </th>
                  ))}
                  <th className="py-1 px-3 text-right font-mono text-slate-600 w-12">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {STAT_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td
                      className={`py-1 px-3 ${
                        row.detail ? "pl-5 text-slate-500" : "font-semibold text-slate-800"
                      }`}
                    >
                      {row.label}
                    </td>
                    {setNumbers.map((n) => (
                      <td
                        key={n}
                        className="py-1 px-1.5 text-right font-mono tabular-nums text-slate-400"
                      >
                        {formatValue(row, setLine(slot.player.no, n))}
                      </td>
                    ))}
                    <td
                      className={`py-1 px-3 text-right font-mono tabular-nums font-bold ${valueClass(
                        row,
                        matchLine(slot.player.no)
                      )}`}
                    >
                      {formatValue(row, matchLine(slot.player.no))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="text-[10px] leading-relaxed text-slate-400">
        Kill % counts points only; efficiency subtracts errors and can be negative.
        Percentages are hidden below 10 attempts, where they would say more about the
        sample than about the player. Reception has no positive grade in the FIVB feed,
        so only errors are reported.
      </p>
    </div>
  );
}

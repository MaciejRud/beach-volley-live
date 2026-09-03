"use client";

import { Match } from "@/lib/fivb/types";
import { poolStandings } from "@/lib/fivb/standings";
import { CountryFlag } from "./CountryFlag";

interface Props {
  matches: Match[];
}

/**
 * The pool table, folded into that pool's title bar.
 *
 * Nobody publishes these -- the FIVB ranking endpoints answer NotInNewFormat
 * and the CEV standings tab is empty -- so the figures are computed from the
 * results by `poolStandings`, which follows the FIVB Sport Operations Manual.
 * The footer says so, because a number the reader cannot check anywhere else
 * should say where it came from.
 *
 * Renders bare, without a card of its own: the bar that opens it is the card.
 */
export function PoolStandings({ matches }: Props) {
  const table = poolStandings(matches);
  if (table.length === 0) return null;

  const played = matches.filter((m) => m.fixtureState === "drawn");
  const complete = played.length > 0 && played.every((m) => m.status === "finished");

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="py-1.5 px-2.5 text-left font-semibold w-6">#</th>
              <th className="py-1.5 px-2 text-left font-semibold">Team</th>
              <th className="py-1.5 px-2 text-center font-semibold whitespace-nowrap" title="Matches won - lost">
                W-L
              </th>
              <th
                className="py-1.5 px-2 text-center font-semibold whitespace-nowrap"
                title="Match points: 2 for a win, 1 for a defeat, 0 for a forfeit"
              >
                Pts
              </th>
              <th className="py-1.5 px-2 text-center font-semibold whitespace-nowrap">Sets</th>
              <th className="py-1.5 px-2 text-center font-semibold whitespace-nowrap hidden sm:table-cell">
                Points
              </th>
              <th
                className="py-1.5 px-2.5 text-right font-semibold whitespace-nowrap"
                title="Rally points scored divided by conceded -- the first tie-break"
              >
                Ratio
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium">
            {table.map((row) => (
              <tr key={row.teamNo} className={row.countryCode === "POL" ? "polish-row" : ""}>
                <td className="py-1 px-2.5 font-mono text-[10px] text-slate-400">{row.rank}</td>
                <td className="py-1 px-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <CountryFlag code={row.countryCode} className="text-sm" />
                    <span className="truncate text-slate-900">{row.name}</span>
                  </span>
                </td>
                <td className="py-1 px-2 text-center font-mono tabular-nums text-slate-600 whitespace-nowrap">
                  {row.won}-{row.lost}
                </td>
                <td className="py-1 px-2 text-center font-mono font-bold tabular-nums text-slate-800">
                  {row.matchPoints}
                </td>
                <td className="py-1 px-2 text-center font-mono tabular-nums text-slate-500 whitespace-nowrap">
                  {row.setsWon}:{row.setsLost}
                </td>
                <td className="py-1 px-2 text-center font-mono tabular-nums text-slate-500 whitespace-nowrap hidden sm:table-cell">
                  {row.pointsScored}:{row.pointsConceded}
                </td>
                <td className="py-1 px-2.5 text-right font-mono tabular-nums text-slate-600">
                  {row.pointsRatio === null ? "—" : row.pointsRatio.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-3 py-1.5 border-t border-slate-200 bg-slate-50/60 text-right text-[10px] text-slate-400">
        {complete ? "Final" : "In progress"} · computed from results, FIVB Sport Operations Manual
      </div>
    </div>
  );
}

import Link from "next/link";
import { CountryFlag } from "./CountryFlag";
import { metricValues } from "@/lib/stats/playerFiles";
import type { PartnerRow } from "@/lib/stats/playerProfile";

/**
 * Who this player stood next to, and how they did there.
 *
 * The numbers are this player's own, not the pair's combined: the question the
 * table answers is whether someone attacks better or scores more alongside one
 * partner than another, and a pair total would hide exactly that.
 *
 * Measured matches only, which is why the count here falls short of the
 * partnership's real length -- coverage gaps in the archive are structural, so
 * a pairing that ran for two seasons can show a dozen matches.
 */
export function PartnerTable({ partners }: { partners: PartnerRow[] }) {
  if (partners.length === 0) return null;

  const seasonRange = (seasons: number[]) => {
    if (seasons.length === 0) return "—";
    const first = seasons[0];
    const last = seasons[seasons.length - 1];
    return first === last ? String(first) : `${first}–${last}`;
  };

  return (
    <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <h2 className="text-xs font-bold text-slate-900">
          Partners
          <span className="ml-1.5 font-normal text-slate-500">
            {partners.length === 1 ? "1 partner" : `${partners.length} partners`}
          </span>
        </h2>
        <span className="text-[11px] text-slate-500">
          this player&#39;s own figures alongside each of them
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[580px]">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-1.5 px-3 text-left">Partner</th>
              <th className="py-1.5 px-2 text-left">Seasons</th>
              <th className="py-1.5 px-2 text-right">Matches</th>
              <th className="py-1.5 px-2 text-right">W–L</th>
              <th className="py-1.5 px-2 text-right">Won</th>
              <th className="py-1.5 px-2 text-right whitespace-nowrap">Points / match</th>
              <th className="py-1.5 px-2 text-right">Kill %</th>
              <th className="py-1.5 px-2 text-right whitespace-nowrap">Attack efficiency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {partners.map((partner) => {
              const values = metricValues(partner.totals);
              const played = partner.won + partner.lost;

              return (
                <tr key={partner.playerNo} className="hover:bg-slate-50/70">
                  <td className="py-1.5 px-3">
                    <span className="flex items-center gap-1.5">
                      <CountryFlag code={partner.federationCode} className="shrink-0" />
                      {partner.listed ? (
                        <Link
                          href={`/players/${partner.playerNo}`}
                          className="font-bold text-slate-900 hover:text-amber-600 transition-colors"
                        >
                          {partner.name}
                        </Link>
                      ) : (
                        /* Below the listing threshold, so there is no page to
                           send anyone to. Named, but not linked. */
                        <span className="font-bold text-slate-500" title="Too few measured matches for a page">
                          {partner.name}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {seasonRange(partner.seasons)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-600">
                    {partner.matches}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-slate-800 whitespace-nowrap">
                    {partner.won}–{partner.lost}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-500">
                    {played > 0 ? `${((partner.won / played) * 100).toFixed(0)}%` : "—"}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-800">
                    {values.pointsPerMatch === null ? "—" : values.pointsPerMatch.toFixed(1)}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-800">
                    {values.spikeSuccess === null ? "—" : `${values.spikeSuccess.toFixed(1)}%`}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-800">
                    {values.spikeEfficiency === null
                      ? "—"
                      : `${values.spikeEfficiency.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-3 py-2 border-t border-slate-100 text-[10px] leading-relaxed text-slate-400">
        Measured matches only, so a pairing that ran for whole seasons can show a dozen matches
        here -- the archive&#39;s gaps are structural, not a matter of waiting. A partner shown in
        grey has too few measured matches of their own for a page.
      </p>
    </section>
  );
}

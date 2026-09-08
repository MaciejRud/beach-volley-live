import Link from "next/link";
import { CountryFlag } from "./CountryFlag";
import { metricValues } from "@/lib/stats/playerFiles";
import type { PartnerRow } from "@/lib/stats/playerProfile";

/**
 * Who this player stood next to, and how they did there.
 *
 * Four figures and no more. The table sits at a reading width rather than
 * stretching across the page: with this few columns, a full-width table puts
 * the name and its numbers so far apart that the row stops being one thought.
 *
 * The numbers are this player's own, not the pair's combined -- the question is
 * whether someone scores more alongside one partner than another, and a pair
 * total would hide exactly that.
 */
export function PartnerTable({ partners }: { partners: PartnerRow[] }) {
  if (partners.length === 0) return null;

  return (
    <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
      <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
        <h2 className="text-xs font-bold text-slate-900">Partners</h2>
        <span className="text-[11px] text-slate-500">
          {partners.length === 1 ? "one partner" : `${partners.length} partners`} &middot; this
          player&#39;s own figures alongside each
        </span>
      </header>

      <div className="p-3 overflow-x-auto">
        <table className="text-xs border-collapse w-full max-w-lg">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-1.5 pr-3 text-left">Partner</th>
              <th className="py-1.5 px-2 text-right">Matches</th>
              <th className="py-1.5 px-2 text-right">W&ndash;L</th>
              <th className="py-1.5 px-2 text-right whitespace-nowrap">Pts / match</th>
              <th className="py-1.5 pl-2 text-right">Kill %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {partners.map((partner) => {
              const values = metricValues(partner.totals);

              return (
                <tr key={partner.playerNo} className="hover:bg-slate-50/70">
                  <td className="py-1.5 pr-3">
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
                        <span
                          className="font-bold text-slate-400"
                          title="Too few measured matches for a page"
                        >
                          {partner.name}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-600">
                    {partner.matches}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums font-bold text-slate-800 whitespace-nowrap">
                    {partner.won}&ndash;{partner.lost}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-800">
                    {values.pointsPerMatch === null ? "—" : values.pointsPerMatch.toFixed(1)}
                  </td>
                  <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-slate-800">
                    {values.spikeSuccess === null ? "—" : `${values.spikeSuccess.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-2 max-w-lg text-[10px] leading-relaxed text-slate-400">
          Measured matches only, so a pairing that ran for whole seasons can show a dozen
          matches here. A partner in grey has too few of their own for a page.
        </p>
      </div>
    </section>
  );
}

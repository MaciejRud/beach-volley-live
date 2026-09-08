"use client";

import { useState } from "react";
import {
  BarLegend,
  DistributionRow,
  RESOLUTION_LEGEND,
  ResolutionBars,
  totalsAsLine,
} from "./StatBars";
import { METRIC_DISPLAY } from "@/lib/stats/metricDisplay";
import type { ScopeRow } from "@/lib/stats/playerProfile";

/**
 * The two views that only make sense over a stated period, under one picker.
 *
 * How the actions ended and where the player stands are the same question asked
 * twice -- once about their own numbers, once about everyone else's -- so
 * splitting the period control between them would let a reader compare a career
 * breakdown against a single season's field without noticing.
 *
 * Every period arrives pre-computed from the server: the histograms are counts
 * per bin, a few kilobytes in total, and the populations they were built from
 * never leave the server.
 */
export function PlayerStandings({ scopes }: { scopes: ScopeRow[] }) {
  const [scopeKey, setScopeKey] = useState(scopes.length > 0 ? scopes[0].key : "");
  const scope = scopes.find((s) => s.key === scopeKey) ?? scopes[0];

  if (!scope) return null;

  const byMetric = new Map(scope.distributions.map((d) => [d.metric, d]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <div className="flex flex-wrap gap-1">
          {scopes.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setScopeKey(option.key)}
              aria-pressed={option.key === scope.key}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                option.key === scope.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-[11px] text-slate-400">
          {scope.totals.matches} measured {scope.totals.matches === 1 ? "match" : "matches"}
        </span>
      </div>

      {/* The same decomposition as the match view, over the chosen period. */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-900">How the actions ended</h2>
          <span className="text-[11px] text-slate-500">
            every skill splits exactly into point / rally continues / error
          </span>
        </header>
        <div className="p-3">
          <ResolutionBars
            line={totalsAsLine(scope.totals)}
            blockMeasured={scope.blockMeasured}
          />
          <BarLegend items={RESOLUTION_LEGEND} />
          <p className="mt-2.5 text-[10px] leading-relaxed text-slate-400">
            Reception has no green: the FIVB feed grades it only by what went wrong. Defence is
            left out -- a dig never scores, which makes &quot;clean dig&quot; and &quot;rally
            continues&quot; two names for the same outcome.
            {!scope.blockMeasured && (
              <>
                {" "}
                Block is left out of {scope.label} as well: that season the feed counted the
                blocks that scored and almost nothing else, so the split would read as a flawless
                blocker for everyone. The block points themselves are sound and still ranked
                below.
              </>
            )}
          </p>
        </div>
      </section>

      {/* Where the player falls inside the field's own distribution. */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-900">Standing among the field</h2>
          <span className="text-[11px] text-slate-500">
            {/* The field size only belongs here when there is a standing to
                measure against it -- otherwise it reads as a ranking the body
                of the section then says does not exist. */}
            {scope.distributions.length > 0
              ? `${scope.label}, against ${scope.fieldSize} players`
              : scope.label}
          </span>
        </header>

        {scope.distributions.length === 0 ? (
          <p className="p-3 text-[11px] leading-relaxed text-slate-500">
            {scope.totals.matches} measured{" "}
            {scope.totals.matches === 1 ? "match" : "matches"} in {scope.label}. A placing needs
            at least {scope.minMatches}, so this period is shown without one -- with fewer, the
            standing would describe a good week rather than form.
          </p>
        ) : (
          <div className="p-3">
            {/* Two to a row from the small breakpoint up: at full width the
                track stretches so far that the bars stop reading as a shape. */}
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {METRIC_DISPLAY.map((metric) => {
                const distribution = byMetric.get(metric.key);
                if (!distribution) return null;
                return (
                  <DistributionRow
                    key={metric.key}
                    label={metric.label}
                    note={metric.note}
                    distribution={distribution}
                    format={metric.format}
                    higherIsBetter={metric.higherIsBetter}
                  />
                );
              })}
            </div>
            <p className="pt-3 text-[10px] leading-relaxed text-slate-400">
              Each row is the whole field&#39;s distribution for that metric: the bar heights are
              how many players posted each figure, in proportion, so a single crowded bar really
              does tower over the rest. Hover a bar for its count. The numbers at the ends are
              the lowest and highest anyone reached, and the marker is this player. Green marks a
              strong standing, red a weak one -- which for reception errors means the low end is
              the green one.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

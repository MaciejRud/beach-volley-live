import Link from "next/link";
import { CountryFlag } from "./CountryFlag";
import { ArchiveScopeNote } from "./ArchiveScopeNote";
import { BarLegend, PercentileBar, RESOLUTION_LEGEND, ResolutionBars } from "./StatBars";
import { FormChart } from "./FormChart";
import { PlayerStatLine } from "@/lib/fivb/types";
import { StatTotals } from "@/lib/stats/aggregate";
import { PERCENTILE_MIN_MATCHES, PercentileMetric, metricValues } from "@/lib/stats/playerFiles";
import { PlayerProfile } from "@/lib/stats/playerProfile";

/**
 * How each ranked metric reads.
 *
 * `higherIsBetter` is not decoration: percentiles are always computed ascending,
 * so for reception errors a high percentile is a bad result and colouring it
 * green would invert the meaning.
 */
const METRICS: {
  key: PercentileMetric;
  label: string;
  format: (v: number) => string;
  higherIsBetter: boolean;
}[] = [
  { key: "pointsPerMatch", label: "Points / match", format: (v) => v.toFixed(1), higherIsBetter: true },
  { key: "spikeSuccess", label: "Kill %", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
  { key: "spikeEfficiency", label: "Attack efficiency", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
  { key: "blockPointsPerMatch", label: "Block points / match", format: (v) => v.toFixed(1), higherIsBetter: true },
  { key: "serveRisk", label: "Serve risk", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: true },
  { key: "receptionFaultRate", label: "Reception errors", format: (v) => `${v.toFixed(1)}%`, higherIsBetter: false },
];

function percentileClass(percentile: number, higherIsBetter: boolean): string {
  const strong = higherIsBetter ? percentile >= 75 : percentile <= 25;
  const weak = higherIsBetter ? percentile <= 25 : percentile >= 75;
  if (strong) return "text-emerald-600";
  if (weak) return "text-red-600";
  return "text-slate-400";
}

/**
 * Career totals wear the shape of a match line, so the same resolution bars
 * can render them. Only the counters matter here -- the identity fields are
 * filled to satisfy the type, never read.
 */
function totalsAsLine(totals: StatTotals): PlayerStatLine {
  return { ...totals, playerNo: "" } as unknown as PlayerStatLine;
}

function careerRow(label: string, value: string) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

function perMatch(totals: StatTotals, key: keyof StatTotals): string {
  if (totals.matches === 0) return "—";
  return ((totals[key] as number) / totals.matches).toFixed(1);
}

export function PlayerProfileView({
  profile,
  seasons,
}: {
  profile: PlayerProfile;
  seasons: number[];
}) {
  const career = metricValues(profile.career);

  // Seasons come newest first; the first one carrying ranks is the most recent
  // in which the player met the sample threshold.
  const rankedSeason = profile.seasons.find((s) => Object.keys(s.percentiles).length > 0);

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/players"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          &larr; All players
        </Link>
      </div>

      <div className="bg-white p-3 sm:p-4 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <CountryFlag code={profile.federationCode} className="text-xl shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-slate-900 truncate">
              {profile.name}
            </h1>
            <p className="text-[11px] text-slate-500">
              {profile.federationCode} • {profile.gender === "W" ? "Women" : "Men"} •{" "}
              {profile.career.matches} measured {profile.career.matches === 1 ? "match" : "matches"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Career, per match
          </h2>
          <div className="divide-y divide-slate-100">
            {careerRow("Points", perMatch(profile.career, "pointTotal"))}
            {careerRow("Attacks", perMatch(profile.career, "spikeTotal"))}
            {careerRow("Block points", perMatch(profile.career, "blockPoint"))}
            {careerRow("Aces", perMatch(profile.career, "servePoint"))}
            {careerRow("Digs", perMatch(profile.career, "digTotal"))}
          </div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Career rates
          </h2>
          <div className="divide-y divide-slate-100">
            {METRICS.filter((m) => m.key !== "pointsPerMatch" && m.key !== "blockPointsPerMatch").map(
              (metric) => {
                const value = career[metric.key];
                return (
                  <div key={metric.key}>
                    {careerRow(metric.label, value === null ? "—" : metric.format(value))}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>

      {/* The same decomposition as the match view, over a whole career. */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-900">How the actions ended</h2>
          <span className="text-[11px] text-slate-500">
            every skill splits exactly into point / rally continues / error
          </span>
        </header>
        <div className="p-3">
          <ResolutionBars line={totalsAsLine(profile.career)} />
          <BarLegend items={RESOLUTION_LEGEND} />
        </div>
      </section>

      {/* Standing against the field, for the most recent season with a rank. */}
      {rankedSeason && (
        <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
            <h2 className="text-xs font-bold text-slate-900">Standing among the field</h2>
            <span className="text-[11px] text-slate-500">
              {rankedSeason.season}, against everyone with at least {PERCENTILE_MIN_MATCHES}{" "}
              measured matches
            </span>
          </header>
          <div className="p-3 space-y-2.5">
            {METRICS.map((metric) => {
              const value = metricValues(rankedSeason.totals)[metric.key];
              return (
                <PercentileBar
                  key={metric.key}
                  label={metric.label}
                  value={value === null ? "—" : metric.format(value)}
                  percentile={rankedSeason.percentiles[metric.key] ?? null}
                  higherIsBetter={metric.higherIsBetter}
                />
              );
            })}
            <p className="pt-1 text-[10px] leading-relaxed text-slate-400">
              The dot marks the percentile, counted upwards -- so a high number means more of
              that statistic, which for reception errors is worse, not better. Green marks a
              strong standing for that metric, red a weak one.
            </p>
          </div>
        </section>
      )}

      {/* Season by season, with each metric's standing among that season's field. */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[560px]">
          <thead>
            <tr className="bg-slate-100/70 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-1.5 px-3 text-left">Season</th>
              <th className="py-1.5 px-2 text-right">Matches</th>
              {METRICS.map((metric) => (
                <th key={metric.key} className="py-1.5 px-2 text-right whitespace-nowrap">
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {profile.seasons.map((row) => {
              const values = metricValues(row.totals);
              return (
                <tr key={row.season} className="hover:bg-slate-50/70">
                  <td className="py-1.5 px-3 font-bold text-slate-900">{row.season}</td>
                  <td className="py-1.5 px-2 text-right font-mono tabular-nums text-slate-600">
                    {row.totals.matches}
                  </td>
                  {METRICS.map((metric) => {
                    const value = values[metric.key];
                    const percentile = row.percentiles[metric.key];
                    return (
                      <td
                        key={metric.key}
                        className="py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap"
                      >
                        <span className="font-bold text-slate-800">
                          {value === null ? "—" : metric.format(value)}
                        </span>
                        {percentile !== undefined && percentile !== null && (
                          <span
                            className={`ml-1 text-[10px] font-normal ${percentileClass(
                              percentile,
                              metric.higherIsBetter
                            )}`}
                            title={`Better than ${percentile.toFixed(0)}% of the field that season`}
                          >
                            p{percentile.toFixed(0)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        p-values rank the player against everyone of the same gender with at least eight
        measured matches that season, counted upwards -- so a high number means more of
        that statistic, which for reception errors is worse, not better. Seasons with
        fewer than eight matches are shown without a rank.
      </p>

      {/* The trend the tournament table below states row by row. */}
      <section className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <header className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
          <h2 className="text-xs font-bold text-slate-900">Form, tournament by tournament</h2>
          <span className="text-[11px] text-slate-500">
            each point is one event, in date order
          </span>
        </header>
        <div className="p-3">
          <FormChart tournaments={profile.tournaments} />
        </div>
      </section>

      <ArchiveScopeNote seasons={seasons} />
    </div>
  );
}

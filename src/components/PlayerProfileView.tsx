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

/**
 * Colours a placing by where it falls in the field.
 *
 * Read as a share rather than an absolute number: 20th means something very
 * different in a field of 25 than in a field of 200.
 */
function rankClass(place: number, outOf: number): string {
  const share = place / outOf;
  if (share <= 0.25) return "text-emerald-600";
  if (share >= 0.75) return "text-red-600";
  return "text-slate-400";
}

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/**
 * Career totals wear the shape of a match line, so the same resolution bars
 * can render them. Only the counters matter here -- the identity fields are
 * filled to satisfy the type, never read.
 */
function totalsAsLine(totals: StatTotals): PlayerStatLine {
  return { ...totals, playerNo: "" } as unknown as PlayerStatLine;
}

function perMatch(totals: StatTotals, key: keyof StatTotals, decimals = 1): string {
  if (totals.matches === 0) return "—";
  return ((totals[key] as number) / totals.matches).toFixed(decimals);
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

  const { summary } = profile;
  const played = summary.won + summary.lost;

  const kpis: { label: string; value: string; note?: string }[] = [
    {
      label: "Tournaments",
      value: String(summary.tournaments),
      note: `${summary.matches} matches`,
    },
    {
      label: "Record",
      value: `${summary.won}–${summary.lost}`,
      note: played > 0 ? `${((summary.won / played) * 100).toFixed(0)}% won` : undefined,
    },
    {
      label: "Efficiency",
      value: career.spikeEfficiency === null ? "—" : `${career.spikeEfficiency.toFixed(1)}%`,
      note: "attack",
    },
    {
      label: "Blocks / match",
      value: perMatch(profile.career, "blockPoint", 2),
    },
    {
      label: "Points / match",
      value: perMatch(profile.career, "pointTotal"),
      note: "scored themselves",
    },
    {
      label: "Off opponent errors",
      value:
        summary.matches > 0 ? (summary.opponentErrors / summary.matches).toFixed(1) : "—",
      note:
        summary.teamPoints > 0
          ? `${((summary.opponentErrors / summary.teamPoints) * 100).toFixed(0)}% of team points`
          : undefined,
    },
  ];

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

      {/* The headline: six figures that answer "who is this player" before any
          chart has to be read. */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <CountryFlag code={profile.federationCode} className="text-lg shrink-0" />
            <h1 className="text-base sm:text-lg font-black text-slate-900 truncate">
              {profile.name}
            </h1>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {profile.federationCode}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {profile.gender === "W" ? "Women" : "Men"}
            {seasons.length > 0 && ` • seasons ${seasons[0]}–${seasons[seasons.length - 1]}`}
          </span>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-slate-200">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="px-3 sm:px-4 py-2.5">
              <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {kpi.label}
              </dt>
              <dd className="mt-0.5 font-mono text-xl sm:text-2xl font-black text-slate-900 tabular-nums leading-none">
                {kpi.value}
              </dd>
              {kpi.note && <div className="mt-1 text-[10px] text-slate-400">{kpi.note}</div>}
            </div>
          ))}
        </dl>
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

      {/* The trend, ahead of the season table that states it row by row. */}
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
                    const rank = row.ranks[metric.key];
                    return (
                      <td
                        key={metric.key}
                        className="py-1.5 px-2 text-right font-mono tabular-nums whitespace-nowrap"
                      >
                        <span className="font-bold text-slate-800">
                          {value === null ? "—" : metric.format(value)}
                        </span>
                        {rank && (
                          <span
                            className={`ml-1 text-[10px] font-normal ${rankClass(
                              rank.place,
                              rank.outOf
                            )}`}
                            title={`${ordinal(rank.place)} of ${rank.outOf} ranked players that season`}
                          >
                            #{rank.place}
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
        The number beside each figure is the player&#39;s place that season among everyone of
        the same gender with at least eight measured matches -- 1st is best, which for
        reception errors means the fewest. Seasons with fewer than eight matches are shown
        without a placing.
      </p>

      <ArchiveScopeNote seasons={seasons} />
    </div>
  );
}

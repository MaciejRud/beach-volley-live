import { PlayerStatLine } from "@/lib/fivb/types";
import type { StatTotals } from "@/lib/stats/aggregate";
import type { MetricDistribution } from "@/lib/stats/playerProfile";

/**
 * Bar primitives for the statistics views.
 *
 * Every bar here is a proportion of a total the feed reports exactly, so the
 * segments always fill the track -- no rounding gap to explain away. Colours
 * come from the app's slate/amber palette rather than a chart library.
 */

interface Segment {
  value: number;
  className: string;
  label: string;
}

/** A single stacked bar; segments narrower than 9% drop their number rather than clip it. */
function StackedBar({ segments, total }: { segments: Segment[]; total: number }) {
  if (total <= 0) {
    return <div className="h-[18px] rounded-sm bg-slate-200" />;
  }

  return (
    <div className="flex h-[18px] rounded-sm overflow-hidden bg-slate-200">
      {segments.map((segment) =>
        segment.value > 0 ? (
          <span
            key={segment.label}
            style={{ width: `${((segment.value / total) * 100).toFixed(2)}%` }}
            title={`${segment.label}: ${segment.value}`}
            className={`flex items-center justify-center font-mono text-[10px] font-bold tabular-nums ${segment.className}`}
          >
            {segment.value / total > 0.09 ? segment.value : ""}
          </span>
        ) : null
      )}
    </div>
  );
}

function BarRow({
  label,
  meta,
  children,
}: {
  label: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-[11px] font-medium text-slate-700">{label}</span>
        {meta && <span className="ml-auto font-mono text-[10px] text-slate-400">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

export function BarLegend({ items }: { items: { className: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3.5 mt-1.5 text-[11px] text-slate-500">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <i className={`inline-block w-2.5 h-2 rounded-[1px] ${item.className}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Where the points came from ---------------- */

const ORIGIN_COLOURS = {
  spike: "bg-slate-700 text-white",
  block: "bg-slate-500 text-white",
  serve: "bg-amber-500 text-white",
  opponentErrors: "bg-slate-300 text-slate-700",
};

export const ORIGIN_LEGEND = [
  { className: "bg-slate-700", label: "Attack" },
  { className: "bg-slate-500", label: "Block" },
  { className: "bg-amber-500", label: "Serve" },
  { className: "bg-slate-300", label: "Opponent errors" },
];

export interface PointOrigin {
  label: string;
  spike: number;
  block: number;
  serve: number;
  opponentErrors: number;
  total: number;
}

export function PointOriginBar({ origin }: { origin: PointOrigin }) {
  const share =
    origin.total > 0 ? Math.round((origin.opponentErrors / origin.total) * 100) : 0;

  return (
    <BarRow
      label={origin.label}
      meta={`${origin.total} pts · ${origin.opponentErrors} off errors (${share}%)`}
    >
      <StackedBar
        total={origin.total}
        segments={[
          { value: origin.spike, className: ORIGIN_COLOURS.spike, label: "Attack" },
          { value: origin.block, className: ORIGIN_COLOURS.block, label: "Block" },
          { value: origin.serve, className: ORIGIN_COLOURS.serve, label: "Serve" },
          {
            value: origin.opponentErrors,
            className: ORIGIN_COLOURS.opponentErrors,
            label: "Opponent errors",
          },
        ]}
      />
    </BarRow>
  );
}

/* ---------------- How the actions ended ---------------- */

/**
 * Each skill's total decomposes exactly into won / rally continues / error
 * (verified on 192 of 192 rows).
 *
 * Defence is deliberately absent. Its first segment would be "clean dig",
 * which a reader cannot tell apart from "rally continues" -- both mean the
 * ball stayed up, and neither scores. The dig counters are still reported as
 * plain numbers in the match table, where they read as counts rather than as
 * an outcome. Reception stays: it has no positive grade in this feed at all,
 * hence the null, so its bar is honestly an error rate.
 */
const RESOLUTION_DEFS: {
  label: string;
  total: keyof PlayerStatLine;
  won: keyof PlayerStatLine | null;
  lost: keyof PlayerStatLine;
  wonLabel: string;
}[] = [
  { label: "Attack", total: "spikeTotal", won: "spikePoint", lost: "spikeFault", wonLabel: "point" },
  { label: "Block", total: "blockTotal", won: "blockPoint", lost: "blockFault", wonLabel: "point" },
  { label: "Serve", total: "serveTotal", won: "servePoint", lost: "serveFault", wonLabel: "ace" },
  { label: "Reception", total: "receptionTotal", won: null, lost: "receptionFault", wonLabel: "" },
];

export const RESOLUTION_LEGEND = [
  { className: "bg-emerald-600", label: "point (attack, block, ace)" },
  { className: "bg-slate-300", label: "rally continues" },
  { className: "bg-red-500", label: "error" },
];

/**
 * `blockMeasured` is false for a period whose feed counted only the blocks that
 * scored. The bar is dropped rather than drawn all green: a split where one
 * segment is the whole track is not a decomposition, it is a total wearing the
 * wrong shape, and a reader has no way to tell that from a perfect blocker.
 */
export function ResolutionBars({
  line,
  blockMeasured = true,
}: {
  line: PlayerStatLine | undefined;
  blockMeasured?: boolean;
}) {
  if (!line) return <p className="text-[11px] text-slate-400">No data.</p>;

  const defs = blockMeasured
    ? RESOLUTION_DEFS
    : RESOLUTION_DEFS.filter((def) => def.label !== "Block");

  return (
    <div>
      {defs.map((def) => {
        const total = (line[def.total] as number) ?? 0;
        const won = def.won ? ((line[def.won] as number) ?? 0) : 0;
        const lost = (line[def.lost] as number) ?? 0;
        // Derived rather than read: it keeps the three segments summing to the
        // total even if the feed ever disagrees with itself.
        const continues = Math.max(0, total - won - lost);

        return (
          <BarRow key={def.label} label={def.label} meta={String(total)}>
            <StackedBar
              total={total}
              segments={[
                {
                  value: won,
                  className: "bg-emerald-600 text-white",
                  label: def.wonLabel || "won",
                },
                { value: continues, className: "bg-slate-300 text-slate-700", label: "rally continues" },
                { value: lost, className: "bg-red-500 text-white", label: "error" },
              ]}
            />
          </BarRow>
        );
      })}
    </div>
  );
}

/* ---------------- Standing against the field ---------------- */

/**
 * Totals wear the shape of a match line, so the same resolution bars can render
 * a season or a whole career. Only the counters matter -- the identity fields
 * are filled to satisfy the type and are never read.
 */
export function totalsAsLine(totals: StatTotals): PlayerStatLine {
  return { ...totals, playerNo: "" } as unknown as PlayerStatLine;
}

/**
 * One metric drawn as the field's own distribution, with the player marked on it.
 *
 * The bars are real counts, not a fitted curve. Half of these metrics are not
 * bell-shaped -- block points per match has two separate humps, because in a
 * pair one player blocks and the other defends -- and a smooth curve would put
 * its peak in the gap between them, where hardly anybody is.
 *
 * The chip carries the player's actual figure rather than a percentile, so the
 * number that gets read is the one that means something on its own; the
 * percentile survives only in the tooltip.
 */
export function DistributionRow({
  label,
  note,
  distribution,
  format,
  higherIsBetter,
  showRank = true,
  compact = false,
}: {
  label: string;
  note: string;
  distribution: MetricDistribution;
  format: (value: number) => string;
  higherIsBetter: boolean;
  /** The guessing game hides the placing: it would say more than the shape does. */
  showRank?: boolean;
  /**
   * Squeezes the row so six of them fit a phone screen at once.
   *
   * Only the game asks for this, and only because comparing six shapes is the
   * whole activity there -- a set you have to scroll through is not a set you
   * can read against itself. The note goes first: at 160px wide it wraps to
   * three lines and costs more height than the chart it explains.
   */
  compact?: boolean;
}) {
  const { value, percentile, rank, min, max, bins } = distribution;

  const strong = percentile !== null && (higherIsBetter ? percentile >= 67 : percentile <= 33);
  const weak = percentile !== null && (higherIsBetter ? percentile <= 33 : percentile >= 67);
  const accent = strong ? "bg-emerald-600" : weak ? "bg-red-500" : "bg-slate-700";

  const span = max - min;
  // A field where everyone posted the same figure has no width to place anyone
  // along, so the marker sits in the middle rather than at an arbitrary end.
  const share = value === null ? null : span > 0 ? (value - min) / span : 0.5;
  const position = share === null ? null : Math.min(1, Math.max(0, share)) * 100;
  const playerBin =
    share === null ? -1 : Math.min(bins.length - 1, Math.floor(Math.max(0, share) * bins.length));
  const tallest = Math.max(1, ...bins);

  return (
    <div>
      <div className="flex items-baseline gap-x-2">
        <span className={`font-medium text-slate-700 ${compact ? "text-[10px] sm:text-[11px]" : "text-[11px]"}`}>
          {label}
        </span>
        {showRank && (
          <span className="ml-auto font-mono text-[10px] whitespace-nowrap text-slate-500">
            {rank ? (
              <>
                #{rank.place} <span className="text-slate-300">of {rank.outOf}</span>
              </>
            ) : (
              <span className="text-slate-300">not ranked</span>
            )}
          </span>
        )}
      </div>
      {/* Its own line rather than beside the label: in a half-width column the
          two together wrap into a ragged block. */}
      <div className={`text-[10px] leading-tight text-slate-400 ${compact ? "hidden sm:block" : ""}`}>
        {note}
      </div>

      {/* Side padding so the chip can hang past either end of the track
          without being clipped when a player is the field's best or worst. */}
      <div className={compact ? "px-3 sm:px-6 pt-1" : "px-6 pt-1.5"}>
        <div className="relative">
          <div className={compact ? "h-[14px]" : "h-[15px]"} />
          <div className={`flex items-end gap-px ${compact ? "h-[30px] sm:h-[44px]" : "h-[44px]"}`}>
            {bins.map((count, index) => (
              <div
                key={index}
                className={`flex-1 rounded-t-[1px] ${
                  index === playerBin ? "bg-slate-400" : "bg-slate-200"
                }`}
                // Heights stay strictly proportional to the counts, so one
                // crowded bin really does dwarf the rest -- which is the shape
                // of the data. The tooltip carries the numbers a squashed bar
                // can no longer show.
                title={`${count} ${count === 1 ? "player" : "players"} between ${format(
                  min + (span * index) / bins.length
                )} and ${format(min + (span * (index + 1)) / bins.length)}`}
                style={{ height: count > 0 ? `${Math.max(5, (count / tallest) * 100)}%` : "0%" }}
              />
            ))}
          </div>
          <div className="h-px bg-slate-300" />

          {position !== null && value !== null && (
            <>
              <div
                style={{ left: `${position}%` }}
                className={`absolute w-[2px] -translate-x-1/2 ${accent} ${
                  compact ? "top-[14px] h-[30px] sm:top-[15px] sm:h-[44px]" : "top-[15px] h-[44px]"
                }`}
              />
              <div
                style={{ left: `${position}%` }}
                title={
                  percentile === null
                    ? undefined
                    : `Higher than ${percentile.toFixed(0)}% of the field`
                }
                className={`absolute top-0 -translate-x-1/2 rounded px-1.5 py-px font-mono text-[10px] font-bold whitespace-nowrap text-white ${accent}`}
              >
                {format(value)}
              </div>
            </>
          )}
        </div>

        <div className={`flex justify-between font-mono text-slate-400 ${compact ? "mt-0.5 text-[9px] sm:text-[10px]" : "mt-1 text-[10px]"}`}>
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </div>
      </div>
    </div>
  );
}

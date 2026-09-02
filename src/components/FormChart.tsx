"use client";

import { useMemo, useState } from "react";
import { StatTotals } from "@/lib/stats/aggregate";
import { TournamentRow } from "@/lib/stats/playerProfile";

/**
 * Tournament-by-tournament form: one point per event, in date order.
 *
 * Plain SVG rather than a charting library -- it is one line, one reference
 * rule and a row of dots, and a library would weigh more than the chart.
 */

interface Metric {
  key: string;
  label: string;
  unit: string;
  decimals: number;
  /** Null when the tournament has too little of this action to describe. */
  value: (t: StatTotals) => number | null;
  /**
   * Career figure. Pooled over all totals rather than averaged across
   * tournaments: a two-match event should not weigh as much as an eight-match
   * one, which is exactly what averaging the per-tournament values would do.
   */
  career: (rows: StatTotals[]) => number | null;
  /**
   * Fixed y-axis, so two players' charts can be read against each other.
   *
   * Chosen from the distribution across every archived tournament of every
   * player with 20+ matches (10,492 tournament-performances): each range covers
   * the 1st to 99th percentile with room to spare. Roughly one point in a
   * hundred falls outside and is drawn clamped to the edge as a hollow marker,
   * with its true value in the tooltip -- an axis that stretched to fit those
   * would defeat the purpose of fixing it.
   */
  domain: [number, number];
}

const sum = (rows: StatTotals[], key: keyof StatTotals) =>
  rows.reduce((total, r) => total + ((r[key] as number) ?? 0), 0);

const ratio = (numerator: number, denominator: number) =>
  denominator > 0 ? (numerator / denominator) * 100 : null;

const perMatch = (value: number, matches: number) => (matches > 0 ? value / matches : null);

const METRICS: Metric[] = [
  {
    key: "efficiency",
    label: "Attack efficiency",
    unit: "%",
    decimals: 1,
    value: (t) => ratio(t.spikePoint - t.spikeFault, t.spikeTotal),
    career: (rows) => ratio(sum(rows, "spikePoint") - sum(rows, "spikeFault"), sum(rows, "spikeTotal")),
    domain: [0, 65],
  },
  {
    key: "kill",
    label: "Kill %",
    unit: "%",
    decimals: 1,
    value: (t) => ratio(t.spikePoint, t.spikeTotal),
    career: (rows) => ratio(sum(rows, "spikePoint"), sum(rows, "spikeTotal")),
    domain: [25, 75],
  },
  {
    key: "points",
    label: "Points / match",
    unit: "",
    decimals: 1,
    value: (t) => perMatch(t.pointTotal, t.matches),
    career: (rows) => perMatch(sum(rows, "pointTotal"), sum(rows, "matches")),
    domain: [5, 30],
  },
  {
    key: "blocks",
    label: "Block points / match",
    unit: "",
    decimals: 2,
    value: (t) => perMatch(t.blockPoint, t.matches),
    career: (rows) => perMatch(sum(rows, "blockPoint"), sum(rows, "matches")),
    domain: [0, 7],
  },
  {
    key: "aces",
    label: "Aces / match",
    unit: "",
    decimals: 2,
    value: (t) => perMatch(t.servePoint, t.matches),
    career: (rows) => perMatch(sum(rows, "servePoint"), sum(rows, "matches")),
    domain: [0, 5],
  },
  {
    key: "reception",
    label: "Reception errors",
    unit: "%",
    decimals: 1,
    value: (t) => ratio(t.receptionFault, t.receptionTotal),
    career: (rows) => ratio(sum(rows, "receptionFault"), sum(rows, "receptionTotal")),
    domain: [0, 25],
  },
];

/**
 * Tournaments below this many attacks are dropped from the chart.
 *
 * A player who went out in qualification with nine attacks produces a point
 * that swings the whole scale on noise. The tournament table below the chart
 * still lists them -- nothing is hidden, only kept out of the trend line.
 */
const MIN_ATTACKS = 20;

/**
 * Turns the set scores into the match score: "21:19, 17:21, 15:11" -> "2:1".
 *
 * Derived rather than stored -- the set scores are already there, and the sets
 * a pair won is just how many of them they took.
 */
function matchScore(setScores: string): string {
  let won = 0;
  let lost = 0;

  for (const set of setScores.split(",")) {
    const [ours, theirs] = set.trim().split(":").map(Number);
    if (!Number.isFinite(ours) || !Number.isFinite(theirs)) continue;
    if (ours > theirs) won++;
    else if (theirs > ours) lost++;
  }

  return `${won}:${lost}`;
}

/** Tier colours, matching the app's palette rather than FIVB's branding. */
function tierColour(type: string): string {
  if (type === "51") return "#334155"; // Elite16 -- slate-700
  if (type === "52") return "#64748b"; // Challenge -- slate-500
  return "#f59e0b"; // Finals, Worlds, Olympics -- amber-500
}

/** Which point the tooltip is describing, and where to put the panel. */
interface Hover {
  index: number;
  x: number;
  y: number;
}

export function FormChart({ tournaments }: { tournaments: TournamentRow[] }) {
  const [metricKey, setMetricKey] = useState(METRICS[0].key);
  const [hover, setHover] = useState<Hover | null>(null);
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  // Oldest first: the chart reads left to right through the career.
  const points = useMemo(() => {
    return tournaments
      .filter((t) => t.totals.spikeTotal >= MIN_ATTACKS)
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((t) => ({ tournament: t, value: metric.value(t.totals) }))
      .filter((p): p is { tournament: TournamentRow; value: number } => p.value !== null);
  }, [tournaments, metric]);

  if (points.length < 3) {
    return (
      <p className="text-[11px] text-slate-400">
        Not enough tournaments with a usable sample to chart a trend.
      </p>
    );
  }

  const career = metric.career(points.map((p) => p.tournament.totals));

  const W = 1080;
  const H = 250;
  const PAD = { left: 52, right: 20, top: 26, bottom: 44 };

  // Fixed scale, so one player's chart can be laid beside another's. Values
  // outside it are drawn at the edge rather than off it.
  const [y0, y1] = metric.domain;
  const clamp = (value: number) => Math.min(y1, Math.max(y0, value));
  const outside = (value: number) => value < y0 || value > y1;

  const times = points.map((p) => new Date(p.tournament.startDate).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);

  const X = (time: number) =>
    PAD.left + (t1 === t0 ? 0.5 : (time - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const Y = (value: number) =>
    PAD.top + (1 - (clamp(value) - y0) / (y1 - y0)) * (H - PAD.top - PAD.bottom);

  const gridValues = Array.from({ length: 7 }, (_, i) => y0 + ((y1 - y0) * i) / 6);
  const seasons = [...new Set(points.map((p) => p.tournament.season))];

  const path = points
    .map((p, i) => `${i ? "L" : "M"}${X(times[i]).toFixed(1)} ${Y(p.value).toFixed(1)}`)
    .join(" ");

  const clampedCount = points.filter((p) => outside(p.value)).length;

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2.5">
        {METRICS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setMetricKey(option.key)}
            aria-pressed={option.key === metricKey}
            className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
              option.key === metricKey
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${metric.label} tournament by tournament`}
          className="w-full min-w-[560px] h-auto"
        >
          {gridValues.map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                y1={Y(value)}
                x2={W - PAD.right}
                y2={Y(value)}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={Y(value) + 3.5}
                textAnchor="end"
                className="fill-slate-400 font-mono"
                fontSize="10"
              >
                {value.toFixed(metric.decimals === 2 ? 1 : 0)}
              </text>
            </g>
          ))}

          {/* Season boundaries, so a dip can be placed in time at a glance. */}
          {seasons.map((season) => {
            const x = X(new Date(`${season}-01-01`).getTime());
            const inSeason = points
              .map((p, i) => ({ season: p.tournament.season, time: times[i] }))
              .filter((p) => p.season === season)
              .map((p) => p.time);
            const mid = (X(Math.min(...inSeason)) + X(Math.max(...inSeason))) / 2;

            return (
              <g key={season}>
                {x >= PAD.left && x <= W - PAD.right && (
                  <line
                    x1={x}
                    y1={PAD.top}
                    x2={x}
                    y2={H - PAD.bottom}
                    stroke="#cbd5e1"
                    strokeDasharray="2 3"
                  />
                )}
                <text
                  x={mid}
                  y={H - PAD.bottom + 17}
                  textAnchor="middle"
                  className="fill-slate-400 font-bold"
                  fontSize="10"
                  letterSpacing="0.08em"
                >
                  {season}
                </text>
              </g>
            );
          })}

          {career !== null && (
            <line
              x1={PAD.left}
              y1={Y(career)}
              x2={W - PAD.right}
              y2={Y(career)}
              stroke="#f59e0b"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
          )}

          <path
            d={path}
            fill="none"
            stroke="#475569"
            strokeWidth="1.8"
            strokeLinejoin="round"
            opacity="0.5"
          />

          {points.map((point, i) => {
            // A partially recorded tournament is real data covering part of the
            // draw -- hollowed out rather than dropped, so the gap is visible.
            const partial = point.tournament.coverage < 90;
            const colour = tierColour(point.tournament.type);
            const clipped = outside(point.value);

            return (
              <g
                key={point.tournament.tournamentNo}
                onMouseEnter={() =>
                  setHover({ index: i, x: X(times[i]) / W, y: Y(point.value) / H })
                }
                onMouseLeave={() => setHover(null)}
                className="cursor-pointer"
              >
                {clipped ? (
                  // Off the fixed scale: a triangle pointing the way the value
                  // actually went, so it cannot be mistaken for a real reading.
                  <path
                    d={
                      point.value > y1
                        ? `M${X(times[i])} ${Y(point.value) - 5} l4.5 6 h-9 z`
                        : `M${X(times[i])} ${Y(point.value) + 5} l4.5 -6 h-9 z`
                    }
                    fill={colour}
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                ) : (
                  <circle
                    cx={X(times[i])}
                    cy={Y(point.value)}
                    r="4.5"
                    fill={partial ? "#ffffff" : colour}
                    stroke={partial ? colour : "#ffffff"}
                    strokeWidth={partial ? 2 : 1.5}
                    strokeDasharray={partial ? "2 1.6" : undefined}
                  />
                )}
                {/* A generous invisible target: the dots are small and the
                    pointer should not have to land on them exactly. */}
                <circle cx={X(times[i])} cy={Y(point.value)} r="13" fill="transparent" />
              </g>
            );
          })}

          <text x={PAD.left} y="12" className="fill-slate-500 font-bold" fontSize="10">
            {metric.label}
          </text>
          {career !== null && (
            <text
              x={W - PAD.right}
              y="12"
              textAnchor="end"
              className="fill-amber-600 font-mono"
              fontSize="10"
            >
              {`career ${career.toFixed(metric.decimals)}${metric.unit}`}
            </text>
          )}
        </svg>

        {/* Positioned in percentages of the chart box, so it follows the point
            when the SVG scales. Flips to the other side near the right edge. */}
        {hover !== null && (
          <div
            style={{
              left: `${hover.x * 100}%`,
              top: `${hover.y * 100}%`,
              transform: `translate(${hover.x > 0.6 ? "calc(-100% - 14px)" : "14px"}, -50%)`,
            }}
            className="pointer-events-none absolute z-10 w-[248px] rounded-md border border-slate-200 bg-white shadow-lg p-2.5"
          >
            {(() => {
              const point = points[hover.index];
              const t = point.tournament;
              const won = t.matches.filter((m) => m.won).length;

              return (
                <>
                  <div className="text-[11px] font-bold text-slate-900 leading-tight">
                    {t.title}
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 mb-2">
                    {t.startDate} · {t.totals.matches} matches · {won}–
                    {t.totals.matches - won}
                  </div>

                  {t.coverage < 90 && (
                    <div className="text-[10px] text-red-500 mb-2 -mt-1">
                      Partial record -- {t.coverage}% of the event was measured
                    </div>
                  )}

                  <div className="flex items-baseline gap-1.5 pb-2 mb-2 border-b border-slate-100">
                    <span className="font-mono text-lg font-black text-slate-900 tabular-nums leading-none">
                      {point.value.toFixed(metric.decimals)}
                      {metric.unit}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {metric.label.toLowerCase()}
                    </span>
                  </div>

                  {t.matches.length > 0 ? (
                    <>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        match by match
                      </div>
                      <div className="grid gap-0.5">
                        {t.matches.map((m, index) => {
                          const value = metric.value(m.totals);
                          return (
                            <div
                              key={index}
                              className="grid grid-cols-[14px_1fr_auto_44px] gap-1.5 items-baseline text-[11px]"
                            >
                              <span
                                className={`font-mono text-[10px] font-bold ${
                                  m.won ? "text-emerald-600" : "text-red-500"
                                }`}
                              >
                                {m.won ? "W" : "L"}
                              </span>
                              <span className="truncate text-slate-700">{m.opponent}</span>
                              <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                                {matchScore(m.score)}
                              </span>
                              <span className="text-right font-mono text-[10px] font-semibold text-slate-800 tabular-nums">
                                {value === null
                                  ? "—"
                                  : `${value.toFixed(metric.decimals)}${metric.unit}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-slate-400">
                      Match detail is not in the archive for this tournament.
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3.5 mt-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 rounded-full bg-slate-700" />
          Elite16
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 rounded-full bg-slate-500" />
          Challenge
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
          Finals, Worlds, Olympics
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-2.5 h-2.5 rounded-full border-2 border-slate-400 bg-white" />
          partial record
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block w-4 h-0 border-t-2 border-dashed border-amber-500" />
          career average
        </span>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
        The scale is the same for every player, so two charts can be read against each
        other; {clampedCount > 0 ? "triangles mark points" : "a triangle marks any point"}{" "}
        beyond it, with the true figure in the tooltip. Hover a point for the matches behind
        it. Tournaments with fewer than {MIN_ATTACKS} attacks are left off -- a couple of
        qualification matches would swing the line on noise. The career figure pools every
        action rather than averaging the points, so a two-match event does not count as much
        as an eight-match one.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Match } from "@/lib/fivb/types";
import { formatDateCompact, formatDateCompactLocal } from "@/lib/dateFormatter";

interface Props {
  match: Pick<Match, "date" | "time" | "startsAtUtc">;
  className?: string;
  /** Puts the venue time on its own line instead of in brackets alongside. */
  stacked?: boolean;
  /**
   * Prefixes the kick-off with its date. Needed wherever a table spans several
   * days -- a pool plays the same 12:40 slot on two consecutive days, so the
   * time alone does not say when a match happens.
   */
  showDate?: boolean;
}

/**
 * Kick-off in the viewer's own timezone, with the venue's local time in
 * brackets when the two differ.
 *
 * The conversion runs in an effect rather than during render: on the server
 * `toLocaleTimeString` would use the server's zone, and the resulting mismatch
 * would trip React's hydration check. Until the effect runs, the venue time is
 * shown -- correct for anyone in that zone, and never blank.
 */
export function MatchTime({ match, className = "", stacked = false, showDate = false }: Props) {
  const [local, setLocal] = useState<{ time: string; date: string } | null>(null);

  useEffect(() => {
    if (!match.startsAtUtc) return;

    const d = new Date(match.startsAtUtc);
    if (Number.isNaN(d.getTime())) return;

    setLocal({
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      // Read off the same instant as the time above, so a match that crosses
      // midnight is not stamped with the venue's day.
      date: formatDateCompactLocal(d),
    });
  }, [match.startsAtUtc]);

  // Undrawn bracket slots carry a date but no time, and that date is the whole
  // point of showing them -- it says when the round will be played.
  const dateLabel = showDate ? local?.date ?? formatDateCompact(match.date ?? "") : "";

  const renderDate = (extraClass: string) =>
    dateLabel ? <span className={`font-normal text-slate-400 ${extraClass}`}>{dateLabel}</span> : null;

  if (!match.time) {
    if (!dateLabel) {
      return <span className={`text-slate-300 font-normal ${className}`}>—</span>;
    }
    return stacked ? (
      <span className={`flex flex-col leading-tight ${className}`}>
        {renderDate("text-[9px]")}
        <span className="text-slate-300 font-normal">—</span>
      </span>
    ) : (
      <span className={`whitespace-nowrap ${className}`}>
        {renderDate("mr-1.5 text-[10px]")}
        <span className="text-slate-300 font-normal">—</span>
      </span>
    );
  }

  const localTime = local?.time;
  // Before hydration, or when the times agree, one value says everything.
  const venueTime = !localTime || localTime === match.time ? null : match.time;
  const shownTime = venueTime ? localTime : match.time;

  if (stacked) {
    return (
      <span className={`flex flex-col leading-tight ${className}`}>
        {renderDate("text-[9px]")}
        <span>{shownTime}</span>
        {venueTime && (
          <span className="font-normal text-[9px] text-slate-400" title="Local time at the venue">
            {venueTime}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className={`whitespace-nowrap ${className}`}>
      {renderDate("mr-1.5 text-[10px]")}
      {shownTime}
      {venueTime && (
        <span className="ml-1 font-normal text-[9px] text-slate-400" title="Local time at the venue">
          ({venueTime})
        </span>
      )}
    </span>
  );
}

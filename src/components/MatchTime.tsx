"use client";

import { useEffect, useState } from "react";
import { Match } from "@/lib/fivb/types";

interface Props {
  match: Pick<Match, "time" | "startsAtUtc">;
  className?: string;
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
export function MatchTime({ match, className = "" }: Props) {
  const [localTime, setLocalTime] = useState<string | null>(null);

  useEffect(() => {
    if (!match.startsAtUtc) return;

    const d = new Date(match.startsAtUtc);
    if (Number.isNaN(d.getTime())) return;

    setLocalTime(
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
    );
  }, [match.startsAtUtc]);

  if (!match.time) {
    return <span className={`text-slate-300 font-normal ${className}`}>—</span>;
  }

  // Before hydration, or when the times agree, one value says everything.
  if (!localTime || localTime === match.time) {
    return <span className={className}>{match.time}</span>;
  }

  return (
    <span className={`whitespace-nowrap ${className}`}>
      {localTime}
      <span
        className="ml-1 font-normal text-[10px] text-slate-400"
        title="Local time at the venue"
      >
        ({match.time})
      </span>
    </span>
  );
}

/**
 * Date helpers for match grouping and display.
 *
 * The FIVB feed sends plain `YYYY-MM-DD` local dates with no timezone, so they
 * are parsed as UTC and formatted with `timeZone: "UTC"`. Letting the browser
 * apply a local offset would shift a match to the previous day west of GMT.
 */

const DISPLAY_LOCALE = "en-GB";

function toUtcDate(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const d = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Today as `YYYY-MM-DD`, matching the feed's date format. */
export function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function offsetIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Human-readable section heading, e.g. "Today - Wed, 19 Aug" or "Thu, 20 Aug".
 * Falls back to the raw value for dates the feed leaves empty or malformed.
 */
export function formatDateHeading(isoDate: string): string {
  const d = toUtcDate(isoDate);
  if (!d) return isoDate || "Date TBD";

  const label = d.toLocaleDateString(DISPLAY_LOCALE, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  if (isoDate === todayIso()) return `Today - ${label}`;
  if (isoDate === offsetIso(1)) return `Tomorrow - ${label}`;
  if (isoDate === offsetIso(-1)) return `Yesterday - ${label}`;
  return label;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * `DD.MM.YY` -- the dense-table form, deliberately shorter than the project's
 * `DD-MM-YYYY` convention: it shares a 44px column with the kick-off time on
 * mobile, where the full form does not fit.
 */
export function formatDateCompact(isoDate: string): string {
  const d = toUtcDate(isoDate);
  if (!d) return "";
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCFullYear() % 100)}`;
}

/**
 * The same form for an instant already resolved to the viewer's timezone.
 *
 * A late match abroad can fall on a different day here than at the venue, so
 * the date has to come from the same instant as the time shown beside it.
 */
export function formatDateCompactLocal(d: Date): string {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${pad(d.getFullYear() % 100)}`;
}

/** Short form for dense rows: `DD-MM-YYYY` per the project's date convention. */
export function formatDateShort(isoDate: string): string {
  const d = toUtcDate(isoDate);
  if (!d) return isoDate || "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getUTCFullYear()}`;
}

/**
 * Groups matches by their date, newest first, keeping each group's original
 * relative order. Matches with no date are collected under an empty key and
 * always sort last.
 */
export function groupByDate<T extends { date: string }>(items: T[]): Array<{ date: string; items: T[] }> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = item.date || "";
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return Array.from(groups.entries())
    .map(([date, items]) => ({ date, items }))
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
}

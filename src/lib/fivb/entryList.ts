import { PlayerRef, TeamEntry } from "./types";

/**
 * Splits a tournament's entry list into the groups a results page shows:
 * who plays the main draw, who plays the qualification, who waits on the
 * reserve list, who withdrew.
 *
 * VIS fills the list in stages. Weeks before an event it holds only names,
 * all with status Registered and no position anywhere; entry points and the
 * dispatch into draws arrive with the confirmed list, about 28 days out
 * (FIVB Sport Operations Manual 2026, p. 6-7 and 23). The groups are read
 * from what is filled, so the same function serves both stages.
 *
 * `IsInReserve` is documented but always comes back empty, so a reserve pair
 * is recognised by its reserve position instead.
 */

export type EntryGroupKey = "mainDraw" | "qualification" | "reserve" | "registered" | "withdrawn";

export interface EntryPlayer {
  no: string;
  name: string;
  /** Whether /players/[no] exists -- only players in the statistics archive have a page. */
  hasPage: boolean;
}

export interface EntryRow {
  teamNo: string;
  /** Combined name as FIVB prints it, used when the player split is missing. */
  name: string;
  federationCode: string;
  players: EntryPlayer[];
  /** Position within the group: draw position, reserve place or entry rank. */
  position?: number;
  entryPoints?: number;
  /** Short markers such as "Q" or "WC", each with a tooltip. */
  badges: { label: string; title: string }[];
}

export interface EntryGroup {
  key: EntryGroupKey;
  title: string;
  rows: EntryRow[];
}

const REGISTERED = 0;
const DELETED = 1;

/**
 * BeachTeamType values worth a marker. Normal (0) and Reserve (4) say nothing
 * the group does not already say.
 */
const TYPE_BADGES: Record<number, { label: string; title: string }> = {
  1: { label: "WC", title: "Wild card" },
  2: { label: "WC", title: "Technical wild card" },
  3: { label: "Late", title: "Late entry" },
  5: { label: "Host", title: "Host country team" },
  6: { label: "WC", title: "Qualification wild card" },
  7: { label: "Conf", title: "Selected by the continental confederation" },
  8: { label: "Quota", title: "Federation quota place" },
  9: { label: "Quota", title: "Continental quota place" },
  10: { label: "Org", title: "Organizer vacancy" },
};

const GROUP_TITLES: Record<EntryGroupKey, string> = {
  mainDraw: "Main draw",
  qualification: "Qualification",
  reserve: "Reserve list",
  registered: "Registered teams",
  withdrawn: "Withdrawn",
};

function toPlayer(ref: PlayerRef | undefined, linkable: ReadonlySet<string>): EntryPlayer | undefined {
  if (!ref) return undefined;
  return { no: ref.no, name: ref.name, hasPage: linkable.has(ref.no) };
}

function groupOf(entry: TeamEntry): EntryGroupKey | null {
  if (entry.status === DELETED) return null;
  if (entry.status !== REGISTERED) return "withdrawn";
  if (entry.isInMainDraw) return "mainDraw";
  if (entry.isInQualification) return "qualification";
  if (entry.positionInReserve) return "reserve";
  return "registered";
}

function positionIn(key: EntryGroupKey, entry: TeamEntry): number | undefined {
  switch (key) {
    case "mainDraw":
      return entry.mainDrawSeed;
    case "qualification":
      return entry.qualificationSeed;
    case "reserve":
      return entry.positionInReserve;
    case "registered":
      return entry.positionInEntry;
    case "withdrawn":
      return undefined;
  }
}

function toRow(key: EntryGroupKey, entry: TeamEntry, linkable: ReadonlySet<string>): EntryRow {
  const badges: EntryRow["badges"] = [];
  // A main-draw pair that also played the qualification came through it.
  if (key === "mainDraw" && entry.isInQualification) {
    badges.push({ label: "Q", title: "Qualified through the qualification tournament" });
  }
  const typeBadge = TYPE_BADGES[entry.entryType];
  if (typeBadge) badges.push(typeBadge);

  return {
    teamNo: entry.teamNo,
    name: entry.name.trim(),
    federationCode: entry.federationCode,
    players: [toPlayer(entry.player1, linkable), toPlayer(entry.player2, linkable)].filter(
      (p): p is EntryPlayer => p !== undefined
    ),
    position: positionIn(key, entry),
    entryPoints: entry.entryPoints,
    badges,
  };
}

/** The pair as the page prints it: "Lastname Firstname / Lastname Firstname". */
function displayName(row: EntryRow): string {
  return row.players.length > 0 ? row.players.map((p) => p.name).join(" / ") : row.name;
}

/**
 * Rows with a position first, in order. The rest -- a provisional list, the
 * withdrawn -- by federation code, then by the names on screen, the order the
 * player directory uses. Sorting on FIVB's own team name ("Cherif/Ahmed") put
 * pairs where their printed names did not explain.
 */
function compareRows(a: EntryRow, b: EntryRow): number {
  if (a.position !== undefined && b.position !== undefined) return a.position - b.position;
  if (a.position !== undefined) return -1;
  if (b.position !== undefined) return 1;
  return (
    a.federationCode.localeCompare(b.federationCode, "en") ||
    displayName(a).localeCompare(displayName(b), "en")
  );
}

/**
 * Groups an entry list for display. Empty groups are left out; deleted
 * entries (status 1) are dropped, as FIVB's own lists drop them.
 *
 * `linkablePlayers` holds the player numbers that have a page on this site.
 */
export function groupEntries(
  entries: Iterable<TeamEntry>,
  linkablePlayers: ReadonlySet<string>
): EntryGroup[] {
  const buckets = new Map<EntryGroupKey, EntryRow[]>();
  for (const entry of entries) {
    const key = groupOf(entry);
    if (!key) continue;
    const rows = buckets.get(key) ?? [];
    rows.push(toRow(key, entry, linkablePlayers));
    buckets.set(key, rows);
  }

  const order: EntryGroupKey[] = ["mainDraw", "qualification", "reserve", "registered", "withdrawn"];
  return order
    .filter((key) => buckets.has(key))
    .map((key) => {
      const rows = buckets.get(key)!.sort(compareRows);
      // PositionInReserve orders the list but does not start at 1 (Montreal
      // 2026's first reserve pair carries 24), so the place shown is the
      // pair's place in the queue.
      if (key === "reserve") rows.forEach((row, i) => (row.position = i + 1));
      return { key, title: GROUP_TITLES[key], rows };
    });
}

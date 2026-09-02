import { promises as fs } from "fs";
import { StatTotals } from "./aggregate";
import { AGGREGATES_FILE, AggregateFile, decodeTotals } from "./aggregateFile";

/**
 * Season averages, read once per server instance from the pre-built aggregate
 * file.
 *
 * The file is generated at build time and is part of the deployment, so this is
 * a plain read with no expiry: the numbers cannot change while the process is
 * running. A missing file is not an error -- it just means the archive has not
 * been built yet, and pages fall back to showing match numbers alone.
 */

let cached: AggregateFile | null | undefined;

async function load(): Promise<AggregateFile | null> {
  if (cached !== undefined) return cached;

  try {
    const raw = await fs.readFile(AGGREGATES_FILE, "utf-8");
    cached = JSON.parse(raw) as AggregateFile;
  } catch (err: any) {
    if (err?.code !== "ENOENT") throw err;
    cached = null;
  }

  return cached;
}

/** Season totals for the given players, keyed by player number. Absent players are omitted. */
export async function seasonAveragesFor(
  playerNos: string[],
  season: number
): Promise<Record<string, StatTotals>> {
  const file = await load();
  if (!file) return {};

  const result: Record<string, StatTotals> = {};
  for (const playerNo of playerNos) {
    const values = file.players[playerNo]?.seasons[String(season)];
    if (!values) continue;
    result[playerNo] = decodeTotals(values, file.columns);
  }

  return result;
}

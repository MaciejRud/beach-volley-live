import { promises as fs } from "fs";
import path from "path";
import { buildAggregates } from "../src/lib/stats/aggregate";
import { AGGREGATES_FILE, AGGREGATE_COLUMNS, encodeTotals } from "../src/lib/stats/aggregateFile";
import { readAllTournaments } from "../src/lib/stats/archive";

/**
 * Reduces the tournament archive to per-player season totals.
 *
 * The archive holds every match line, which is far more than any page needs and
 * too much to read inside a request. This produces one small file that a route
 * can import directly, so the season averages shown next to a match cost no
 * file system access at runtime.
 *
 * Re-run after every backfill: npx tsx scripts/build-aggregates.ts
 */

async function main() {
  const tournaments = await readAllTournaments();
  if (tournaments.length === 0) {
    throw new Error("Archive is empty -- run scripts/backfill-stats.ts first");
  }

  const aggregates = await buildAggregates(tournaments);

  const players: Record<string, { gender: string; seasons: Record<string, number[]> }> = {};
  for (const [playerNo, aggregate] of aggregates) {
    const seasons: Record<string, number[]> = {};
    for (const season of aggregate.seasons) {
      seasons[season.season] = encodeTotals(season.totals);
    }
    players[playerNo] = { gender: aggregate.gender, seasons };
  }

  const sorted: typeof players = {};
  for (const key of Object.keys(players).sort((a, b) => Number(a) - Number(b))) {
    sorted[key] = players[key];
  }

  await fs.mkdir(path.dirname(AGGREGATES_FILE), { recursive: true });
  await fs.writeFile(
    AGGREGATES_FILE,
    JSON.stringify({ columns: AGGREGATE_COLUMNS, players: sorted }) + "\n",
    "utf-8"
  );

  const seasons = new Set(tournaments.map((t) => t.season));
  const bytes = (await fs.stat(AGGREGATES_FILE)).size;
  console.log(
    `Wrote ${aggregates.size} players over ${seasons.size} seasons ` +
      `from ${tournaments.length} tournaments (${(bytes / 1024).toFixed(1)} KB).`
  );
}

main().catch((err) => {
  console.error("Failed to build aggregates:", err?.message || err);
  process.exit(1);
});

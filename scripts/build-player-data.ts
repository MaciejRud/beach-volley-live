import { promises as fs } from "fs";
import path from "path";
import { StatTotals, addLine, emptyTotals } from "../src/lib/stats/aggregate";
import { AGGREGATE_COLUMNS, encodeTotals } from "../src/lib/stats/aggregateFile";
import { decodeStatTuple, readAllTournaments, readPlayerDirectory } from "../src/lib/stats/archive";
import {
  PLAYER_FORM_FILE,
  PLAYER_INDEX_FILE,
  PlayerFormEntry,
  PlayerIndexEntry,
} from "../src/lib/stats/playerFiles";

/**
 * Builds the two files the players section reads.
 *
 * data/player-index.json is small and ships to the browser, so searching by
 * name costs no request. data/player-form.json holds per-tournament totals and
 * is read only on the server, when one player's page is rendered.
 *
 * Run after every backfill: npx tsx scripts/build-player-data.ts
 */

async function main() {
  const [tournaments, directory] = await Promise.all([
    readAllTournaments(),
    readPlayerDirectory(),
  ]);

  if (tournaments.length === 0) {
    throw new Error("Archive is empty -- run scripts/backfill-stats.ts first");
  }

  // Newest tournament first, so each player's form comes out in that order.
  const ordered = [...tournaments].sort((a, b) => b.startDate.localeCompare(a.startDate));

  const form: Record<string, PlayerFormEntry[]> = {};
  const careerMatches = new Map<string, number>();
  const latestSeason = new Map<string, number>();

  for (const tournament of ordered) {
    const perPlayer = new Map<string, StatTotals>();

    for (const tuples of Object.values(tournament.matches)) {
      for (const tuple of tuples) {
        const line = decodeStatTuple(tuple, tournament.columns);
        let totals = perPlayer.get(line.playerNo);
        if (!totals) {
          totals = emptyTotals();
          perPlayer.set(line.playerNo, totals);
        }
        addLine(totals, line);
      }
    }

    for (const [playerNo, totals] of perPlayer) {
      (form[playerNo] ??= []).push({
        tournamentNo: tournament.tournamentNo,
        code: tournament.code,
        title: tournament.title,
        season: tournament.season,
        startDate: tournament.startDate,
        totals: encodeTotals(totals),
      });

      careerMatches.set(playerNo, (careerMatches.get(playerNo) ?? 0) + totals.matches);
      latestSeason.set(
        playerNo,
        Math.max(latestSeason.get(playerNo) ?? 0, tournament.season)
      );
    }
  }

  const players: PlayerIndexEntry[] = [...careerMatches.keys()]
    .map((playerNo) => {
      const known = directory[playerNo];
      return {
        n: playerNo,
        // A player with statistics but no entry-list record would be unnameable;
        // the number at least keeps them findable rather than dropping them.
        d: known?.name ?? `#${playerNo}`,
        f: known?.federationCode ?? "",
        g: known?.gender ?? "M",
        m: careerMatches.get(playerNo) ?? 0,
        s: latestSeason.get(playerNo) ?? 0,
      };
    })
    // Most-played first: the default listing should open on names people know.
    .sort((a, b) => b.m - a.m || a.d.localeCompare(b.d));

  const seasons = [...new Set(tournaments.map((t) => t.season))].sort((a, b) => a - b);

  await fs.mkdir(path.dirname(PLAYER_INDEX_FILE), { recursive: true });
  await fs.writeFile(
    PLAYER_INDEX_FILE,
    JSON.stringify({ seasons, players }) + "\n",
    "utf-8"
  );
  await fs.writeFile(
    PLAYER_FORM_FILE,
    JSON.stringify({ columns: AGGREGATE_COLUMNS, players: form }) + "\n",
    "utf-8"
  );

  const indexKb = (await fs.stat(PLAYER_INDEX_FILE)).size / 1024;
  const formKb = (await fs.stat(PLAYER_FORM_FILE)).size / 1024;
  console.log(
    `Wrote ${players.length} players: index ${indexKb.toFixed(1)} KB (ships to the client), ` +
      `form ${formKb.toFixed(1)} KB (server only).`
  );
}

main().catch((err) => {
  console.error("Failed to build player data:", err?.message || err);
  process.exit(1);
});

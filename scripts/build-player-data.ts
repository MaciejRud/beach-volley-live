import { promises as fs } from "fs";
import path from "path";
import { StatTotals, addLine, emptyTotals } from "../src/lib/stats/aggregate";
import { AGGREGATE_COLUMNS, encodeTotals } from "../src/lib/stats/aggregateFile";
import { decodeStatTuple, readAllTournaments, readPlayerDirectory } from "../src/lib/stats/archive";
import {
  PLAYER_FORM_FILE,
  PLAYER_INDEX_FILE,
  PlayerFormEntry,
  PlayerFormMatch,
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
    const perPlayerMatches = new Map<string, PlayerFormMatch[]>();
    const perPlayerWins = new Map<string, number>();
    const perPlayerTeamPoints = new Map<string, number>();
    const perPlayerPairPoints = new Map<string, number>();

    // Matches in playing order, so a tournament's tooltip reads first round
    // downwards. Match numbers rise through the draw.
    const matchNumbers = Object.keys(tournament.matches).sort((a, b) => Number(a) - Number(b));

    for (const matchNo of matchNumbers) {
      const info = tournament.matchInfo?.[matchNo];

      // Points scored by each side in this match, read off the set scores.
      const sideScores = { A: 0, B: 0 };
      for (const set of info?.s.split(", ") ?? []) {
        const [a, b] = set.split(":").map(Number);
        if (Number.isFinite(a)) sideScores.A += a;
        if (Number.isFinite(b)) sideScores.B += b;
      }

      // The pair's own scoring, needed before the per-player loop so both
      // partners' points are counted for each of them.
      const pairPoints = { A: 0, B: 0 };
      for (const tuple of tournament.matches[matchNo]) {
        const line = decodeStatTuple(tuple, tournament.columns);
        if (info?.pa.includes(line.playerNo)) pairPoints.A += line.pointTotal;
        else if (info?.pb.includes(line.playerNo)) pairPoints.B += line.pointTotal;
      }

      for (const tuple of tournament.matches[matchNo]) {
        const line = decodeStatTuple(tuple, tournament.columns);
        let totals = perPlayer.get(line.playerNo);
        if (!totals) {
          totals = emptyTotals();
          perPlayer.set(line.playerNo, totals);
        }
        addLine(totals, line);

        if (!info) continue;

        // Which side of the net this player was on decides both the opponent
        // and how the set scores should be read. Matched on player number, not
        // name -- the tour has two Mols and two Grimalts.
        const onA = info.pa.includes(line.playerNo);
        const onB = info.pb.includes(line.playerNo);
        if (!onA && !onB) continue;

        const matchTotals = emptyTotals();
        addLine(matchTotals, line);

        const side = onA ? "A" : "B";
        const won = info.w === side;
        if (won) perPlayerWins.set(line.playerNo, (perPlayerWins.get(line.playerNo) ?? 0) + 1);
        perPlayerTeamPoints.set(
          line.playerNo,
          (perPlayerTeamPoints.get(line.playerNo) ?? 0) + sideScores[side]
        );
        perPlayerPairPoints.set(
          line.playerNo,
          (perPlayerPairPoints.get(line.playerNo) ?? 0) + pairPoints[side]
        );

        (perPlayerMatches.get(line.playerNo) ??
          perPlayerMatches.set(line.playerNo, []).get(line.playerNo)!)
          .push({
            o: onA ? info.b : info.a,
            // Scores come team-A first; flipped so the player's own score leads.
            s: onA
              ? info.s
              : info.s
                  .split(", ")
                  .map((set) => set.split(":").reverse().join(":"))
                  .join(", "),
            w: won,
            t: encodeTotals(matchTotals),
          });
      }
    }

    // Coverage separates "this pair played badly" from "we only have half the
    // draw"; the chart marks the second case rather than hiding it.
    const coverage =
      tournament.matchCount > 0
        ? Math.round((tournament.measuredMatchCount / tournament.matchCount) * 100)
        : 100;

    for (const [playerNo, totals] of perPlayer) {
      (form[playerNo] ??= []).push({
        tournamentNo: tournament.tournamentNo,
        code: tournament.code,
        title: tournament.title,
        season: tournament.season,
        startDate: tournament.startDate,
        type: tournament.type,
        coverage,
        totals: encodeTotals(totals),
        won: perPlayerWins.get(playerNo) ?? 0,
        teamPoints: perPlayerTeamPoints.get(playerNo) ?? 0,
        pairPoints: perPlayerPairPoints.get(playerNo) ?? 0,
        matches: perPlayerMatches.get(playerNo) ?? [],
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
    // Grouped by federation, then alphabetically within it: people look for a
    // player by their country far more often than by how much they have played.
    // Players with no federation on record sort last rather than under "".
    .sort(
      (a, b) =>
        (a.f ? 0 : 1) - (b.f ? 0 : 1) || a.f.localeCompare(b.f) || a.d.localeCompare(b.d)
    );

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

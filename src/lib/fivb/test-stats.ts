import { FivbClient } from "./client";
import {
  spikeSuccess,
  spikeEfficiency,
  blockSuccess,
  serveRisk,
  receptionFaultRate,
  teamPointBreakdown,
} from "./statistics";

/**
 * Smoke test for the statistics layer against the live FIVB API.
 *
 * Uses the two reference cases from the plan: the Hamburg 2026 final, which is
 * fully measured, and Gstaad 2022, where only the semi-finals and final were
 * recorded -- so it also proves an unmeasured match comes back as null.
 */

const MEASURED_MATCH = 544995; // Hamburg 2026 final, Ehlers/Wüst - Mol/Sørum
const SPARSE_TOURNAMENT = 6298; // Gstaad 2022, 7% of matches measured

const pct = (v: number | null) => (v === null ? "n/d" : `${v.toFixed(1)}%`);

async function main() {
  console.log("=== 1. Measured match ===");
  const match = await FivbClient.getMatch(MEASURED_MATCH);
  if (!match) throw new Error(`Match ${MEASURED_MATCH} not found`);
  console.log(
    `${match.teamA.name} vs ${match.teamB.name} | ${match.roundName} | status=${match.status} | ` +
      `sets ${match.sets.map((s) => `${s.scoreA}:${s.scoreB}`).join(", ")}`
  );

  const stats = await FivbClient.getMatchStatistics(MEASURED_MATCH, match.status === "finished");
  if (!stats) throw new Error("Expected statistics for the Hamburg final");
  console.log(`match rows: ${stats.match.length}, set rows: ${stats.sets.length}`);

  const entries = await FivbClient.getTeamEntries(match.tournamentId);
  const teamA = match.teamA.teamNo ? entries.get(match.teamA.teamNo) : undefined;
  const teamB = match.teamB.teamNo ? entries.get(match.teamB.teamNo) : undefined;
  if (!teamA || !teamB) throw new Error("Entry list did not cover both teams");

  const nameOf = (playerNo: string) =>
    [teamA.player1, teamA.player2, teamB.player1, teamB.player2].find((p) => p?.no === playerNo)?.name ??
    `#${playerNo}`;

  console.log("\n=== 2. Identities and metrics (match rows) ===");
  for (const line of stats.match) {
    const spikeOk = line.spikeTotal === line.spikePoint + line.spikeFault + line.spikeContinue;
    const pointOk = line.pointTotal === line.spikePoint + line.blockPoint + line.servePoint;
    const setSum = stats.sets
      .filter((s) => s.playerNo === line.playerNo)
      .reduce((total, s) => total + s.spikeTotal, 0);

    console.log(
      `${nameOf(line.playerNo).padEnd(18)} spikes ${String(line.spikeTotal).padStart(2)} ` +
        `(${line.spikePoint}/${line.spikeFault}/${line.spikeContinue}) ` +
        `skut ${pct(spikeSuccess(line))} efekt ${pct(spikeEfficiency(line))} ` +
        `blok ${pct(blockSuccess(line))} ryzyko ${pct(serveRisk(line))} przyj ${pct(receptionFaultRate(line))} | ` +
        `pkt ${line.pointTotal} | identities spike=${spikeOk} point=${pointOk} | sets sum ${setSum}`
    );
  }

  console.log("\n=== 3. Points off opponent errors ===");
  for (const [side, team] of [["A", teamA], ["B", teamB]] as const) {
    const playerNos = [team.player1?.no, team.player2?.no].filter(Boolean);
    const lines = stats.match.filter((l) => playerNos.includes(l.playerNo));
    const breakdown = teamPointBreakdown(match.sets, side, lines);
    console.log(
      `${team.name.padEnd(22)} team ${breakdown.teamPoints} = own ${breakdown.playerPoints} + ` +
        `opponent errors ${breakdown.opponentErrors}`
    );
  }

  console.log("\n=== 4. Unmeasured match returns null ===");
  const sparse = await FivbClient.getMatches(SPARSE_TOURNAMENT);
  console.log(`Gstaad 2022: ${sparse.length} matches, probing the first 8`);
  let nullFound = false;
  for (const m of sparse.slice(0, 8)) {
    const s = await FivbClient.getMatchStatistics(m.no, m.status === "finished");
    console.log(`  match ${m.no} (${m.roundName}): ${s === null ? "stats = null" : `${s.match.length} rows`}`);
    if (s === null) nullFound = true;
  }
  if (!nullFound) throw new Error("Expected at least one unmeasured match in Gstaad 2022");

  console.log("\nOK");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});

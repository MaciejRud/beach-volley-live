import { FivbClient } from "./client";

async function main() {
  console.log("=== Testing FIVB VIS XML Client in Node.js ===");
  const year = new Date().getFullYear();
  console.log(`1. Fetching tournaments for year ${year}...`);

  const tournaments = await FivbClient.getTournaments(year);
  console.log(`Found ${tournaments.length} tournaments in ${year}.`);
  if (tournaments.length > 0) {
    const sample = tournaments.slice(0, 3);
    console.log("Sample tournaments:", JSON.stringify(sample, null, 2));

    const firstActive = tournaments.find((t) => t.status === "running") || tournaments[0];
    console.log(`\n2. Fetching matches for tournament: ${firstActive.title} (No: ${firstActive.no})...`);
    const matches = await FivbClient.getMatches(firstActive.no, firstActive);
    console.log(`Found ${matches.length} matches.`);
    if (matches.length > 0) {
      console.log("Sample match:", JSON.stringify(matches[0], null, 2));
    }
  }

  console.log("\n3. Testing Polish teams fetch (country=POL)...");
  const polSummary = await FivbClient.getPolishTeamsSummary();
  console.log(`Active POL matches: ${polSummary.activeMatches.length}`);
  console.log(`Upcoming POL matches: ${polSummary.upcomingMatches.length}`);
  console.log(`Recent POL matches: ${polSummary.recentMatches.length}`);
  if (polSummary.recentMatches.length > 0) {
    console.log("Recent POL match sample:", JSON.stringify(polSummary.recentMatches[0], null, 2));
  }

  console.log("\n✅ FIVB API test completed successfully!");
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
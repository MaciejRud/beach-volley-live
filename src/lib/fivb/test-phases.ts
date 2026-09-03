import { FivbClient } from "./client";
import { groupByDraw } from "./phases";

/**
 * Snapshot of how a tournament's matches get grouped and, above all, ordered.
 *
 * Round *order* is what the grouping logic decides, so counts alone would not
 * catch a regression -- the output below is an ordered list on purpose.
 *
 * BASELINE are tournaments whose pages already render grouped today. Their
 * output must stay byte-identical across changes to the grouping logic.
 * OBSERVED are tournaments that render as a flat list today; their output is
 * expected to change, and is printed so the new structure can be eyeballed.
 *
 * Run: npm run test:phases
 */

const BASELINE: Array<[number, string]> = [
  [8982, "BPT Elite16 Montreal (M)"],
  [8981, "BPT Elite Montreal (W)"],
  [9127, "BPT Futures Brno (M)"],
  [9103, "CSVP Finals Iquique (M)"],
];

const OBSERVED: Array<[number, string]> = [
  [8938, "EuroBeachVolley Stare Jablonki (M)"],
  [9165, "Latvian Championships (M)"],
  [9176, "Swiss Volley Beachtour (W)"],
  [9094, "CEV U20 European Championships (M)"],
  [9095, "CEV U20 European Championships (W)"],
];

async function dump(no: number, label: string) {
  const matches = await FivbClient.getMatches(no);
  const groups = groupByDraw(matches);

  console.log(`=== ${label} [${no}] ${matches.length} matches ===`);
  if (groups.length === 0) {
    console.log("  (no phase data - flat list)");
    return;
  }

  for (const group of groups) {
    console.log(`[${group.title}]`);
    for (const block of group.blocks) {
      if (group.showBlockTitles) console.log(`  # ${block.title}`);
      for (const phase of block.phases) {
        console.log(`  ${phase.name} (${phase.matches.length})`);
      }
    }
  }
}

async function main() {
  console.log("##### BASELINE - must not change #####\n");
  for (const [no, label] of BASELINE) await dump(no, label);

  console.log("\n##### OBSERVED - expected to change #####\n");
  for (const [no, label] of OBSERVED) await dump(no, label);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

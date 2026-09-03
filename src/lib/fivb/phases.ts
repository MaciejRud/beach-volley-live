import { Match } from "./types";

/**
 * Groups a tournament's matches the way the official results pages present
 * them: a qualification block and a main-draw block, each split into rounds
 * ordered from the final backwards.
 *
 * The feed marks the block in RoundPhase ("3" = qualification, "4" = main
 * draw) and names the round twice: RoundName ("Pool A", "Quarterfinals") for
 * humans and RoundCode ("PA", "QF") as a stable key. Ordering keys off the
 * code, because the names are not dependable -- FIVB ships "Final 5rd Place",
 * and the Nations Cup calls its quarter-finals "QF" while everyone else spells
 * them out.
 */

export type DrawSection = "qualification" | "mainDraw";

/**
 * Which part of the draw a round belongs to.
 *
 * "bracket" is the road to the title, "places" the parallel bracket that only
 * settles final standings (5th place matches, classification rounds), "pools"
 * the round-robin stage.
 */
export type BlockKind = "bracket" | "places" | "pools";

export interface PhaseGroup {
  /** Round name straight from the feed, e.g. "Pool A" or "Semifinals". */
  name: string;
  /** What to show: the feed's name, or a repaired one where it is defective. */
  label: string;
  /** What the round settles, where the label does not already say it. */
  stake?: string;
  matches: Match[];
}

export interface DrawBlock {
  kind: BlockKind;
  title: string;
  phases: PhaseGroup[];
}

export interface DrawGroup {
  section: DrawSection;
  title: string;
  blocks: DrawBlock[];
  /**
   * Whether the block titles carry information. An event without a placement
   * bracket has one meaningful block, and naming it would only add a heading
   * where today there is none.
   */
  showBlockTitles: boolean;
}

const QUALIFICATION_PHASE = "3";
const MAIN_DRAW_PHASE = "4";

const FINAL = /^F(\d+)$/;
const CLASSIFICATION = /^C(\d+)[-/](\d+)$/;
const PLACEMENT_SEMI = /^SF(\d+)[-/](\d+)$/;
const ROUND_OF = /^R(\d+)$/;
const POOL = /^P([A-Z])$/;
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

const BLOCK_TITLES: Record<BlockKind, string> = {
  bracket: "Bracket",
  places: "Placement matches",
  pools: "Pools",
};

/** Canonical top-to-bottom order of the blocks once all of them are drawn. */
const BLOCK_ORDER: BlockKind[] = ["bracket", "places", "pools"];

/**
 * Display order inside the main draw when the round code is missing, finals
 * first. Kept as the fallback for a feed that stops sending RoundCode.
 */
const MAIN_DRAW_ORDER = [
  /^final.*1st/i,
  /^final.*3rd/i,
  /^final/i,
  /^semifinal/i,
  /^quarterfinal/i,
  /^round of/i,
  /^pool/i,
];

function orderIndex(name: string, patterns: RegExp[]): number {
  const i = patterns.findIndex((p) => p.test(name));
  return i === -1 ? patterns.length : i;
}

/** "Round 2" sorts above "Round 1": later qualification rounds come first. */
function roundNumber(name: string): number {
  const m = name.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** 1 -> "1st", 3 -> "3rd", 11 -> "11th". */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Which block a round belongs to, and where it sits inside it.
 *
 * The sort key is compared element by element, so the first number separates
 * stages and the second orders rounds within a stage.
 */
function classify(code: string, bracket: string, name: string): { block: BlockKind; key: number[] } {
  const pool = code.match(POOL);
  if (pool) return { block: "pools", key: [pool[1].charCodeAt(0)] };

  const final = code.match(FINAL);
  if (final) {
    const place = Number(final[1]);
    // 1st and 3rd place close the main bracket; 5th and below belong to the
    // parallel one.
    return place <= 3 ? { block: "bracket", key: [0, place] } : { block: "places", key: [0, place] };
  }

  const classification = code.match(CLASSIFICATION);
  if (classification) return { block: "places", key: [2, Number(classification[1])] };

  const placementSemi = code.match(PLACEMENT_SEMI);
  if (placementSemi) return { block: "places", key: [1, Number(placementSemi[1])] };

  // Losers' quarter-finals decide who plays for 5th and who for 7th.
  if (code === "LQF") return { block: "places", key: [1, 5] };

  if (code === "SF") return { block: "bracket", key: [1, 0] };
  if (code === "QF") return { block: "bracket", key: [2, 0] };

  const roundOf = code.match(ROUND_OF);
  if (roundOf) {
    const size = Number(roundOf[1]);
    // The same "R<n>" shape means two different things: an elimination round
    // of N teams in the winners' bracket, a placement match in the losers'
    // one. Only RoundBracket tells them apart -- a size threshold would be a
    // guess.
    return bracket === "L"
      ? { block: "places", key: [2, size] }
      : { block: "bracket", key: [3, size] };
  }

  // Numbered rounds: roman ("II") on most tours, arabic ("2") on the Polish
  // one. Later rounds come first, hence the negation.
  const roman = ROMAN[code];
  if (roman) return { block: "bracket", key: [4, -roman] };
  if (/^\d+$/.test(code)) return { block: "bracket", key: [4, -Number(code)] };

  // No usable code: fall back to reading the name, as this file used to.
  const byName = orderIndex(name, MAIN_DRAW_ORDER);
  const poolByName = MAIN_DRAW_ORDER.length - 1;
  if (byName === poolByName) return { block: "pools", key: [name.charCodeAt(5) || 0] };
  return { block: "bracket", key: [5, byName] };
}

/**
 * Display name for a round.
 *
 * Only codes whose feed name is defective get rebuilt -- "Final 5rd Place" is
 * FIVB's typo, and the Nations Cup abbreviates its quarter-finals to "QF".
 * Everything else is shown exactly as the feed spells it.
 */
function labelFor(code: string, name: string): string {
  const final = code.match(FINAL);
  if (final) return `Final ${ordinal(Number(final[1]))} Place`;
  if (code === "SF") return "Semifinals";
  if (code === "QF") return "Quarterfinals";
  if (code === "LQF") return "Loser Quarterfinals";
  return name;
}

/**
 * What the round settles, for rounds whose name does not already say it.
 *
 * The feed fills WinnerRank/LoserRank only where the format pins a placing:
 * an event with a classification bracket leaves its quarter-finals at 0,
 * because those losers play on rather than landing on a fixed rank.
 */
function stakeFor(winnerRank: number, loserRank: number, label: string): string | undefined {
  // Suppressed where the label already carries the number, so "Final 5th
  // Place" and "Classification 9-13" do not restate themselves. "Round of 16"
  // is the case this has to keep: the 16 is a field size, not a placing, so
  // its losers finishing 9th is new information.
  const inLabel = (label.match(/\d+/g) ?? []).map(Number);
  if (winnerRank > 0 && inLabel.includes(winnerRank)) return undefined;
  if (winnerRank === 0 && loserRank > 0 && inLabel.includes(loserRank)) return undefined;

  if (winnerRank > 0 && loserRank > 0) {
    return `Winner ${ordinal(winnerRank)}, loser ${ordinal(loserRank)}`;
  }
  if (loserRank > 0) return `Loser ranks ${ordinal(loserRank)}`;
  return undefined;
}

/**
 * True once a match has a real fixture rather than being an empty bracket
 * slot. The feed lists the whole main draw as placeholders from the moment a
 * tournament is created, so the presence of main-draw rows says nothing on its
 * own; named teams mean the draw has been made.
 */
function isDrawn(m: Match): boolean {
  return m.fixtureState !== "undrawn";
}

function buildPhase(name: string, items: Match[]): PhaseGroup {
  const first = items[0];
  const label = labelFor(first.roundCode ?? "", name);
  return {
    name,
    label,
    stake: stakeFor(first.winnerRank ?? 0, first.loserRank ?? 0, label),
    // Ascending match number reads like the schedule inside a round.
    matches: [...items].sort((a, b) => Number(a.matchNumber || 0) - Number(b.matchNumber || 0)),
  };
}

function groupByRoundName(matches: Match[]): Map<string, Match[]> {
  const byName = new Map<string, Match[]>();
  for (const m of matches) {
    const name = m.roundName || m.round || "Other";
    const bucket = byName.get(name);
    if (bucket) {
      bucket.push(m);
    } else {
      byName.set(name, [m]);
    }
  }
  return byName;
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Qualification is a single flat run of rounds, latest first. */
function buildQualificationBlocks(matches: Match[]): DrawBlock[] {
  const phases = Array.from(groupByRoundName(matches).entries())
    .map(([name, items]) => buildPhase(name, items))
    .sort((a, b) => roundNumber(b.name) - roundNumber(a.name) || a.name.localeCompare(b.name));

  return [{ kind: "bracket", title: BLOCK_TITLES.bracket, phases }];
}

function buildMainDrawBlocks(matches: Match[]): DrawBlock[] {
  const buckets = new Map<BlockKind, Array<{ phase: PhaseGroup; key: number[] }>>();

  for (const [name, items] of groupByRoundName(matches)) {
    const first = items[0];
    const { block, key } = classify(first.roundCode ?? "", first.roundBracket ?? "", name);
    const bucket = buckets.get(block) ?? [];
    bucket.push({ phase: buildPhase(name, items), key });
    buckets.set(block, bucket);
  }

  // Fixed order, whatever stage the tournament is at: the decisive matches
  // stay on top and the pools sit under them. Reordering by what happens to be
  // drawn would move the bracket around mid-tournament, which is exactly what
  // makes a results page hard to read twice.
  return BLOCK_ORDER.filter((kind) => buckets.has(kind)).map((kind) => ({
    kind,
    title: BLOCK_TITLES[kind],
    phases: buckets
      .get(kind)!
      .sort((a, b) => compareKeys(a.key, b.key))
      .map((entry) => entry.phase),
  }));
}

/**
 * Splits matches into qualification and main draw. Returns an empty array when
 * the feed carries no phase information, so callers can fall back to a flat
 * list rather than rendering a single meaningless section.
 *
 * Qualification leads while it is the only thing drawn, then drops below the
 * main draw as soon as main-draw fixtures exist -- from that point the main
 * draw is what people came to look at.
 */
export function groupByDraw(matches: Match[]): DrawGroup[] {
  const qualification = matches.filter((m) => m.roundPhase === QUALIFICATION_PHASE);
  const mainDraw = matches.filter((m) => m.roundPhase === MAIN_DRAW_PHASE);

  if (qualification.length === 0 && mainDraw.length === 0) return [];

  const mainDrawDrawn = mainDraw.some(isDrawn);
  const groups: DrawGroup[] = [];

  const qualificationGroup = (): DrawGroup => ({
    section: "qualification",
    title: "Qualification",
    blocks: buildQualificationBlocks(qualification),
    showBlockTitles: false,
  });

  if (qualification.length > 0 && !mainDrawDrawn) {
    groups.push(qualificationGroup());
  }

  if (mainDraw.length > 0) {
    const blocks = buildMainDrawBlocks(mainDraw);
    groups.push({
      section: "mainDraw",
      title: "Main Draw",
      blocks,
      showBlockTitles: blocks.some((b) => b.kind === "places" && b.phases.length > 0),
    });
  }

  if (qualification.length > 0 && mainDrawDrawn) {
    groups.push(qualificationGroup());
  }

  return groups;
}

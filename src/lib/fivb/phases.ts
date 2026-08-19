import { Match } from "./types";

/**
 * Groups a tournament's matches the way the official results pages present
 * them: a qualification block and a main-draw block, each split into rounds
 * ordered from the final backwards.
 *
 * The feed marks the block in RoundPhase ("3" = qualification, "4" = main
 * draw) and names the round in RoundName ("Pool A", "Quarterfinals", ...).
 */

export type DrawSection = "qualification" | "mainDraw";

export interface PhaseGroup {
  /** Round label straight from the feed, e.g. "Pool A" or "Semifinals". */
  name: string;
  matches: Match[];
}

export interface DrawGroup {
  section: DrawSection;
  title: string;
  phases: PhaseGroup[];
}

const QUALIFICATION_PHASE = "3";
const MAIN_DRAW_PHASE = "4";

/**
 * Display order within the main draw, finals first. Pools come last so the
 * decisive matches stay at the top of a long page.
 *
 * "Round of N" covers every elimination round between the quarterfinals and
 * the pools -- 12, 16, 18 and 24 all occur across the tiers -- and they are
 * ranked among themselves by field size ascending, so Round of 16 precedes
 * Round of 24.
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

/** Field size in "Round of N"; 0 when the label carries no number. */
function roundOfSize(name: string): number {
  const m = name.match(/^round of\s+(\d+)/i);
  return m ? Number(m[1]) : 0;
}

/** "Round 2" sorts above "Round 1": later qualification rounds come first. */
function roundNumber(name: string): number {
  const m = name.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function sortPhases(phases: PhaseGroup[], section: DrawSection): PhaseGroup[] {
  return [...phases].sort((a, b) => {
    if (section === "qualification") {
      return roundNumber(b.name) - roundNumber(a.name) || a.name.localeCompare(b.name);
    }

    const rank = orderIndex(a.name, MAIN_DRAW_ORDER) - orderIndex(b.name, MAIN_DRAW_ORDER);
    if (rank !== 0) return rank;

    // Smaller field = later stage, so Round of 16 sorts above Round of 24.
    const sizeA = roundOfSize(a.name);
    const sizeB = roundOfSize(b.name);
    if (sizeA && sizeB && sizeA !== sizeB) return sizeA - sizeB;

    // Pools read naturally as A, B, C, D.
    return a.name.localeCompare(b.name);
  });
}

function buildPhases(matches: Match[], section: DrawSection): PhaseGroup[] {
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

  const phases = Array.from(byName.entries()).map(([name, items]) => ({
    name,
    // Ascending match number reads like the schedule inside a round.
    matches: [...items].sort((a, b) => Number(a.matchNumber || 0) - Number(b.matchNumber || 0)),
  }));

  return sortPhases(phases, section);
}

/**
 * Splits matches into qualification and main draw. Returns an empty array when
 * the feed carries no phase information, so callers can fall back to a flat
 * list rather than rendering a single meaningless section.
 */
export function groupByDraw(matches: Match[]): DrawGroup[] {
  const qualification = matches.filter((m) => m.roundPhase === QUALIFICATION_PHASE);
  const mainDraw = matches.filter((m) => m.roundPhase === MAIN_DRAW_PHASE);

  if (qualification.length === 0 && mainDraw.length === 0) return [];

  const groups: DrawGroup[] = [];

  if (qualification.length > 0) {
    groups.push({
      section: "qualification",
      title: "Qualification",
      phases: buildPhases(qualification, "qualification"),
    });
  }

  if (mainDraw.length > 0) {
    groups.push({
      section: "mainDraw",
      title: "Main Draw",
      phases: buildPhases(mainDraw, "mainDraw"),
    });
  }

  return groups;
}

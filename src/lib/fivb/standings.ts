import { Match } from "./types";

/**
 * Pool standings, computed here because nobody publishes them.
 *
 * GetBeachTournamentRanking and GetBeachRoundList both answer NotInNewFormat,
 * and the CEV results site leaves its own standings tab empty, so the table has
 * to be derived from the match results.
 *
 * The rules are the FIVB Beach Volleyball Sport Operations Manual 2025,
 * pp. 31-32, quoted where each one is applied. Two of them are easy to guess
 * wrong: a lost match still scores a point, and sets never enter the ranking --
 * every tie-break is on rally points, the 21-19 kind.
 */

/** Manual, p. 31: "Match won 2 points, Match lost 1 point, Match forfeited 0". */
const POINTS_WON = 2;
const POINTS_LOST = 1;
const POINTS_FORFEIT = 0;

export interface PoolStanding {
  teamNo: string;
  name: string;
  countryCode: string;
  seed?: number;
  played: number;
  won: number;
  lost: number;
  matchPoints: number;
  setsWon: number;
  setsLost: number;
  pointsScored: number;
  pointsConceded: number;
  /** Rally points scored divided by conceded; null before a team has played. */
  pointsRatio: number | null;
  /** 1-based, and shared by teams the rules leave level. */
  rank: number;
}

/**
 * A forfeit, which scores nothing rather than the point a normal defeat earns.
 *
 * The feed has no flag for it -- ResultType comes back 0 on every match -- so
 * the only marker is the score the manual prescribes for one: "(21-0; 21-0)".
 */
function isForfeit(m: Match): boolean {
  if (m.sets.length !== 2) return false;
  return m.sets.every((s) => (s.scoreA === 21 && s.scoreB === 0) || (s.scoreA === 0 && s.scoreB === 21));
}

/** Matches that count: played out, with both teams known. */
function countable(matches: Match[]): Match[] {
  return matches.filter((m) => m.fixtureState === "drawn" && m.status === "finished");
}

interface Totals {
  teamNo: string;
  name: string;
  countryCode: string;
  seed?: number;
  played: number;
  won: number;
  lost: number;
  matchPoints: number;
  setsWon: number;
  setsLost: number;
  pointsScored: number;
  pointsConceded: number;
}

function blank(team: Match["teamA"]): Totals {
  return {
    teamNo: team.teamNo ?? team.name,
    name: team.name,
    countryCode: team.countryCode,
    seed: team.seed,
    played: 0,
    won: 0,
    lost: 0,
    matchPoints: 0,
    setsWon: 0,
    setsLost: 0,
    pointsScored: 0,
    pointsConceded: 0,
  };
}

function accumulate(matches: Match[]): Map<string, Totals> {
  const table = new Map<string, Totals>();

  const side = (team: Match["teamA"]) => {
    const key = team.teamNo ?? team.name;
    const existing = table.get(key);
    if (existing) return existing;
    const fresh = blank(team);
    table.set(key, fresh);
    return fresh;
  };

  for (const m of matches) {
    const a = side(m.teamA);
    const b = side(m.teamB);
    const forfeit = isForfeit(m);

    a.played++;
    b.played++;
    a.setsWon += m.setsWonA;
    a.setsLost += m.setsWonB;
    b.setsWon += m.setsWonB;
    b.setsLost += m.setsWonA;

    for (const set of m.sets) {
      a.pointsScored += set.scoreA;
      a.pointsConceded += set.scoreB;
      b.pointsScored += set.scoreB;
      b.pointsConceded += set.scoreA;
    }

    const aWon = m.setsWonA > m.setsWonB;
    const winner = aWon ? a : b;
    const loser = aWon ? b : a;
    winner.won++;
    loser.lost++;
    winner.matchPoints += POINTS_WON;
    loser.matchPoints += forfeit ? POINTS_FORFEIT : POINTS_LOST;
  }

  return table;
}

/** Rally points ratio over a given set of matches, for one team. */
function ratioWithin(teamNo: string, matches: Match[]): number | null {
  let scored = 0;
  let conceded = 0;
  let played = 0;

  for (const m of matches) {
    const isA = (m.teamA.teamNo ?? m.teamA.name) === teamNo;
    const isB = (m.teamB.teamNo ?? m.teamB.name) === teamNo;
    if (!isA && !isB) continue;
    played++;
    for (const set of m.sets) {
      scored += isA ? set.scoreA : set.scoreB;
      conceded += isA ? set.scoreB : set.scoreA;
    }
  }

  if (played === 0) return null;
  // A pool where nobody conceded a point cannot happen in practice; guarding
  // keeps the comparator total rather than producing NaN.
  return conceded === 0 ? Number.POSITIVE_INFINITY : scored / conceded;
}

/** Matches played strictly among the given teams. */
function matchesAmong(teamNos: Set<string>, matches: Match[]): Match[] {
  return matches.filter(
    (m) =>
      teamNos.has(m.teamA.teamNo ?? m.teamA.name) && teamNos.has(m.teamB.teamNo ?? m.teamB.name)
  );
}

/** Who won when exactly these two met; null if they did not, or drew. */
function headToHead(first: string, second: string, matches: Match[]): string | null {
  const meeting = matchesAmong(new Set([first, second]), matches)[0];
  if (!meeting) return null;
  if (meeting.setsWonA === meeting.setsWonB) return null;
  const winner = meeting.setsWonA > meeting.setsWonB ? meeting.teamA : meeting.teamB;
  return winner.teamNo ?? winner.name;
}

/**
 * Orders teams that finished level on match points.
 *
 * Manual, p. 32, for a tie at the end of the round robin. The size of the tie
 * changes the rule, which is why this is not one comparator: a pair is split on
 * their ratio across the whole pool, a trio first on the ratio among just the
 * three of them.
 */
function breakTie(tied: Totals[], poolMatches: Match[], complete: boolean): Totals[] {
  if (tied.length < 2) return tied;

  const byRatio = (matches: Match[]) => (a: Totals, b: Totals) => {
    const ra = ratioWithin(a.teamNo, matches) ?? 0;
    const rb = ratioWithin(b.teamNo, matches) ?? 0;
    return rb - ra;
  };

  if (tied.length === 2) {
    const ordered = [...tied].sort(byRatio(poolMatches));
    const [first, second] = ordered;
    const ra = ratioWithin(first.teamNo, poolMatches) ?? 0;
    const rb = ratioWithin(second.teamNo, poolMatches) ?? 0;
    if (ra !== rb) return ordered;

    // "If a tie still exists, then the winner of head-to-head match is ranked
    // higher" -- but only once the pool is over; mid-pool the manual leaves
    // them level.
    if (!complete) return ordered;
    const winner = headToHead(first.teamNo, second.teamNo, poolMatches);
    return winner === second.teamNo ? [second, first] : ordered;
  }

  if (tied.length === 3) {
    const amongThree = matchesAmong(new Set(tied.map((t) => t.teamNo)), poolMatches);
    const ordered = [...tied].sort(byRatio(amongThree));

    // Ties that survive the mini-table go to the whole-pool ratio, and after
    // that to the seeding -- "the better seed of the tied teams ranked higher".
    return ordered.sort((a, b) => {
      const inner = (ratioWithin(b.teamNo, amongThree) ?? 0) - (ratioWithin(a.teamNo, amongThree) ?? 0);
      if (inner !== 0) return inner;
      const whole = (ratioWithin(b.teamNo, poolMatches) ?? 0) - (ratioWithin(a.teamNo, poolMatches) ?? 0);
      if (whole !== 0) return whole;
      if (!complete) return 0;
      return (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER);
    });
  }

  // Four or more: "The ranking is determined by the rally points ratio between
  // all teams in the pool."
  return [...tied].sort(byRatio(poolMatches));
}

/**
 * The pool table, best first.
 *
 * `complete` is derived rather than asked for: the tie-break rules differ
 * during a round robin and after it, and only the caller's match list can say
 * which applies.
 */
export function poolStandings(poolMatches: Match[]): PoolStanding[] {
  const real = poolMatches.filter((m) => m.fixtureState === "drawn");
  const finished = countable(poolMatches);
  if (finished.length === 0) return [];

  const complete = real.length > 0 && real.every((m) => m.status === "finished");
  const totals = Array.from(accumulate(finished).values());

  // Match points first, then the size-dependent tie-breaks within each level.
  const levels = new Map<number, Totals[]>();
  for (const t of totals) {
    const bucket = levels.get(t.matchPoints) ?? [];
    bucket.push(t);
    levels.set(t.matchPoints, bucket);
  }

  const ordered: Totals[] = [];
  for (const points of Array.from(levels.keys()).sort((a, b) => b - a)) {
    ordered.push(...breakTie(levels.get(points)!, finished, complete));
  }

  // "If a tie still exists then the teams have the same position in the
  // ranking" (manual, p. 31). It happens for real: two pairs can finish level
  // on match points and on ratio without ever meeting, because the pools of
  // some events are not a full round robin.
  const ratioOf = (t: Totals) =>
    t.pointsConceded === 0 ? Number.POSITIVE_INFINITY : t.pointsScored / t.pointsConceded;

  const ranks: number[] = [];
  ordered.forEach((team, index) => {
    if (index === 0) {
      ranks.push(1);
      return;
    }
    const above = ordered[index - 1];
    const level =
      above.matchPoints === team.matchPoints &&
      ratioOf(above) === ratioOf(team) &&
      headToHead(above.teamNo, team.teamNo, finished) === null;
    ranks.push(level ? ranks[index - 1] : index + 1);
  });

  return ordered.map((t, index) => ({
    ...t,
    pointsRatio: t.pointsConceded === 0 ? null : t.pointsScored / t.pointsConceded,
    rank: ranks[index],
  }));
}

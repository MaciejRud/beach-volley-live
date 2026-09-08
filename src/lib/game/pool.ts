import { promises as fs } from "fs";
import { Continent, CountryHelper } from "../countryHelper";
import { Gender } from "../fivb/types";
import { StatTotals, addTotals, emptyTotals } from "../stats/aggregate";
import { AGGREGATES_FILE, AggregateFile, decodeTotals } from "../stats/aggregateFile";
import { PLAYERS_FILE, PlayerDirectory } from "../stats/archive";
import {
  PERCENTILE_METRICS,
  PLAYER_FORM_FILE,
  PlayerFormFile,
  metricValues,
} from "../stats/playerFiles";
import { CAREER_SCOPE, FieldStats, archivedSeasons, fieldFor } from "../stats/playerProfile";

/**
 * The guessing game's data, assembled once on the server.
 *
 * Everything ships to the browser in one payload rather than a request per
 * round: the game is endless, and a round that waits on the network stops
 * feeling like a game. It also means the answer is in the browser, which no
 * amount of shuffling hides -- the candidate list has to be there for the
 * autocomplete anyway. Real concealment would need a signed round token and a
 * secret, and this app deliberately has none. Someone determined to read the
 * answer out of devtools can; the game is built for people who would rather
 * not.
 *
 * The histograms are the reason this is worth assembling rather than deriving
 * per player: they belong to a gender and a period, not to a player, so 100
 * candidates share twelve of them.
 */

/** Elite16 matches a player needs before they are famous enough to be an answer. */
export const POOL_PER_GENDER = 50;

/** FIVB type code for Elite16 -- the tier that decides whether a name is known. */
const ELITE16_TYPE = "51";

/** One possible answer, and everything a hint might have to say about them. */
export interface GameCandidate {
  no: string;
  name: string;
  fed: string;
  gender: Gender;
  continent: Continent | null;
  /**
   * Metric values per period, in PERCENTILE_METRICS order, keyed by scope.
   * Null where the player never performed that skill in that period.
   */
  values: Record<string, (number | null)[]>;
  /** Measured matches per period, so a period with too few can be labelled. */
  matches: Record<string, number>;
  won: number;
  lost: number;
  /** Distinct partners across the archive. */
  partners: number;
}

/** The field a marker is placed against: one entry per metric, in the same order. */
export interface GameField {
  min: number;
  max: number;
  bins: number[];
}

export interface GameData {
  /** Career first, then seasons newest first. */
  scopes: { key: string; label: string }[];
  candidates: GameCandidate[];
  /** Keyed `${gender}:${scopeKey}`; one entry per metric, or null where unranked. */
  fields: Record<string, (GameField | null)[]>;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as T;
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

/** Drops the values a chart does not need, so the payload carries no spare precision. */
function trim(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function toField(stats: FieldStats | undefined): GameField | null {
  if (!stats) return null;
  return { min: trim(stats.min)!, max: trim(stats.max)!, bins: stats.bins };
}

let cached: Promise<GameData> | undefined;

export function loadGameData(): Promise<GameData> {
  return (cached ??= build());
}

async function build(): Promise<GameData> {
  const [aggregates, form, directory, seasons] = await Promise.all([
    readJson<AggregateFile>(AGGREGATES_FILE),
    readJson<PlayerFormFile>(PLAYER_FORM_FILE),
    readJson<PlayerDirectory>(PLAYERS_FILE),
    archivedSeasons(),
  ]);

  const scopes = [
    { key: CAREER_SCOPE, label: "All seasons" },
    ...seasons.map((season) => ({ key: String(season), label: String(season) })),
  ];

  if (!aggregates || !form) return { scopes, candidates: [], fields: {} };

  // Elite16 volume decides who is famous enough to be guessable. Challenge is
  // in the archive and counts towards every figure shown, but a player known
  // only from Challenge draws is not a name anyone would produce unprompted.
  const ranked = Object.entries(form.players)
    .map(([no, events]) => {
      let elite = 0;
      let won = 0;
      const partners = new Set<string>();
      for (const event of events) {
        won += event.won ?? 0;
        for (const match of event.matches ?? []) {
          if (match.p) partners.add(match.p);
        }
        if (event.type === ELITE16_TYPE) {
          elite += event.totals[form.columns.indexOf("matches")] ?? 0;
        }
      }
      return { no, elite, won, partners: partners.size };
    })
    .filter((p) => aggregates.players[p.no]);

  const candidates: GameCandidate[] = [];
  for (const gender of ["M", "W"] as Gender[]) {
    const chosen = ranked
      .filter((p) => (directory?.[p.no]?.gender ?? aggregates.players[p.no].gender) === gender)
      .sort((a, b) => b.elite - a.elite || a.no.localeCompare(b.no))
      .slice(0, POOL_PER_GENDER);

    for (const player of chosen) {
      const entry = aggregates.players[player.no];
      const known = directory?.[player.no];

      const values: Record<string, (number | null)[]> = {};
      const matches: Record<string, number> = {};

      const career = emptyTotals();
      for (const [season, encoded] of Object.entries(entry.seasons)) {
        const totals: StatTotals = decodeTotals(encoded, aggregates.columns);
        addTotals(career, totals);
        const m = metricValues(totals);
        values[season] = PERCENTILE_METRICS.map((metric) => trim(m[metric]));
        matches[season] = totals.matches;
      }
      const careerMetrics = metricValues(career);
      values[CAREER_SCOPE] = PERCENTILE_METRICS.map((metric) => trim(careerMetrics[metric]));
      matches[CAREER_SCOPE] = career.matches;

      candidates.push({
        no: player.no,
        name: known?.name ?? `#${player.no}`,
        fed: known?.federationCode ?? "",
        gender,
        continent: known?.federationCode
          ? CountryHelper.getContinent(known.federationCode)
          : null,
        values,
        matches,
        won: player.won,
        lost: career.matches - player.won,
        partners: player.partners,
      });
    }
  }

  // One set of histograms per gender and period, shared by every candidate in
  // it -- which is what makes shipping the whole game affordable.
  const fields: Record<string, (GameField | null)[]> = {};
  for (const gender of ["M", "W"] as Gender[]) {
    for (const scope of scopes) {
      const summary = await fieldFor(scope.key, gender);
      fields[`${gender}:${scope.key}`] = PERCENTILE_METRICS.map((metric) =>
        toField(summary.metrics[metric])
      );
    }
  }

  return { scopes, candidates, fields };
}

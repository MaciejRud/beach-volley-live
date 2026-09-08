/**
 * The country the site opens on.
 *
 * Lives here rather than beside the React context so a server route can read it
 * without pulling a "use client" module into the server bundle.
 */
export const DEFAULT_COUNTRY = "POL";

export interface CountryData {
  name: string;
  flag: string;
}

const COUNTRY_MAP: Record<string, CountryData> = {
  POL: { name: "Poland", flag: "🇵🇱" },
  NOR: { name: "Norway", flag: "🇳🇴" },
  SWE: { name: "Sweden", flag: "🇸🇪" },
  BRA: { name: "Brazil", flag: "🇧🇷" },
  USA: { name: "United States", flag: "🇺🇸" },
  GER: { name: "Germany", flag: "🇩🇪" },
  NED: { name: "Netherlands", flag: "🇳🇱" },
  ITA: { name: "Italy", flag: "🇮🇹" },
  ESP: { name: "Spain", flag: "🇪🇸" },
  FRA: { name: "France", flag: "🇫🇷" },
  LAT: { name: "Latvia", flag: "🇱🇻" },
  LTU: { name: "Lithuania", flag: "🇱🇹" },
  EST: { name: "Estonia", flag: "🇪🇪" },
  CZE: { name: "Czech Republic", flag: "🇨🇿" },
  SUI: { name: "Switzerland", flag: "🇨🇭" },
  AUT: { name: "Austria", flag: "🇦🇹" },
  AUS: { name: "Australia", flag: "🇦🇺" },
  CAN: { name: "Canada", flag: "🇨🇦" },
  QAT: { name: "Qatar", flag: "🇶🇦" },
  CHI: { name: "Chile", flag: "🇨🇱" },
  ARG: { name: "Argentina", flag: "🇦🇷" },
  UKR: { name: "Ukraine", flag: "🇺🇦" },
  POR: { name: "Portugal", flag: "🇵🇹" },
  FIN: { name: "Finland", flag: "🇫🇮" },
  JPN: { name: "Japan", flag: "🇯🇵" },
  CHN: { name: "China", flag: "🇨🇳" },
  GBR: { name: "Great Britain", flag: "🇬🇧" },
  ENG: { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  TUR: { name: "Turkey", flag: "🇹🇷" },
  ISR: { name: "Israel", flag: "🇮🇱" },
  NZL: { name: "New Zealand", flag: "🇳🇿" },
  MEX: { name: "Mexico", flag: "🇲🇽" },
  GRE: { name: "Greece", flag: "🇬🇷" },
  BEL: { name: "Belgium", flag: "🇧🇪" },
  DEN: { name: "Denmark", flag: "🇩🇰" },
  SRB: { name: "Serbia", flag: "🇷🇸" },
  SLO: { name: "Slovenia", flag: "🇸🇮" },
  SVK: { name: "Slovakia", flag: "🇸🇰" },
  HUN: { name: "Hungary", flag: "🇭🇺" },
  CRO: { name: "Croatia", flag: "🇭🇷" },
  BUL: { name: "Bulgaria", flag: "🇧🇬" },
  BEN: { name: "Benin", flag: "🇧🇯" },
  NIG: { name: "Niger", flag: "🇳🇪" },
  NGR: { name: "Nigeria", flag: "🇳🇬" },
  GHA: { name: "Ghana", flag: "🇬🇭" },
  CIV: { name: "Côte d'Ivoire", flag: "🇨🇮" },
  TAN: { name: "Tanzania", flag: "🇹🇿" },
  BDI: { name: "Burundi", flag: "🇧🇮" },
  EGY: { name: "Egypt", flag: "🇪🇬" },
  UGA: { name: "Uganda", flag: "🇺🇬" },
  KEN: { name: "Kenya", flag: "🇰🇪" },
  SUD: { name: "Sudan", flag: "🇸🇩" },
  LBR: { name: "Liberia", flag: "🇱🇷" },
  URU: { name: "Uruguay", flag: "🇺🇾" },
  PAR: { name: "Paraguay", flag: "🇵🇾" },
  BOL: { name: "Bolivia", flag: "🇧🇴" },
  COL: { name: "Colombia", flag: "🇨🇴" },
  ECU: { name: "Ecuador", flag: "🇪🇨" },
  VEN: { name: "Venezuela", flag: "🇻🇪" },
  PER: { name: "Peru", flag: "🇵🇪" },
  IRI: { name: "Iran", flag: "🇮🇷" },
  ROU: { name: "Romania", flag: "🇷🇴" },
};

// Alpha-2 to Alpha-3 conversion
const ALPHA2_TO_ALPHA3: Record<string, string> = {
  PL: "POL",
  NO: "NOR",
  SE: "SWE",
  BR: "BRA",
  US: "USA",
  DE: "GER",
  NL: "NED",
  IT: "ITA",
  ES: "ESP",
  FR: "FRA",
  LV: "LAT",
  LT: "LTU",
  EE: "EST",
  CZ: "CZE",
  CH: "SUI",
  AT: "AUT",
  AU: "AUS",
  CA: "CAN",
  QA: "QAT",
  CL: "CHI",
  AR: "ARG",
  UA: "UKR",
  PT: "POR",
  FI: "FIN",
  JP: "JPN",
  CN: "CHN",
  GB: "GBR",
  TR: "TUR",
  IL: "ISR",
  NZ: "NZL",
  MX: "MEX",
  GR: "GRE",
  BE: "BEL",
  DK: "DEN",
};

/**
 * Continents, for grouping federations without naming them.
 *
 * Kept as its own map rather than a field on COUNTRY_MAP so adding it does not
 * rewrite all 42 country lines.
 *
 * Where geography and the sport disagree, the volleyball confederation wins:
 * Turkey and Israel both play under CEV, so both are Europe here. That is the
 * grouping anyone following the tour already has in their head.
 */
export type Continent =
  | "Europe"
  | "South America"
  | "North America"
  | "Asia"
  | "Oceania"
  | "Africa";

const CONTINENT_BY_CODE: Record<string, Continent> = {
  POL: "Europe", NOR: "Europe", SWE: "Europe", GER: "Europe", NED: "Europe",
  ITA: "Europe", ESP: "Europe", FRA: "Europe", LAT: "Europe", LTU: "Europe",
  EST: "Europe", CZE: "Europe", SUI: "Europe", AUT: "Europe", UKR: "Europe",
  POR: "Europe", FIN: "Europe", GBR: "Europe", ENG: "Europe", GRE: "Europe",
  BEL: "Europe", DEN: "Europe", SRB: "Europe", SLO: "Europe", SVK: "Europe",
  HUN: "Europe", CRO: "Europe", BUL: "Europe", ROU: "Europe",
  TUR: "Europe", ISR: "Europe",

  BRA: "South America", ARG: "South America", CHI: "South America",

  USA: "North America", CAN: "North America", MEX: "North America",

  QAT: "Asia", JPN: "Asia", CHN: "Asia",

  AUS: "Oceania", NZL: "Oceania",

  BEN: "Africa", NIG: "Africa", NGR: "Africa", GHA: "Africa", CIV: "Africa",
  TAN: "Africa", BDI: "Africa", EGY: "Africa", UGA: "Africa", KEN: "Africa",
  SUD: "Africa", LBR: "Africa",

  URU: "South America", PAR: "South America", BOL: "South America",
  COL: "South America", ECU: "South America", VEN: "South America",
  PER: "South America",

  IRI: "Asia",
};

export class CountryHelper {
  static getCountryCode(code: string): string {
    const clean = code.toUpperCase().trim();
    if (clean.length === 2 && ALPHA2_TO_ALPHA3[clean]) {
      return ALPHA2_TO_ALPHA3[clean];
    }
    return clean;
  }

  static getCountryName(code: string): string {
    const stdCode = this.getCountryCode(code);
    return COUNTRY_MAP[stdCode]?.name || stdCode;
  }

  /** Null for a federation not on the map, so a caller can leave it unsaid. */
  static getContinent(code: string): Continent | null {
    return CONTINENT_BY_CODE[this.getCountryCode(code)] ?? null;
  }

  static getFlag(code: string): string {
    const stdCode = this.getCountryCode(code);
    if (COUNTRY_MAP[stdCode]?.flag) {
      return COUNTRY_MAP[stdCode].flag;
    }

    if (code.length === 2 && /^[A-Z]{2}$/i.test(code)) {
      const upper = code.toUpperCase();
      const codePoints = [upper.charCodeAt(0) + 127397, upper.charCodeAt(1) + 127397];
      return String.fromCodePoint(...codePoints);
    }

    return "🏐";
  }
}

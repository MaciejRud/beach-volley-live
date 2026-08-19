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

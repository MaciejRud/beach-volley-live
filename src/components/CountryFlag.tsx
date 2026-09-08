interface Props {
  code: string;
  className?: string;
}

/**
 * FIVB federation code to the ISO alpha-2 the flag CDN wants.
 *
 * Two code systems reach this component. Teams carry three-letter federation
 * codes (POL, BRA); tournaments carry ISO alpha-2 already (PL, BR), straight
 * from the feed's CountryCode attribute. Only the three-letter ones need this
 * map, and they get no truncating fallback, because the first two letters are
 * not merely unreliable -- they are confidently wrong. BEN (Benin) truncates
 * to "be" and would fly Belgium's flag, NIG (Niger) to "ni" and Nicaragua's,
 * PAR (Paraguay) to "pa" and Panama's, LBR (Liberia) to "lb" and Lebanon's. A
 * missing flag is a gap; the wrong flag is a lie.
 */
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  POL: "pl", NOR: "no", SWE: "se", BRA: "br", USA: "us", GER: "de",
  NED: "nl", ITA: "it", ESP: "es", FRA: "fr", LAT: "lv", LTU: "lt",
  EST: "ee", CZE: "cz", SUI: "ch", AUT: "at", AUS: "au", CAN: "ca",
  QAT: "qa", CHI: "cl", ARG: "ar", UKR: "ua", POR: "pt", FIN: "fi",
  JPN: "jp", CHN: "cn", GBR: "gb", ENG: "gb", TUR: "tr", ISR: "il",
  NZL: "nz", MEX: "mx", GRE: "gr", BEL: "be", DEN: "dk", SRB: "rs",
  SLO: "si", SVK: "sk", HUN: "hu", CRO: "hr", BUL: "bg", ROU: "ro",

  // Federations the tour visits outside Europe, added when the country picker
  // started listing every federation with matches rather than Poland alone.
  BEN: "bj", NIG: "ne", NGR: "ng", GHA: "gh", CIV: "ci", TAN: "tz",
  BDI: "bi", EGY: "eg", UGA: "ug", KEN: "ke", SUD: "sd", LBR: "lr",
  URU: "uy", PAR: "py", BOL: "bo", COL: "co", ECU: "ec", VEN: "ve",
  PER: "pe", IRI: "ir",
};


export function CountryFlag({ code, className = "" }: Props) {
  const clean = code.toUpperCase().trim();

  // Undrawn bracket slots and byes carry no federation, and an empty code
  // would request flagcdn.com/h20/.png and leave a blank box in the row.
  if (clean.length < 2) return null;

  // A two-letter code is already what the CDN wants; only three-letter
  // federation codes go through the map.
  const alpha2 = clean.length === 2 ? clean.toLowerCase() : ALPHA3_TO_ALPHA2[clean];

  // An unmapped federation gets a neutral tile rather than a guess: it holds
  // the row's alignment, says the code on hover, and never claims a country.
  if (!alpha2) {
    return (
      <span
        title={clean}
        aria-label={clean}
        className={`inline-block rounded-[2px] shrink-0 align-middle bg-slate-200 ring-1 ring-slate-900/20 ${className}`}
        style={{ width: "1.1em", height: "0.8em" }}
      />
    );
  }

  return (
    <img
      src={`https://flagcdn.com/h20/${alpha2}.png`}
      srcSet={`https://flagcdn.com/h40/${alpha2}.png 2x`}
      alt={clean}
      className={`inline-block object-cover rounded-[2px] shrink-0 align-middle ring-1 ring-slate-900/40 ${className}`}
      style={{ width: "1.1em", height: "0.8em" }}
      loading="lazy"
    />
  );
}

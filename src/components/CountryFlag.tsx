interface Props {
  code: string;
  className?: string;
}

const ALPHA3_TO_ALPHA2: Record<string, string> = {
  POL: "pl", NOR: "no", SWE: "se", BRA: "br", USA: "us", GER: "de",
  NED: "nl", ITA: "it", ESP: "es", FRA: "fr", LAT: "lv", LTU: "lt",
  EST: "ee", CZE: "cz", SUI: "ch", AUT: "at", AUS: "au", CAN: "ca",
  QAT: "qa", CHI: "cl", ARG: "ar", UKR: "ua", POR: "pt", FIN: "fi",
  JPN: "jp", CHN: "cn", GBR: "gb", ENG: "gb", TUR: "tr", ISR: "il",
  NZL: "nz", MEX: "mx", GRE: "gr", BEL: "be", DEN: "dk", SRB: "rs",
  SLO: "si", SVK: "sk", HUN: "hu", CRO: "hr", BUL: "bg", ROU: "ro",
};

export function CountryFlag({ code, className = "" }: Props) {
  const clean = code.toUpperCase().trim();

  // Undrawn bracket slots and byes carry no federation, and an empty code
  // would request flagcdn.com/h20/.png and leave a blank box in the row.
  if (clean.length < 2) return null;

  const alpha2 = ALPHA3_TO_ALPHA2[clean] || clean.slice(0, 2).toLowerCase();

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

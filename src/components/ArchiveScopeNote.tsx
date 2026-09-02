/**
 * States what the statistics cover, and -- more importantly -- what they do not.
 *
 * Futures tournaments carry no statistics at all: 302 were scanned and exactly
 * one match was recorded. Without this note, the first visitor who looks up a
 * player competing on the Futures circuit concludes the site is broken.
 */
export function ArchiveScopeNote({ seasons }: { seasons: number[] }) {
  const range =
    seasons.length > 0 ? `${seasons[0]}-${seasons[seasons.length - 1]}` : "the archived seasons";

  return (
    <p className="text-[11px] leading-relaxed text-slate-500 bg-slate-100/70 border border-slate-200 rounded-md px-3 py-2">
      Statistics cover Elite16, Challenge, Pro Tour Finals, World Championships and the
      Olympics, men and women, {range}.{" "}
      <strong className="font-semibold text-slate-600">
        Futures tournaments are not statisticated by FIVB
      </strong>{" "}
      and are absent here, as are matches played without a statistician -- roughly one in
      fourteen, mostly qualification rounds and side courts.
    </p>
  );
}

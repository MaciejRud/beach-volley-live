import type { Metadata } from "next";
import { GameBoard } from "@/components/GameBoard";
import { loadGameData } from "@/lib/game/pool";

/**
 * The guessing game.
 *
 * Everything is assembled here and handed to the browser in one piece, so a
 * round never waits on the network. Nothing on this page changes between
 * deployments, so it is cached for a day like the player pages.
 */

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Guess the player | Beach Volley Live",
  description:
    "Identify a Beach Pro Tour player from six statistics measured against the whole field. Six guesses, one hint per miss.",
};

export default async function PlayPage() {
  const data = await loadGameData();

  if (data.candidates.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-slate-400">
        The statistics archive is empty, so there is nobody to guess.
      </p>
    );
  }

  return <GameBoard data={data} />;
}

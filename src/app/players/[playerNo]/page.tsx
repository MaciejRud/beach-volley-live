import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PlayerProfileView } from "@/components/PlayerProfileView";
import { loadPlayerIndex, loadPlayerProfile } from "@/lib/stats/playerProfile";

/**
 * A player's page, rendered on the server.
 *
 * The per-tournament form file is two and a half megabytes; reading it here
 * keeps it out of the browser entirely. Nothing on this page changes between
 * deployments, so it is cached for a day.
 */

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerNo: string }>;
}): Promise<Metadata> {
  const { playerNo } = await params;
  const profile = await loadPlayerProfile(playerNo);
  if (!profile) return { title: "Player not found | Beach Volley Live" };

  return {
    title: `${profile.name} | Beach Volley Live`,
    description: `Beach volleyball statistics for ${profile.name} (${profile.federationCode}): ${profile.career.matches} measured matches across the FIVB Beach Pro Tour.`,
  };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerNo: string }>;
}) {
  const { playerNo } = await params;

  // Ids come straight from the URL; anything but digits cannot be a player.
  if (!/^\d+$/.test(playerNo)) notFound();

  const [profile, index] = await Promise.all([loadPlayerProfile(playerNo), loadPlayerIndex()]);
  if (!profile) notFound();

  return <PlayerProfileView profile={profile} seasons={index?.seasons ?? []} />;
}

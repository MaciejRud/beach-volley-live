"use client";

import Link from "next/link";
import { Tournament } from "@/lib/fivb/types";
import { CountryHelper } from "@/lib/countryHelper";
import { CountryFlag } from "./CountryFlag";
import { Calendar, MapPin, Trophy, ArrowRight, Users } from "lucide-react";

interface Props {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: Props) {
  const isRunning = tournament.status === "running";
  const isFinished = tournament.status === "finished";

  const tierColors: Record<string, string> = {
    Elite16: "from-amber-400 to-yellow-600 text-amber-950 border-amber-400/50",
    Challenge: "from-cyan-400 to-blue-600 text-blue-950 border-cyan-400/50",
    Futures: "from-orange-400 to-amber-700 text-orange-950 border-orange-400/50",
    Finals: "from-purple-400 to-pink-600 text-purple-950 border-purple-400/50",
    WorldChamps: "from-emerald-400 to-teal-600 text-teal-950 border-emerald-400/50",
    Other: "from-gray-300 to-gray-500 text-gray-950 border-gray-400/50",
  };

  const tierGradient = tierColors[tournament.tier] || tierColors.Other;

  return (
    <div className="glass-card rounded-xl p-5 flex flex-col justify-between group hover:border-amber-400/30">
      <div>
        {/* Tier & Status Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r ${tierGradient} shadow-sm`}>
            {tournament.tier}
          </span>

          <div className="flex items-center gap-1.5 text-xs">
            {isRunning ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live now
              </span>
            ) : isFinished ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-800 text-gray-400 border border-gray-700">
                Finished
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Upcoming
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-base text-white group-hover:text-amber-300 transition-colors line-clamp-2">
          {tournament.title}
        </h3>

        {/* Location & Dates */}
        <div className="mt-3 space-y-1.5 text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <CountryFlag code={tournament.countryCode} className="text-base" />
            <span>
              {tournament.city ? `${tournament.city}, ` : ""}
              {CountryHelper.getCountryName(tournament.countryCode)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>
              {tournament.startDateMain || tournament.startDate}
              {tournament.endDateMain ? ` - ${tournament.endDateMain}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-gray-500" />
            <span>
              Category: <strong>{tournament.gender === "M" ? "Men" : tournament.gender === "W" ? "Women" : "M & W"}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[11px] text-gray-500 font-mono">ID: {tournament.no}</span>
        <Link
          href={`/tournaments/${tournament.no}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 group-hover:translate-x-0.5 transition-transform"
        >
          <span>View matches</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
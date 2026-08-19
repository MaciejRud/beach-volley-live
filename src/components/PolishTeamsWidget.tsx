"use client";

import { useState } from "react";
import { Match, PolishTeamsSummary } from "@/lib/fivb/types";
import { LiveMatchCard } from "./LiveMatchCard";
import { Flag, Activity, Calendar, History, Sparkles } from "lucide-react";

interface Props {
  summary: PolishTeamsSummary;
}

export function PolishTeamsWidget({ summary }: Props) {
  const [activeTab, setActiveTab] = useState<"all" | "active" | "upcoming" | "recent">("all");

  const totalMatches =
    summary.activeMatches.length + summary.upcomingMatches.length + summary.recentMatches.length;

  let displayedMatches: Match[] = [];
  if (activeTab === "all") {
    displayedMatches = [...summary.activeMatches, ...summary.upcomingMatches, ...summary.recentMatches];
  } else if (activeTab === "active") {
    displayedMatches = summary.activeMatches;
  } else if (activeTab === "upcoming") {
    displayedMatches = summary.upcomingMatches;
  } else if (activeTab === "recent") {
    displayedMatches = summary.recentMatches;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-red-950/40 via-red-900/20 to-transparent p-5 sm:p-6 rounded-2xl border border-red-500/20">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-2xl shadow-lg shadow-red-600/30">
            🇵🇱
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Poland Zone
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white shadow-sm">
                White & Red
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 mt-0.5">
              Matches, live results and schedule of Polish duos at FIVB & Beach Pro Tour events
            </p>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {summary.activeMatches.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold animate-pulse">
              <Activity className="w-3.5 h-3.5" />
              <span>{summary.activeMatches.length} LIVE</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-medium">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>{summary.upcomingMatches.length} scheduled</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "all"
              ? "bg-white/15 text-white border border-white/20 shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          All matches ({totalMatches})
        </button>

        <button
          onClick={() => setActiveTab("active")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "active"
              ? "bg-red-600/30 text-red-300 border border-red-500/40 shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-red-400" />
          <span>Live ({summary.activeMatches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("upcoming")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "upcoming"
              ? "bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-blue-400" />
          <span>Upcoming ({summary.upcomingMatches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("recent")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "recent"
              ? "bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-sm"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <History className="w-3.5 h-3.5 text-amber-400" />
          <span>Recent results ({summary.recentMatches.length})</span>
        </button>
      </div>

      {/* Matches Grid */}
      {displayedMatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedMatches.map((match) => (
            <LiveMatchCard key={match.id} match={match} highlightPolish={true} />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-8 sm:p-12 text-center">
          <span className="text-4xl mb-3 block">🏐</span>
          <h3 className="text-base font-semibold text-white">No matches in this category</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto mt-1">
            No scheduled matches for the selected filter at this time. Follow Beach Pro Tour events as they happen.
          </p>
        </div>
      )}
    </div>
  );
}
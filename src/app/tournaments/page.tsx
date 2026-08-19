"use client";

import { useEffect, useState, useMemo } from "react";
import { Tournament } from "@/lib/fivb/types";
import { TournamentCard } from "@/components/TournamentCard";
import { Trophy, Search } from "lucide-react";

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/tournaments");
        const json = await res.json();
        setTournaments(json.tournaments || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesCity = t.city.toLowerCase().includes(q);
        const matchesCode = t.code.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCity && !matchesCode) return false;
      }

      if (selectedTier !== "all" && t.tier !== selectedTier) return false;
      if (selectedGender !== "all" && t.gender !== selectedGender) return false;
      if (selectedStatus !== "all" && t.status !== selectedStatus) return false;

      return true;
    });
  }, [tournaments, search, selectedTier, selectedGender, selectedStatus]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-yellow-900/20 to-transparent p-5 sm:p-6 rounded-2xl border border-amber-500/20">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center text-amber-950 shadow-lg shadow-amber-500/20">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              FIVB Calendar & Tournaments
            </h1>
            <p className="text-xs sm:text-sm text-gray-300 mt-0.5">
              Browse Beach Pro Tour: Elite16, Challenge, Futures and championships
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          Found: <strong className="text-white font-mono">{filtered.length}</strong> of {tournaments.length}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 rounded-xl space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by tournament name, city or code (e.g. Ostrava, Gstaad, Futures)..."
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            aria-label="Filter by status"
            className="bg-black/40 border border-white/10 text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
          >
            <option value="all">All statuses</option>
            <option value="running">Live now</option>
            <option value="upcoming">Upcoming</option>
            <option value="finished">Finished</option>
          </select>

          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            aria-label="Filter by tier"
            className="bg-black/40 border border-white/10 text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
          >
            <option value="all">All tiers</option>
            <option value="Elite16">Elite 16</option>
            <option value="Challenge">Challenge</option>
            <option value="Futures">Futures</option>
            <option value="WorldChamps">World Championships</option>
          </select>

          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            aria-label="Filter by gender"
            className="bg-black/40 border border-white/10 text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-400"
          >
            <option value="all">Women & Men</option>
            <option value="M">Men (M)</option>
            <option value="W">Women (W)</option>
          </select>

          {(search || selectedTier !== "all" || selectedGender !== "all" || selectedStatus !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedTier("all");
                setSelectedGender("all");
                setSelectedStatus("all");
              }}
              className="text-xs text-amber-400 hover:underline ml-auto cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Grid of tournaments */}
      {isLoading ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-gray-300">Fetching tournaments from FIVB database...</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-12 text-center text-gray-400">
          <p className="text-base font-semibold text-white">No tournaments found</p>
          <p className="text-xs mt-1">Try adjusting your search parameters or filters.</p>
        </div>
      )}
    </div>
  );
}

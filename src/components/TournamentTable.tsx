"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Tournament, TournamentCircuit } from "@/lib/fivb/types";
import { CountryHelper } from "@/lib/countryHelper";
import { CountryFlag } from "./CountryFlag";
import { Search, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  tournaments: Tournament[];
  isLoading?: boolean;
}

interface PairedTournament {
  title: string;
  countryCode: string;
  city: string;
  startDateMain?: string;
  endDateMain?: string;
  startDate?: string;
  endDate?: string;
  male?: Tournament;
  female?: Tournament;
  isRunning: boolean;
}

export function TournamentTable({ tournaments, isLoading = false }: Props) {
  const [activeCircuit, setActiveCircuit] = useState<TournamentCircuit>("BPT");
  const [search, setSearch] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");

  // Collapsible section state for BPT sub-tiers
  // Live section open by default; calendar sections collapsed
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    running: true,
    Elite16: false,
    Challenge: false,
    Futures: false,
    WorldChamps: false,
    CEV: false,
    National: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Filter tournaments by active circuit, search, gender
  const circuitTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      if (t.circuit !== activeCircuit) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const inTitle = t.title.toLowerCase().includes(q);
        const inCity = t.city.toLowerCase().includes(q);
        const inCode = t.code.toLowerCase().includes(q);
        const inCountry = CountryHelper.getCountryName(t.countryCode).toLowerCase().includes(q);
        if (!inTitle && !inCity && !inCode && !inCountry) return false;
      }

      if (selectedGender !== "all" && t.gender !== selectedGender) return false;

      if (selectedCountry !== "all" && t.countryCode !== selectedCountry) return false;

      return true;
    });
  }, [tournaments, activeCircuit, search, selectedGender, selectedCountry]);

  // Circuit counts for top badges
  const bptCount = tournaments.filter((t) => t.circuit === "BPT").length;
  const cevCount = tournaments.filter((t) => t.circuit === "CEV").length;
  const nationalCount = tournaments.filter((t) => t.circuit === "National").length;

  // Extract unique countries for National Tours filter
  const nationalCountries = useMemo(() => {
    if (activeCircuit !== "National") return [];
    const set = new Set<string>();
    for (const t of tournaments.filter((x) => x.circuit === "National")) {
      if (t.countryCode) set.add(t.countryCode);
    }
    return Array.from(set).sort();
  }, [tournaments, activeCircuit]);

  // Pair M+W tournaments for BPT
  const pairedBPT = useMemo<PairedTournament[]>(() => {
    if (activeCircuit !== "BPT") return [];

    const byTitle = new Map<string, Tournament[]>();
    for (const t of circuitTournaments) {
      const key = t.title;
      if (!byTitle.has(key)) byTitle.set(key, []);
      byTitle.get(key)!.push(t);
    }

    const pairs: PairedTournament[] = [];
    for (const [title, group] of byTitle) {
      const male = group.find((t) => t.gender === "M");
      const female = group.find((t) => t.gender === "W");
      const ref = male || female || group[0];
      const isRunning = group.some((t) => t.status === "running");

      // Filter by gender: if user selected M, pair must have male; if W, must have female
      if (selectedGender === "M" && !male) continue;
      if (selectedGender === "W" && !female) continue;

      pairs.push({
        title,
        countryCode: ref.countryCode,
        city: ref.city,
        startDateMain: ref.startDateMain,
        endDateMain: ref.endDateMain,
        startDate: ref.startDate,
        endDate: ref.endDate,
        male,
        female,
        isRunning,
      });
    }

    return pairs.sort((a, b) => {
      const dateA = a.startDateMain || a.startDate || "";
      const dateB = b.startDateMain || b.startDate || "";
      return dateA.localeCompare(dateB);
    });
  }, [circuitTournaments, activeCircuit, selectedGender]);

  // BPT paired groups by tier
  const pairedElite = pairedBPT.filter((p) =>
    (p.male?.tier === "Elite16" || p.female?.tier === "Elite16") && !p.isRunning
  );
  const pairedChallenge = pairedBPT.filter((p) =>
    (p.male?.tier === "Challenge" || p.female?.tier === "Challenge") && !p.isRunning
  );
  const pairedFutures = pairedBPT.filter((p) =>
    (p.male?.tier === "Futures" || p.female?.tier === "Futures") && !p.isRunning
  );
  const pairedWorldChamps = pairedBPT.filter((p) =>
    (p.male?.tier === "WorldChamps" || p.female?.tier === "WorldChamps") && !p.isRunning
  );
  const pairedRunning = pairedBPT.filter((p) => p.isRunning);

  // CEV and National tournaments (non-running, non-paired)
  const cevList = useMemo(
    () => circuitTournaments.filter((t) => t.status !== "running"),
    [circuitTournaments]
  );
  const nationalList = useMemo(
    () => circuitTournaments.filter((t) => t.status !== "running"),
    [circuitTournaments]
  );
  const currentlyRunning = useMemo(
    () => circuitTournaments.filter((t) => t.status === "running"),
    [circuitTournaments]
  );

  const formatDate = (start?: string, end?: string) => {
    if (!start) return "-";
    const parse = (d: string) => {
      const parts = d.split("-");
      return parts.length === 3 ? `${parts[2]}.${parts[1]}` : d;
    };
    if (!end || end === start) return parse(start);
    return `${parse(start)} - ${parse(end)}`;
  };

  const renderPairedRows = (list: PairedTournament[]) => {
    if (list.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">
            No tournaments in this section for the selected filters.
          </td>
        </tr>
      );
    }

    return list.map((p) => {
      const renderGenderCell = (t?: Tournament) => {
        if (!t) {
          return (
            <span className="text-slate-300 text-[11px]">—</span>
          );
        }
        const isLive = t.status === "running";
        const isFinished = t.status === "finished";
        return (
          <Link
            href={`/tournaments/${t.no}`}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
              isLive
                ? "bg-red-100 text-red-700 border border-red-200 hover:bg-red-200"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800"
            }`}
          >
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>}
            {isLive ? "LIVE" : isFinished ? "Results" : "Matches"}
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </Link>
        );
      };

      return (
        <tr
          key={p.title}
          className={`hover:bg-slate-50 transition-colors ${
            p.isRunning ? "bg-red-50/60 border-l-3 border-l-red-500" : ""
          }`}
        >
          {/* Date */}
          <td className="py-1.5 px-3 whitespace-nowrap font-mono text-slate-600 text-[11px]">
            {formatDate(p.startDateMain || p.startDate, p.endDateMain || p.endDate)}
          </td>

          {/* Tournament & Country */}
          <td className="py-1.5 px-3">
            <div className="flex items-center gap-1.5">
              <CountryFlag code={p.countryCode} className="text-base" />
              <div className="min-w-0 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-900 truncate">
                  {p.title}
                </span>
                <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                  ({p.city ? `${p.city}, ` : ""}{CountryHelper.getCountryName(p.countryCode)})
                </span>
              </div>
            </div>
          </td>

          {/* Men's tournament */}
          <td className="py-1.5 px-3 text-center whitespace-nowrap">
            {renderGenderCell(p.male)}
          </td>

          {/* Women's tournament */}
          <td className="py-1.5 px-3 text-center whitespace-nowrap">
            {renderGenderCell(p.female)}
          </td>
        </tr>
      );
    });
  };

  const renderPairedCards = (list: PairedTournament[]) => {
    if (list.length === 0) {
      return (
        <div className="py-4 text-center text-slate-400 text-xs">
          No tournaments in this section for the selected filters.
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100">
        {list.map((p) => {
          const renderGenderLink = (t?: Tournament, label: string = "") => {
            if (!t) {
              return (
                <div className="flex items-center justify-between py-1.5 px-2">
                  <span className="text-slate-400 text-xs">{label}</span>
                  <span className="text-slate-300 text-[11px]">—</span>
                </div>
              );
            }
            const isLive = t.status === "running";
            const isFinished = t.status === "finished";
            return (
              <Link
                href={`/tournaments/${t.no}`}
                className={`flex items-center justify-between py-1.5 px-2 rounded transition-colors ${
                  isLive ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"
                }`}
              >
                <span className={`text-xs font-semibold ${isLive ? "text-red-700" : "text-slate-700"}`}>
                  {label}
                  {isLive && (
                    <span className="inline-flex items-center gap-1 ml-1.5 text-[10px] font-extrabold text-red-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                      LIVE
                    </span>
                  )}
                </span>
                <span className={`text-[11px] font-bold ${isLive ? "text-red-700" : "text-slate-800"}`}>
                  {isLive ? "Live" : isFinished ? "Results" : "Matches"}
                  <ArrowRight className="w-3 h-3 inline ml-0.5 text-slate-400" />
                </span>
              </Link>
            );
          };

          return (
            <div
              key={p.title}
              className={`px-3 py-2.5 ${
                p.isRunning ? "bg-red-50/40 border-l-3 border-l-red-500" : ""
              }`}
            >
              {/* Date + flag + title */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <CountryFlag code={p.countryCode} className="text-base" />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 text-xs truncate">{p.title}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {formatDate(p.startDateMain || p.startDate, p.endDateMain || p.endDate)}
                    {p.city && <span className="text-slate-400"> • {p.city}</span>}
                  </div>
                </div>
              </div>
              {/* Men's + Women's links */}
              <div className="space-y-0.5">
                {renderGenderLink(p.male, "👨 Men")}
                {renderGenderLink(p.female, "👩 Women")}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPairedSection = (
    title: string,
    badgeText: string,
    badgeClass: string,
    list: PairedTournament[],
    sectionKey: string
  ) => {
    const isOpen = openSections[sectionKey] ?? true;

    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full bg-slate-50 hover:bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex items-center justify-between transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${badgeClass}`}>
              {badgeText}
            </span>
            <h2 className="font-bold text-xs sm:text-sm text-slate-800">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono font-medium">
              {list.length} events
            </span>
            {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {isOpen && (
          <>
            {/* Mobile: card layout */}
            <div className="sm:hidden">
              {renderPairedCards(list)}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-1.5 px-3 whitespace-nowrap">Date</th>
                    <th className="py-1.5 px-3">Host / Event</th>
                    <th className="py-1.5 px-3 text-center whitespace-nowrap">👨 Men</th>
                    <th className="py-1.5 px-3 text-center whitespace-nowrap">👩 Women</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {renderPairedRows(list)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderTableRows = (list: Tournament[]) => {
    const sorted = [...list].sort((a, b) => {
      const dateA = a.startDateMain || a.startDate || "";
      const dateB = b.startDateMain || b.startDate || "";
      return dateA.localeCompare(dateB);
    });

    if (sorted.length === 0) {
      return (
        <tr>
          <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">
            No tournaments in this section for the selected filters.
          </td>
        </tr>
      );
    }

    return sorted.map((t) => {
      const isLive = t.status === "running";
      const isFinished = t.status === "finished";

      return (
        <tr
          key={t.id}
          className={`hover:bg-slate-50 transition-colors ${
            isLive ? "bg-red-50/60 border-l-3 border-l-red-500" : ""
          }`}
        >
          <td className="py-1.5 px-3 whitespace-nowrap font-mono text-slate-600 text-[11px]">
            {formatDate(t.startDateMain || t.startDate, t.endDateMain || t.endDate)}
          </td>

          <td className="py-1.5 px-2 text-center whitespace-nowrap">
            <span
              className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                t.gender === "M"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : t.gender === "W"
                  ? "bg-pink-50 text-pink-700 border border-pink-200"
                  : "bg-purple-50 text-purple-700 border border-purple-200"
              }`}
            >
              {t.gender === "M" ? "M" : t.gender === "W" ? "W" : "M+W"}
            </span>
          </td>

          <td className="py-1.5 px-3">
            <div className="flex items-center gap-1.5">
              <CountryFlag code={t.countryCode} className="text-base" />
              <div className="min-w-0 flex items-baseline gap-1.5">
                <Link
                  href={`/tournaments/${t.no}`}
                  className="font-bold text-slate-900 hover:text-amber-600 transition-colors truncate"
                >
                  {t.title}
                </Link>
                <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                  ({t.city ? `${t.city}, ` : ""}{CountryHelper.getCountryName(t.countryCode)})
                </span>
              </div>
            </div>
          </td>

          <td className="py-1.5 px-3 whitespace-nowrap">
            {isLive ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                LIVE NOW
              </span>
            ) : isFinished ? (
              <span className="text-[11px] text-slate-400">Finished</span>
            ) : (
              <span className="text-[11px] text-slate-500">Scheduled</span>
            )}
          </td>

          <td className="py-1.5 px-3 text-right whitespace-nowrap">
            <Link
              href={`/tournaments/${t.no}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold transition-colors"
            >
              <span>Matches</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </td>
        </tr>
      );
    });
  };

  const renderTournamentCards = (list: Tournament[]) => {
    const sorted = [...list].sort((a, b) => {
      const dateA = a.startDateMain || a.startDate || "";
      const dateB = b.startDateMain || b.startDate || "";
      return dateA.localeCompare(dateB);
    });

    if (sorted.length === 0) {
      return (
        <div className="py-4 text-center text-slate-400 text-xs">
          No tournaments in this section for the selected filters.
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100">
        {sorted.map((t) => {
          const isLive = t.status === "running";
          const isFinished = t.status === "finished";
          return (
            <Link
              key={t.id}
              href={`/tournaments/${t.no}`}
              className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${
                isLive
                  ? "bg-red-50/40 border-l-3 border-l-red-500 hover:bg-red-50"
                  : "hover:bg-slate-50"
              }`}
            >
              <CountryFlag code={t.countryCode} className="text-base" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 text-xs truncate">{t.title}</span>
                  <span
                    className={`inline-block px-1 py-0 rounded text-[9px] font-bold shrink-0 ${
                      t.gender === "M"
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : t.gender === "W"
                        ? "bg-pink-50 text-pink-700 border border-pink-200"
                        : "bg-purple-50 text-purple-700 border border-purple-200"
                    }`}
                  >
                    {t.gender === "M" ? "M" : t.gender === "W" ? "W" : "M+W"}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {formatDate(t.startDateMain || t.startDate, t.endDateMain || t.endDate)}
                  {t.city && <span className="text-slate-400"> • {t.city}</span>}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {isLive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                    LIVE
                  </span>
                ) : isFinished ? (
                  <span className="text-[10px] text-slate-400">Done</span>
                ) : (
                  <span className="text-[10px] text-slate-500">Scheduled</span>
                )}
                <ArrowRight className="w-3 h-3 text-slate-400 block ml-auto mt-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    );
  };

  const renderSection = (
    title: string,
    badgeText: string,
    badgeClass: string,
    list: Tournament[],
    sectionKey: string
  ) => {
    const isOpen = openSections[sectionKey] ?? true;

    return (
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="w-full bg-slate-50 hover:bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex items-center justify-between transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${badgeClass}`}>
              {badgeText}
            </span>
            <h2 className="font-bold text-xs sm:text-sm text-slate-800">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-mono font-medium">
              {list.length} tournaments
            </span>
            {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </button>

        {isOpen && (
          <>
            {/* Mobile: card layout */}
            <div className="sm:hidden">
              {renderTournamentCards(list)}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-1.5 px-3 whitespace-nowrap">Date</th>
                    <th className="py-1.5 px-2 text-center whitespace-nowrap">Gender</th>
                    <th className="py-1.5 px-3">Host / Tournament</th>
                    <th className="py-1.5 px-3 whitespace-nowrap">Status</th>
                    <th className="py-1.5 px-3 text-right whitespace-nowrap">Results</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {renderTableRows(list)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 3 Main Top-Level Tabs (BPT, CEV, National Tours) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveCircuit("BPT")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCircuit === "BPT"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>🏆 Beach Pro Tour</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500 text-black font-extrabold">
              {bptCount}
            </span>
          </button>

          <button
            onClick={() => setActiveCircuit("CEV")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCircuit === "CEV"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>🇪🇺 CEV (European)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-extrabold">
              {cevCount}
            </span>
          </button>

          <button
            onClick={() => setActiveCircuit("National")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeCircuit === "National"
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>🏐 National Tours</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-extrabold">
              {nationalCount}
            </span>
          </button>
        </div>

        {/* Gender & Country Filters */}
        <div className="flex items-center gap-1.5 text-xs">
          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 rounded px-2 py-1 text-[11px] focus:outline-none shadow-xs"
          >
            <option value="all">Gender: All</option>
            <option value="M">Men (M)</option>
            <option value="W">Women (W)</option>
          </select>

          {activeCircuit === "National" && nationalCountries.length > 0 && (
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 rounded px-2 py-1 text-[11px] focus:outline-none shadow-xs"
            >
              <option value="all">Country: All</option>
              {nationalCountries.map((c) => (
                <option key={c} value={c}>
                  {c} {CountryHelper.getCountryName(c)}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search in ${
            activeCircuit === "BPT" ? "Beach Pro Tour" : activeCircuit === "CEV" ? "CEV" : "National Tours"
          } (city, name, country)...`}
          className="w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
        />
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="bg-white p-10 text-center rounded-lg border border-slate-200">
          <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-xs text-slate-500">Loading tournament calendar...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* BPT: Paired M+W layout */}
          {activeCircuit === "BPT" && (
            <div className="space-y-4">
              {/* 1. RUNNING TOURNAMENTS ALWAYS ON TOP */}
              {pairedRunning.length > 0 &&
                renderPairedSection(
                  "Live now (LIVE)",
                  "🔴 LIVE",
                  "bg-red-100 text-red-700 border-red-300 animate-pulse",
                  pairedRunning,
                  "running"
                )}

              {/* Elite 16 */}
              {renderPairedSection(
                "Beach Pro Tour: Elite 16",
                "Elite 16",
                "bg-amber-100 text-amber-800 border-amber-300 font-extrabold",
                pairedElite,
                "Elite16"
              )}

              {/* Challenge */}
              {renderPairedSection(
                "Beach Pro Tour: Challenge",
                "Challenge",
                "bg-sky-100 text-sky-800 border-sky-300 font-extrabold",
                pairedChallenge,
                "Challenge"
              )}

              {/* Futures */}
              {renderPairedSection(
                "Beach Pro Tour: Futures",
                "Futures",
                "bg-orange-100 text-orange-800 border-orange-300 font-extrabold",
                pairedFutures,
                "Futures"
              )}

              {/* World Championships & Olympic Games */}
              {pairedWorldChamps.length > 0 &&
                renderPairedSection(
                  "World Championships & Olympic Games",
                  "WCHs / Olympic",
                  "bg-purple-100 text-purple-800 border-purple-300 font-extrabold",
                  pairedWorldChamps,
                  "WorldChamps"
                )}
            </div>
          )}

          {/* CEV Section */}
          {activeCircuit === "CEV" && (
            <div className="space-y-4">
              {currentlyRunning.length > 0 &&
                renderSection(
                  "Live now (LIVE)",
                  "🔴 LIVE",
                  "bg-red-100 text-red-700 border-red-300 animate-pulse",
                  currentlyRunning,
                  "running"
                )}
              {renderSection(
                "European CEV & Nations Cup Tournaments",
                "CEV",
                "bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold",
                cevList,
                "CEV"
              )}
            </div>
          )}

          {/* National Tours Section */}
          {activeCircuit === "National" && (
            <div className="space-y-4">
              {currentlyRunning.length > 0 &&
                renderSection(
                  "Live now (LIVE)",
                  "🔴 LIVE",
                  "bg-red-100 text-red-700 border-red-300 animate-pulse",
                  currentlyRunning,
                  "running"
                )}
              {renderSection(
                "National Tours & Championships Calendar",
                "National",
                "bg-slate-100 text-slate-700 border-slate-300 font-extrabold",
                nationalList,
                "National"
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

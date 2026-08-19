"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  intervalSeconds?: number;
  onRefresh: () => void | Promise<void>;
  isLoading?: boolean;
}

export function AutoRefreshIndicator({ intervalSeconds = 25, onRefresh, isLoading = false }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(intervalSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onRefresh();
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [intervalSeconds, onRefresh]);

  const handleManual = () => {
    setSecondsLeft(intervalSeconds);
    onRefresh();
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
      <button
        onClick={handleManual}
        disabled={isLoading}
        className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        title="Refresh now"
      >
        <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isLoading ? "animate-spin" : ""}`} />
        <span>Refresh in <strong className="text-white font-mono">{secondsLeft}s</strong></span>
      </button>
    </div>
  );
}
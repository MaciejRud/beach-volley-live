import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline | Beach Volley Live",
};

export default function OfflinePage() {
  return (
    <div className="bg-white px-4 py-10 rounded-lg border border-slate-200 shadow-xs text-center space-y-2">
      <h1 className="text-lg font-black text-slate-900">You are offline</h1>
      <p className="text-xs text-slate-500">
        Live scores need a connection. Reconnect and the page will load again.
      </p>
    </div>
  );
}

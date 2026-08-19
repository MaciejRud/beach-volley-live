import type { Metadata, Viewport } from "next";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beach Volley Live | FIVB Calendar & Results",
  description: "Tournament calendar and live beach volleyball results from FIVB Beach Pro Tour in 12ndr style. Follow matches of Polish duos.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#f8fafc] text-slate-900 min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-2 sm:px-4 lg:px-6 py-4">
          {children}
        </main>
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500 mt-8">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© {new Date().getFullYear()} Beach Volley Live • Official data from FIVB VIS Web Service</p>
            <p className="text-slate-400">Tournament calendar & results in 12ndr style 🏐</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
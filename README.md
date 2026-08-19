# 🏐 Beach Volley Live & Polska Strefa

Nowoczesna, w 100% samodzielna aplikacja webowa w **Node.js (Next.js 15, TypeScript)** do śledzenia wyników na żywo, terminarza i drabinek turniejów siatkówki plażowej z oficjalnego **FIVB VIS Web Service**.

## ✨ Główne funkcje

- **🇵🇱 Dedykowana Polska Strefa**: Błyskawiczny podgląd wszystkich meczów polskich duetów (Łosiak/Bryl, Kantor/Zdybek, Gruszczyńska/Wachowicz itd.) na turniejach międzynarodowych (Live, Nadchodzące, Ostatnie).
- **🔴 Live Match Center**: Automatycznie odświeżany podgląd trwających meczów z punktacją setów i numerami boisk.
- **🏆 Przeglądarka Turniejów & Drabinek**: Filtrowanie po randze (Elite16, Challenge, Futures, Finals, Mistrzostwa Świata), płci (M/W) i statusie.
- **⚡ Wysoka wydajność**: Wbudowane API Routes z inteligentnym in-memory cache (TTL: 25s live, 60s Polska strefa, 1h turnieje) – zerowe ryzyko przekroczenia limitów FIVB.
- **📱 PWA & Dark Mode**: Dopracowany interfejs w stylu dark glassmorphism, w pełni responsywny na telefonach i tabletach.

## 🚀 Uruchomienie lokalne

```bash
# Instalacja zależności
npm install

# Test połączenia z API FIVB
npm run test:fivb

# Uruchomienie deweloperskie
npm run dev
```

Aplikacja wystartuje pod adresem `http://localhost:3000`.

## 🌐 Bezpłatne wdrożenie (np. Vercel)

Aplikacja jest zoptymalizowana pod bezpłatny hosting Vercel Hobby:
1. Zaloguj się na [vercel.com](https://vercel.com).
2. Połącz swoje repozytorium GitHub z projektem `beach-volley-live`.
3. Kliknij **Deploy** – Vercel automatycznie wykryje Next.js i wystawi stronę w sieci z darmowym certyfikatem SSL.
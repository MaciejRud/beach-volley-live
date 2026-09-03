# Beach Volley Live - Project Configuration

**Version**: 1.0.0
**Purpose**: Next.js web app showing live scores, schedule and brackets from the FIVB VIS API
**Philosophy**: AI as a tool under human control - proposes, human decides

---

# PART 1: CORE RULES (NEVER CHANGE)

## RULE #1: Plan → Approval → Implementation

**NEVER start coding without explicit user approval of the implementation plan.**

1. **Understand**: Ask clarifying questions if needed
2. **Analyze**: Read relevant files, understand existing structure
3. **Plan**: Create detailed step-by-step plan with file references
4. **Present**: Show what will be changed and why
5. **WAIT**: Do not proceed until user explicitly approves ("tak", "yes", "ok")
6. **Implement**: Only after approval, start coding
7. **Verify**: Run `npm run build`, check output
8. **Report**: Show what was done with `file:line` references

## RULE #2: Always Read Before Edit

**NEVER edit a file without reading it first.**

## RULE #3: Git Commit Standards

**NEVER include references to AI tools in commit messages.**

Conventional commits: `feat:` `fix:` `refactor:` `docs:` `style:` `test:` `chore:`

## RULE #4: Documentation Transparency

**ALWAYS explicitly state which documentation you used (or why none was needed).**

## RULE #5: Task Management

**Use todo tracking for ALL multi-step tasks.**

## RULE #6: Language Standards

- **User Communication**: POLISH
- **Code, comments, commits**: ENGLISH ONLY

## RULE #7: Security Mindset

- All FIVB API data is untrusted - never render it with `dangerouslySetInnerHTML`
- Validate and coerce every query param in route handlers (`Number()`, allowlists)
- Never proxy arbitrary user input into the FIVB XML request body
- No secrets in code or commits (this app currently needs none - FIVB VIS is open)
- API routes are public and unauthenticated - keep them read-only

## RULE #8: Code Quality Principles

- Clarity over cleverness
- Minimal changes - only what the task needs
- No gold-plating
- Follow existing patterns in the codebase
- Handle failures gracefully - no silent `catch {}` swallowing

---

# PART 2: PROJECT CONFIGURATION

## Technology Stack

```
Framework:   Next.js 16 (App Router, React 19, Server Components)
Language:    TypeScript 5.7 (strict)
Styling:     Tailwind CSS 4 (@tailwindcss/postcss)
XML parsing: fast-xml-parser
Icons:       lucide-react
Data source: FIVB VIS XML Web Service (https://www.fivb.org/vis2009/XmlRequest.asmx)
Hosting:     Vercel (Hobby tier)
Path alias:  @/* -> ./src/*
```

## Project Structure

```
beach-volley-live/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout, metadata, Navbar/footer
│   │   ├── globals.css                 # Tailwind entry + global styles
│   │   ├── page.tsx                    # Home
│   │   ├── live/page.tsx               # Live match center
│   │   ├── polish-teams/page.tsx       # Polish zone
│   │   ├── tournaments/page.tsx        # Tournament browser
│   │   ├── tournaments/[id]/page.tsx   # Single tournament
│   │   └── api/
│   │       ├── live/route.ts
│   │       ├── polish-teams/route.ts
│   │       ├── tournaments/route.ts
│   │       └── tournaments/[id]/route.ts
│   ├── components/                     # Presentational React components
│   └── lib/
│       ├── cache.ts                    # In-memory TTL cache (globalCache)
│       ├── countryHelper.ts            # Country codes, flags, names
│       ├── fivb/
│       │   ├── client.ts               # FivbClient - all API calls + caching
│       │   ├── requestBuilder.ts       # Builds VIS XML requests
│       │   ├── responseParser.ts       # Parses VIS XML responses
│       │   ├── statistics.ts           # Metric formulas, isMeasured()
│       │   ├── types.ts                # Tournament, Match, LiveCenterData, ...
│       │   ├── test-client.ts          # Manual API smoke test (npm run test:fivb)
│       │   └── test-stats.ts           # Statistics smoke test (npm run test:stats)
│       └── stats/
│           ├── archive.ts              # data/stats/ file format + readers
│           ├── aggregate.ts            # Per-player season/career totals
│           ├── aggregateFile.ts        # data/aggregates.json format
│           └── seasonAverages.ts       # Runtime lookup of season averages
├── scripts/
│   ├── backfill-stats.ts               # Downloads the archive (npm run stats:backfill)
│   └── build-aggregates.ts             # Reduces it (npm run stats:aggregate)
├── data/                               # Committed statistics archive, ~4 MB
│   ├── stats/{tournamentNo}.json       # One file per tournament, frozen once written
│   ├── players.json                    # Player number -> name, federation, gender
│   └── aggregates.json                 # Per-player season totals, read at runtime
├── .github/workflows/update-stats.yml  # Weekly archive refresh
├── public/                             # Static assets, PWA manifest
├── docs/FIVB-API-Documentation.md      # LOCAL API reference - read this first
├── docs/PLAN-STATYSTYKI.md             # Statistics rollout plan + API findings
└── next.config.mjs
```

## Commands

```bash
npm run dev          # Dev server on :3000 (webpack, see note below)
npm run build        # Production build - THE verification gate
npm run start        # Serve production build
npm run test:fivb    # Smoke-test the live FIVB API connection
npm run test:stats   # Smoke-test the statistics layer against live data

npm run stats:backfill   # Fetch new tournaments into data/stats/ (idempotent)
npm run stats:aggregate  # Rebuild data/aggregates.json from the archive
```

Run `stats:aggregate` after every `stats:backfill` -- the aggregate file is what
the app reads at runtime, and a stale one silently shows outdated averages.

If `npm run build` fails with `MODULE_NOT_FOUND ./NNN.js` or `PageNotFoundError`,
delete `.next/` and rebuild - that is a stale dev artifact, not a code error.

Both scripts pass `--webpack`. Next 16 defaults to Turbopack, which the
`@serwist/next` service-worker plugin cannot hook into; drop the flag once
Serwist's Turbopack support is no longer experimental.

## Documentation Paths

```
FIVB API reference: docs/FIVB-API-Documentation.md   (LOCAL - read this first!)
VIS SDK overview:   https://www.fivb.org/Vissdk/#VisSdk.html
VIS Web Service:    https://www.fivb.org/VisSDK/VisWebService/#Introduction.html
Data model:         https://www.fivb.org/VisSDK/Fivb.Vis.Model/#Fivb.Vis.Model.html
```

> **WARNING:** The external links are JavaScript-rendered - content will not load
> via plain fetch. Always prefer the local doc.

## Project-Specific Rules

1. **All FIVB access goes through `FivbClient`** (`src/lib/fivb/client.ts`).
   Never `fetch()` the VIS endpoint from a component or route handler directly.
2. **Every client method wraps its work in `globalCache.getOrSet()`** with an
   explicit TTL. Adding a new API call without a TTL is a bug.
3. **Route handlers must set `Cache-Control` with `s-maxage`.** On Vercel this is
   the cache that actually matters - `globalCache` is per-instance and does not
   survive across serverless invocations. The CDN header is the real protection
   against hammering the FIVB API.
4. **`export const dynamic = "force-dynamic"`** on every route handler reading
   live data.
5. Dates displayed to users: **DD-MM-YYYY** (European style).
6. Styling: Tailwind utility classes inline. No CSS modules, no styled-components.
7. Components in `src/components/` stay presentational - fetching and data
   shaping belong in `src/lib/` or the page/route.
8. Types live in `src/lib/fivb/types.ts` - do not redeclare API shapes locally.

## Statistics Archive

Player statistics come from `GetBeachStatisticList`, undocumented in the public
`RequestList` but open. Full findings and the rollout plan: `docs/PLAN-STATYSTYKI.md`.

Three rules that are easy to get wrong:

1. **Zero is not missing data.** For a match played without a statistician FIVB
   returns a valid response with every counter zeroed. `isMeasured()` in
   `src/lib/fivb/statistics.ts` is the only place that distinction is made -- an
   unmeasured match must reach the UI as `null`, never as a row of zeros, and
   must never enter an average.
2. **Players are keyed by `NoItem`, not `NoPlayer`.** `NoPlayer` is accepted in
   `Fields` and silently never returned. Rows with `ItemType="30"` are players,
   `"11"` are teams and always come back zeroed.
3. **The archive is append-only.** `data/stats/*.json` is written once and never
   refreshed: coverage gaps are structural (qualification rounds, side courts),
   not a matter of waiting. Column order in `STAT_COLUMNS` and
   `AGGREGATE_COLUMNS` is likewise append-only -- reordering reinterprets every
   number already stored.

Coverage: Elite16, Challenge, Pro Tour Finals, World Championships and Olympics,
both genders, 2022 onwards. **Futures have no statistics** -- 302 tournaments
scanned, one measured match in total. Any UI showing career figures has to say so,
or the first visitor looking up a Futures player will think the app is broken.

## Cache Strategy (keep the two layers consistent)

| Data | `globalCache` TTL | Route `s-maxage` |
|------|-------------------|------------------|
| Live matches (`/api/live`) | 25 s | 20 s |
| Polish teams (`/api/polish-teams`) | 60 s | 45 s |
| Tournament list (`/api/tournaments`) | 3600 s | 1800 s |
| Tournament matches (`/api/tournaments/[id]`) | 25 s | 25 s |
| Tournament entry list (seeding + rosters) | 3600 s | via the route above |
| Match detail (`/api/matches/[id]`) | 25 s | 25 s live / 1800 s finished |
| Match statistics | 25 s live / 3600 s finished | via the route above |

When changing one column, change the other. The CDN value should sit at or below
the in-memory TTL.

---

# PART 3: FIVB VIS API QUICK REFERENCE

Full details in `docs/FIVB-API-Documentation.md`.

### Endpoint

```
POST https://www.fivb.org/vis2009/XmlRequest.asmx
Content-Type: text/xml; charset=utf-8
```

### Request types in use

| Type | Purpose |
|------|---------|
| GetBeachTournamentList | List tournaments for a season |
| GetBeachTournament | Single tournament details |
| GetBeachMatchList | Matches for a tournament |
| GetBeachMatch | Single match with set scores |
| GetBeachRoundList | Rounds / phases |
| GetBeachTournamentRanking | Final ranking |

### Gotchas

- Responses are **attribute-based XML**, not element text.
- Always specify the `Fields` attribute - unfiltered responses are huge.
- `GetBeachTournamentList` has no filter element; filter client-side.
- Requests time out at 10 s (`FivbClient.TIMEOUT_MS`); failures return `null` and
  the client degrades to an empty list rather than throwing.

---

# PART 4: DEPLOYMENT

Hosted on **Vercel Hobby**, auto-deploying from `main` on GitHub.

- No environment variables required.
- Vercel Hobby is licensed for **non-commercial use only** - adding ads or
  monetisation means upgrading to Pro.
- Vercel builds from a clean checkout, so a stale local `.next/` never affects it.

---

# PART 5: MAINTENANCE

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-10 | 0.1.0 | Initial version - WordPress plugin |
| 2026-08-19 | 1.0.0 | Rewritten as a standalone Next.js 15 app; WordPress plugin sources removed (still recoverable from commit 2a36f8b) |

---

**Last Updated**: 2026-08-19

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
Framework:   Next.js 15 (App Router, React 19, Server Components)
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
│       └── fivb/
│           ├── client.ts               # FivbClient - all API calls + caching
│           ├── requestBuilder.ts       # Builds VIS XML requests
│           ├── responseParser.ts       # Parses VIS XML responses
│           ├── types.ts                # Tournament, Match, LiveCenterData, ...
│           └── test-client.ts          # Manual API smoke test (npm run test:fivb)
├── public/                             # Static assets, PWA manifest
├── docs/FIVB-API-Documentation.md      # LOCAL API reference - read this first
└── next.config.mjs
```

## Commands

```bash
npm run dev          # Dev server on :3000
npm run build        # Production build - THE verification gate
npm run start        # Serve production build
npm run test:fivb    # Smoke-test the live FIVB API connection
```

If `npm run build` fails with `MODULE_NOT_FOUND ./NNN.js` or `PageNotFoundError`,
delete `.next/` and rebuild - that is a stale dev artifact, not a code error.

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

## Cache Strategy (keep the two layers consistent)

| Data | `globalCache` TTL | Route `s-maxage` |
|------|-------------------|------------------|
| Live matches (`/api/live`) | 25 s | 20 s |
| Polish teams (`/api/polish-teams`) | 60 s | 45 s |
| Tournament list (`/api/tournaments`) | 3600 s | 1800 s |
| Tournament matches (`/api/tournaments/[id]`) | 25 s | 25 s |
| Tournament entry list (seeding) | 3600 s | via the route above |

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

# Beach Volley Results - Project Configuration

**Version**: 1.0.0
**Purpose**: WordPress plugin displaying live scores and results from FIVB VIS API
**Philosophy**: AI as a tool under human control - proposes, human decides

---

# PART 1: CORE RULES (NEVER CHANGE)

## RULE #1: Plan → Approval → Implementation

**NEVER start coding without explicit user approval of the implementation plan.**

### Workflow Steps:

1. **Understand**: Ask clarifying questions if needed
2. **Analyze**: Read relevant files, understand existing structure
3. **Plan**: Create detailed step-by-step plan with file references
4. **Present**: Show what will be changed and why
5. **WAIT**: Do not proceed until user explicitly approves ("tak", "yes", "ok")
6. **Implement**: Only after approval, start coding
7. **Verify**: Check diagnostics, test changes
8. **Report**: Show what was done with `file:line` references

---

## RULE #2: Always Read Before Edit

**NEVER edit a file without reading it first.**

---

## RULE #3: Git Commit Standards

**NEVER include references to AI tools in commit messages.**

### Commit Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring without behavior change
- `docs:` - Documentation only
- `style:` - Formatting, no code change
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

---

## RULE #4: Documentation Transparency

**ALWAYS explicitly state which documentation you used (or why you didn't use any).**

---

## RULE #5: Task Management

**Use todo tracking for ALL multi-step tasks.**

---

## RULE #6: Language Standards

- **User Communication**: POLISH
- **Code & Comments**: ENGLISH ONLY
- **Variable/Function Names**: English naming conventions

---

## RULE #7: Security Mindset

### Universal Security Checklist:
- [ ] Input validation on all user-provided data
- [ ] Output encoding/escaping where displayed
- [ ] Authentication checks on protected operations
- [ ] Authorization checks (can this user do this?)
- [ ] No secrets/credentials in code or commits
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (proper escaping)

---

## RULE #8: Code Quality Principles

- **Clarity over cleverness**: Readable code > smart code
- **Minimal changes**: Only change what's needed for the task
- **No gold-plating**: Don't add features not requested
- **Consistency**: Follow existing patterns in the codebase
- **Error handling**: Handle failures gracefully

---

# PART 2: PROJECT CONFIGURATION

## Project Overview

```
Project Name: Beach Volley Results
Type: WordPress Plugin
Status: development
Slug: beach-volley-results
Text Domain: beach-volley-results
Function/Class Prefix: bvr_
Namespace: BeachVolleyResults
```

## Technology Stack

```
Primary Language: PHP 8.0+
Framework: WordPress 6.0+
Database: WordPress (transients API, user_meta, options)
API: FIVB VIS XML API (https://www.fivb.org/vis2009/XmlRequest.asmx)
Theme Compatibility: Flatsome (UX Builder)
Translation: WPML compatible
Dependencies: Composer (PSR-4 autoload)
```

## Project Structure

```
beach-volley-results/
├── beach-volley-results.php    # Main plugin file, bootstrap
├── composer.json               # PSR-4 autoload configuration
├── uninstall.php               # Cleanup on uninstall
├── CLAUDE.md                   # This file - AI assistant rules
├── src/
│   ├── Plugin.php              # Main plugin class (singleton)
│   ├── Api/
│   │   ├── Client.php          # FIVB API client
│   │   ├── RequestBuilder.php  # XML request builder
│   │   └── ResponseParser.php  # XML/response parser
│   ├── Cache/
│   │   └── CacheManager.php    # Transients + object cache wrapper
│   ├── Shortcodes/
│   │   ├── AbstractShortcode.php   # Base class
│   │   ├── LiveWidget.php          # [bvr_live_widget]
│   │   ├── ResultsPage.php         # [bvr_results]
│   │   ├── PolishTeams.php         # [bvr_polish_teams]
│   │   └── Tournament.php          # [bvr_tournament]
│   ├── Widgets/
│   │   └── LiveScoresWidget.php    # WordPress widget wrapper
│   ├── Blocks/
│   │   └── DynamicBlock.php        # Gutenberg dynamic block
│   ├── Admin/
│   │   ├── AdminMenu.php           # Menu registration
│   │   ├── SettingsPage.php        # Settings tab
│   │   ├── DashboardPage.php       # Stats/status tab
│   │   └── HelpPage.php            # Documentation tab
│   ├── Frontend/
│   │   ├── AssetManager.php        # CSS/JS enqueue
│   │   └── AjaxHandler.php         # AJAX endpoints
│   ├── User/
│   │   └── Preferences.php         # User country preference
│   └── Utils/
│       ├── CountryHelper.php       # Country codes, flags
│       └── DateFormatter.php       # Date formatting (DD-MM-YYYY)
├── assets/
│   ├── css/
│   │   ├── frontend.css            # Main frontend styles
│   │   └── admin.css               # Admin panel styles
│   └── js/
│       ├── frontend.js             # Auto-refresh, interactions
│       └── admin.js                # Admin panel JS
├── templates/
│   ├── widget/
│   │   └── live-widget.php         # Widget template
│   ├── results/
│   │   ├── results-page.php        # Full results page
│   │   ├── match-card-live.php     # Live match card
│   │   ├── match-card-finished.php # Finished match card
│   │   └── tournament-card.php     # Tournament card
│   └── admin/
│       ├── dashboard.php
│       ├── settings.php
│       └── help.php
└── languages/
    └── beach-volley-results.pot    # Translation template
```

## Documentation Paths

```
Main specification: beach-volley-results-prompt.md
Workflow guide: claude-code-workflow.md
AI rules: CLAUDE.md (this file)
FIVB API docs: docs/FIVB-API-Documentation.md (LOCAL - read this first!)
```

## FIVB API External Links (if local docs insufficient)

```
VIS SDK Overview: https://www.fivb.org/Vissdk/#VisSdk.html
VIS Web Service: https://www.fivb.org/VisSDK/VisWebService/#Introduction.html
Data Model Reference: https://www.fivb.org/VisSDK/Fivb.Vis.Model/#Fivb.Vis.Model.html
```

> **WARNING:** External links use JavaScript frameworks - content loads dynamically.
> Always prefer local docs/FIVB-API-Documentation.md

## Development Environment

```
Local setup: WordPress local environment (LocalWP, XAMPP, etc.)
Build command: composer dump-autoload
Test command: Manual testing in WordPress admin
Deploy method: ZIP upload or FTP to /wp-content/plugins/
```

## Project-Specific Rules

```
1. Always use `bvr_` prefix for functions, hooks, transients
2. Always use `BeachVolleyResults` namespace for classes
3. All API data is untrusted - escape on output
4. Use WordPress Transients API for caching
5. Date format: DD-MM-YYYY (European style)
6. CSS: BEM naming convention (.bvr-block__element--modifier)
7. JS: Vanilla JavaScript only (no jQuery dependency)
8. Templates: Minimal logic, prepare data in shortcode class
```

## Key Resources

```
FIVB VIS API: https://www.fivb.org/vis2009/XmlRequest.asmx
WordPress Plugin Handbook: https://developer.wordpress.org/plugins/
Flatsome Documentation: https://developer.flatsome.com/
```

---

# PART 3: API REFERENCE

## FIVB VIS API

### Endpoint
```
POST https://www.fivb.org/vis2009/XmlRequest.asmx
Content-Type: text/xml; charset=utf-8
```

### Request Types

| Type | Purpose | Key Fields |
|------|---------|------------|
| GetBeachTournamentList | List tournaments | No, Title, Code, StartDate, EndDate, City, CountryCode, Gender, Type, Status |
| GetBeachMatchList | Matches for tournament | No, TeamAName, TeamBName, PointsTeamA, PointsTeamB, MatchStatus, Round |
| GetBeachMatch | Single match details | Set scores, duration |
| GetBeachTeam | Team/player info | Player names, country, ranking |

### Cache Strategy

| Data Type | Cache Key | TTL |
|-----------|-----------|-----|
| Live matches | `bvr_live_{tournament_id}` | 30 seconds |
| Tournament list | `bvr_tournaments_{season}` | 6 hours |
| Finished matches | `bvr_matches_{tournament_id}` | 24 hours |
| Tournament details | `bvr_tournament_{id}` | 2 hours |

---

# PART 4: SHORTCODES REFERENCE

## [bvr_live_widget]
Compact sidebar widget showing live matches.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| title | string | "Beach Volley Live" | Widget title |
| limit | int | 5 | Max matches to show |
| show_link | bool | true | Show "View all" link |
| link_url | string | "" | Custom URL for "View all" |

## [bvr_results]
Full results page with tabs, filters, pagination.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| preset | string | "all" | Preset config (all/live/elite) |
| season | int | current year | Season year |
| gender | string | "all" | M/W/all |
| limit | int | 20 | Results per page |
| auto_refresh | int | 0 | Seconds (0=off) |

## [bvr_polish_teams]
Dedicated widget for specific country teams.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| country | string | "POL" | Country code to highlight |
| limit | int | 6 | Max matches |

## [bvr_tournament id="X"]
Single tournament details.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| id | int | required | Tournament No from API |
| show_bracket | bool | true | Show bracket/phases |
| show_matches | bool | true | Show match list |

---

# PART 5: IMPLEMENTATION PHASES

## Phase 1: Core Foundation
1. Plugin bootstrap, autoloader, main class
2. API Client with basic request/response
3. Cache Manager
4. Settings page (basic)

## Phase 2: Shortcodes
1. [bvr_live_widget] - simplest, test API
2. [bvr_results] - full featured
3. [bvr_polish_teams]
4. [bvr_tournament]

## Phase 3: Frontend
1. CSS styling
2. JavaScript auto-refresh
3. AJAX endpoints

## Phase 4: Integrations
1. WordPress Widget
2. Gutenberg Block
3. Flatsome UX Builder element

## Phase 5: Polish
1. Admin dashboard with stats
2. Help documentation
3. Translation file
4. User country preference

---

# PART 6: TEMPLATES

## Plan Presentation Template

```markdown
## Implementation Plan: [Feature/Task Name]

📚 Documentation consulted:
- [doc] - [why]

### Analysis
[Brief analysis of current state]

### Proposed Changes

**Files to modify:**
1. `path/to/file.ext` - [what and why]

**New files (if any):**
1. `path/to/new.ext` - [purpose]

### Implementation Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Risks & Considerations
- [Any risks or things to watch out for]

---
Do you approve this plan?
```

## Task Completion Report Template

```markdown
## Completed: [Task Name]

### Changes Made
- `file:line` - [description of change]

### Verified
- [ ] Code works as expected
- [ ] No new errors introduced
- [ ] Security considerations addressed

### Notes
[Any additional notes or follow-up items]
```

---

# PART 7: MAINTENANCE

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-10 | 1.0.0 | Initial version - project setup |

---

# Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│              BEACH VOLLEY RESULTS - RULES               │
├─────────────────────────────────────────────────────────┤
│ 1. PLAN → APPROVAL → IMPLEMENT (never skip approval)   │
│ 2. READ before EDIT (always understand context)        │
│ 3. NO AI refs in commits (professional git history)    │
│ 4. STATE docs used (transparency in decisions)         │
│ 5. TRACK tasks (todo for multi-step work)              │
│ 6. PL for talk, EN for code (language standards)       │
│ 7. SECURITY mindset (always consider risks)            │
│ 8. MINIMAL changes (only what's needed)                │
├─────────────────────────────────────────────────────────┤
│ Prefixes: bvr_ (functions), BeachVolleyResults (NS)    │
│ Cache: 30s live, 6h tournaments, 24h finished          │
│ CSS: BEM naming, JS: Vanilla only                      │
└─────────────────────────────────────────────────────────┘
```

---

**Last Updated**: 2025-12-10
**Version**: 1.0.0

# AI Project Discovery Workflow — Design Spec

**Date:** 2026-07-01  
**Status:** Approved

---

## Overview

A daily scheduled multi-agent workflow that automatically discovers interesting AI/agent projects from across the internet, screens them for viability, and produces Claude-executable implementation plans for the ones worth building. Output is a VitePress site used as a personal morning dashboard.

---

## User Interest Profile

Derived from analysis of `~/my-works` (168+ projects) and recent sessions:

- **Claude/LLM tooling** — extensions, wrappers, CLI tools around Claude and other LLMs
- **Agent UIs** — custom interfaces for agent interaction (multiple "claw" variants, openclaw, devgate)
- **Dev productivity** — coding assistants, voice tools, redmine integrations, diary/logging tools
- **Personal finance AI** — expense tracking, budget analysis, card management
- **Flutter + web AI apps** — mobile-first AI-powered personal tools

**Executor context:** Claude is the builder. All viability and planning is scoped to what Claude can execute autonomously — not the user's personal expertise. Stack is irrelevant (user works across Flutter, Nuxt, Node, Python, Rust all via Claude).

---

## Pipeline Architecture

```
[Cron: daily 7am]
       │
       ▼
┌─────────────────────────────────────────┐
│           Discovery Agent               │
│                                         │
│  Searches trusted, currently-active AI  │
│  community sources (agent determines    │
│  sources each run — no hardcoded list)  │
│  Covers: forums, social media,          │
│  communities, repos, launch platforms   │
│                                         │
│  Deduplicates against state/seen.json   │
│  Scores against interest profile        │
│  → top 8-10 candidates                  │
└──────────────────┬──────────────────────┘
                   │ candidates (scored ≥ 2/4 interest match)
                   ▼
┌─────────────────────────────────────────┐
│           Viability Agent               │
│                                         │
│  Scores each candidate on 4 criteria:   │
│  1. Weekend-buildable (clear MVP scope) │
│  2. Fills a gap in user's existing      │
│     tools / Claude ecosystem            │
│  3. Novel — not a polished OSS clone    │
│  4. Daily utility — user would use it   │
│                                         │
│  Pass threshold: ≥ 3/4 criteria met     │
└──────────────────┬──────────────────────┘
                   │ viable projects only
                   ▼
┌─────────────────────────────────────────┐
│           Planning Agent                │
│  (one per viable project, parallel)     │
│                                         │
│  Produces Claude-executable plan:       │
│  - Phases and subagents                 │
│  - Files to create                      │
│  - Effort in Claude sessions            │
│  - Tech stack recommendation            │
│  Uses superpowers writing-plans pattern │
└──────────────────┬──────────────────────┘
                   │
                   ▼
          Write markdown files
          Commit to VitePress repo
```

---

## Output Structure

### VitePress Site Root: `~/my-works/myplanner/`

```
myplanner/
├── docs/
│   ├── index.md                          ← landing / recent digests
│   ├── daily/
│   │   └── YYYY-MM-DD.md                ← daily digest (one per run)
│   └── projects/
│       └── YYYY-MM-DD-<slug>.md         ← full plan per viable project
├── state/
│   └── seen.json                         ← dedup tracker
├── .vitepress/
│   └── config.ts                         ← auto-generated sidebar
└── package.json
```

### Daily Digest (`docs/daily/YYYY-MM-DD.md`)

- Sources checked that day (agent-determined)
- All candidates found with brief why-interesting note
- Viability scores table
- Links to project plan pages for viable ones

### Project Plan Page (`docs/projects/YYYY-MM-DD-<slug>.md`)

- What it is + source link
- Why it matches interest profile
- Viability scores breakdown (4 criteria)
- Full Claude-executable implementation plan
  - Phases with descriptions
  - Subagents needed
  - Files to create/modify
  - Estimated effort (Claude sessions, not hours)

### VitePress Sidebar

Auto-generated on each run:
- Daily digests — newest first
- Project plans — grouped by month

---

## Scheduling & Execution

**Trigger:** Daily cron at 7am via `schedule` skill (cloud agent — machine does not need to be on).

**Orchestration:** Single Workflow script with 4 phases:

| Phase | Agent(s) | Tool(s) |
|-------|----------|---------|
| Discovery | 1 agent | WebSearch, WebFetch, GitHub API |
| Viability | N agents (parallel, one per candidate) | None — reasoning only |
| Planning | N agents (parallel, one per viable project) | Write, superpowers patterns |
| Write | 1 agent | Write, Edit (VitePress config), Bash (git commit) |

**State management:** `state/seen.json` stores `{url, title, date_seen}` for every previously discovered item. Discovery agent skips known URLs.

**GitHub API:** Uses `GITHUB_TOKEN` env var for higher rate limits. Stored via `vercel env` or local `.env`. All other sources use `WebSearch` — no extra keys needed.

---

## Error Handling

- Discovery finds 0 results → digest still written noting no new items found
- Viability agent scores all candidates below threshold → digest written, no project pages generated
- Planning agent fails for one project → that project page notes "plan generation failed, retry tomorrow"; other projects unaffected
- `seen.json` missing or corrupt → treated as empty (full re-discovery that day, dedup resumes next run)

---

## Constraints & Decisions

| Decision | Reason |
|----------|--------|
| Agent determines sources each run | Community activity shifts; hardcoded sources go stale |
| Viability threshold ≥ 3/4 | Strict enough to avoid noise, loose enough to not miss good projects |
| VitePress local only, no deploy | Personal dashboard — no exposure risk, no hosting cost |
| Claude is the executor, not the user | User works across all stacks via Claude; no stack constraint on viability |
| `seen.json` dedup | Prevents same project surfacing repeatedly across days |

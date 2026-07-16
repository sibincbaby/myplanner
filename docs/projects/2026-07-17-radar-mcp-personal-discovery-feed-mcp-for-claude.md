# radar-mcp — a personal discovery-feed MCP for Claude

**Source:** <https://github.com/trendsmcp/trends-agent-claude>
**Discovered:** 2026-07-17
**Viability:** 3/4

> Seeded by TrendsMCP (a remote MCP that feeds Claude live trend data), but the build target is **not** a TrendsMCP clone. It is a small, local, self-hosted MCP tuned to the user's own discovery pipeline: query public "new/trending" endpoints, normalize the results, score them against the user's interest keywords, and dedup against this repo's `state/seen.json` — so the daily discovery agent stops relying on ad-hoc `WebSearch` and calls a structured tool instead.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

A TypeScript stdio MCP over free, keyless APIs (GitHub search, Hacker News Algolia, Reddit JSON) with local dedup is a 1–2 session build, so weekend_buildable=1. It fills a concrete gap in the user's own toolkit: the discovery pipeline documented in this repo currently searches the web freeform and (per the project's own notes) the dedup/seen steps can silently no-op — a purpose-built tool that returns already-deduped, interest-scored candidates removes that failure mode, so fills_gap=1. daily_utility=1 because the discovery workflow runs every day and this is its data source. novel=0 is the honest deduction: TrendsMCP exists, and trend/news MCPs are a crowded category — the value here is the personal wiring to `seen.json` and the user's interest profile, not a new concept. Total 3, viable.

---

## Implementation Plan

## Overview

A local Model Context Protocol server that Claude Code (or Claude Desktop) can call to fetch fresh AI/agent/dev-tool project signals. Instead of the discovery agent issuing scattered `WebSearch` calls and hand-deduping, it calls one MCP tool that fans out across public "new/trending" endpoints, merges and dedups by URL, drops anything already in `state/seen.json`, and returns normalized candidates scored against the user's interest keywords.

The MVP is the closed loop: **query sources → normalize → merge/dedup → filter against seen-list → interest-score → return**. Everything runs locally over free, unauthenticated HTTP APIs; no database, no paid keys, no server to host.

This deliberately is **not** a re-implementation of TrendsMCP's broad multi-platform leaderboard product. It drops YouTube/TikTok/Amazon/Steam/App Store and the hosted billing model in favor of the three sources that actually feed this pipeline (GitHub, Hacker News, Reddit) plus direct knowledge of the local seen-list and interest profile.

## Stack Recommendation

- **Language: TypeScript, `@modelcontextprotocol/sdk` (stdio transport).** Matches the MCP ecosystem and drops straight into Claude Code's `mcpServers` config with zero hosting. Node 20+.
- **HTTP: built-in `fetch`.** No client library needed for three GET endpoints.
- **Sources (all keyless):**
  - GitHub REST search — `GET /search/repositories?q=<topics>+pushed:>=<date>&sort=updated` (10 req/min unauthenticated; optional `GITHUB_TOKEN` raises it).
  - Hacker News Algolia — `GET https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&query=<q>` (no key, generous limits).
  - Reddit — `GET https://www.reddit.com/r/<sub>/new.json?limit=25` with a custom `User-Agent` (required or Reddit 429s).
- **Dedup + config: plain JSON files.** Read this repo's existing `state/seen.json` for the seen-URL set; a small `radar.config.json` holds interest keywords, subreddit list, GitHub topics, and the seen-list path.
- **No DB, no cache server.** In-memory only for a single call; a 15-minute in-process cache is enough to avoid hammering APIs during a session.

## MVP Scope

In:
- MCP tool `search_new_projects({ query?, since_hours=48, sources? })` → array of `{ url, title, source, summary, posted_at, interest_score }`.
- Source adapters for GitHub, HN, Reddit that each return the normalized shape.
- Merge + dedup by canonical URL across sources.
- `filter_unseen` — read `state/seen.json`, drop candidates whose URL is already seen.
- Interest scoring — keyword-weight the title/summary against the config's interest terms → 0–4.
- `radar.config.json` for interest keywords, subreddits, GitHub topics, seen-path, User-Agent.

Out (later): Product Hunt (needs OAuth), X/Twitter (no free API), hosted/remote transport, writing back to `seen.json` (the discovery agent still owns that write), a leaderboard/`top_trending` UI, persistent cache/DB.

## Implementation Phases

### Phase 1: MCP scaffold + one source
**Goal:** From Claude Code, call `search_new_projects` and get back normalized Show HN results.
**Files to create/modify:**
- `package.json` — `@modelcontextprotocol/sdk`, `typescript`, `tsx`; `bin`/start script.
- `src/server.ts` — stdio MCP server; register the `search_new_projects` tool with a JSON schema.
- `src/types.ts` — the `Candidate` shape `{ url, title, source, summary, posted_at, interest_score }`.
- `src/sources/hn.ts` — HN Algolia adapter (`search_by_date`, `tags=show_hn`), map to `Candidate`.
- `README.md` — the `claude mcp add` / `mcpServers` snippet.
**Key steps:**
1. Stand up the stdio server and confirm it lists the tool via `claude mcp` / the client.
2. Implement the HN adapter: fetch, map `created_at` → `posted_at`, `url`/`story_text` → summary.
3. Return raw (unscored, undeduped) candidates so the wire format is verified early.
**Verify:** Register the server in Claude Code and call the tool for `tags=show_hn`; confirm you get back a JSON array of real recent HN items with the normalized fields.

### Phase 2: GitHub + Reddit sources, merge + dedup
**Goal:** One call fans out to all three sources and returns a single deduped list.
**Files to create/modify:**
- `src/sources/github.ts` — REST search with `pushed:>=<since>` + topic filter; map `html_url`, `description`, `pushed_at`.
- `src/sources/reddit.ts` — `/r/<sub>/new.json` with `User-Agent`; map permalink → url, title, selftext → summary.
- `src/merge.ts` — canonicalize URLs (strip trailing slash / tracking params) and dedup across sources.
- `src/server.ts` — fan out to selected `sources`, `Promise.allSettled`, merge.
**Key steps:**
1. Add the two adapters behind the same `Candidate` contract.
2. Run sources concurrently; a failing source degrades to empty, never fails the whole call.
3. Merge and dedup by canonical URL, keeping the earliest `posted_at`.
**Verify:** Call with all three sources; confirm results from each appear, that a project surfaced on both HN and GitHub collapses to one row, and that one source being down still returns the others.

### Phase 3: Seen-list filter + interest scoring
**Goal:** Results exclude anything already in `state/seen.json` and carry a 0–4 interest score.
**Files to create/modify:**
- `src/seen.ts` — load the seen-path JSON, build a `Set` of canonical URLs, expose `isSeen(url)`.
- `src/score.ts` — keyword-weight title+summary against config interest terms → `interest_score` (cap 4).
- `src/server.ts` — apply `filter_unseen` then scoring; add a `min_interest` param (default 2).
- `radar.config.json` — `{ interestKeywords, subreddits, githubTopics, seenPath, userAgent }`.
**Key steps:**
1. Load seen URLs once per call (canonicalize both sides before comparing — this is where a silent no-op hides).
2. Score by matching interest keyword groups (one point per distinct interest area matched).
3. Filter out `interest_score < min_interest` and sort by score then recency.
**Verify:** Seed the config's seen-path with a URL you know the sources return; confirm it is excluded. Confirm a Claude-tooling repo scores higher than an unrelated one, and that `min_interest=2` trims the tail. Add a self-check (`node --test` or an `assert`-based `demo`) that dedup drops a known-seen canonical URL and that scoring is monotonic in keyword matches — the two pieces of non-trivial logic.

### Phase 4: Config, caching, hardening
**Goal:** Make it robust and configurable for daily use.
**Files to create/modify:**
- `src/http.ts` — thin `fetch` wrapper: 15-min in-process cache by URL, timeout, one retry, `User-Agent` header.
- `src/sources/github.ts` — honor optional `GITHUB_TOKEN`; handle 403/rate-limit with a clear message.
- `src/server.ts` — validate/normalize the `since_hours` window; guard empty/oversized responses.
- `README.md` — document config fields, rate-limit notes, and the `claude mcp add` command.
**Key steps:**
1. Route all adapters through the cached HTTP wrapper so a session's repeated calls don't re-hit APIs.
2. Add token support + rate-limit backoff for GitHub; keep Reddit `User-Agent` mandatory.
3. Clamp the time window and cap results per source to keep payloads small.
**Verify:** Run two identical calls in one session and confirm the second is served from cache (no new network hits). Remove the Reddit `User-Agent` and confirm the adapter fails gracefully (empty, logged) rather than throwing. Point `seenPath` at this repo's real `state/seen.json` and confirm today's already-recorded candidates are excluded.

## Estimated Effort

**1–2 Claude Code sessions.**
- **Session 1:** Phases 1–2 — MCP scaffold, all three source adapters, merge/dedup verified end-to-end from Claude Code.
- **Session 2:** Phases 3–4 — seen-list filtering, interest scoring, config, caching, and rate-limit hardening (the correctness-sensitive work: URL canonicalization on both sides of the dedup, and honest interest scoring).

## Potential Blockers

- **URL canonicalization drift.** Dedup and seen-filtering only work if both sides canonicalize identically (trailing slashes, `www.`, query/tracking params, HN item vs. project URL). Get this wrong and the tool silently returns already-seen items — the exact failure this project exists to remove. Make canonicalization one shared function with a test.
- **Rate limits.** Unauthenticated GitHub search is ~10 req/min and Reddit 429s without a real `User-Agent`. Cache aggressively, keep per-call source counts low, and support an optional `GITHUB_TOKEN`.
- **"Last 24–48h" is fuzzy.** GitHub search filters on `pushed`/`created`, not "posted"; a repo can trend long after creation. Treat the window as a heuristic and lean on HN/Reddit for genuine recency.
- **Overlap with TrendsMCP.** If this grows toward a broad multi-platform leaderboard it becomes an inferior TrendsMCP. Keep it personal and local — its differentiator is the wiring to `seen.json` and the user's interest profile, nothing more.
- **Seen-list ownership.** The MCP should *read* `seen.json` but not write it — the discovery agent owns that write. Two writers to one file is how the seen-list silently desyncs.
- **Product Hunt / X gaps.** Both need auth (OAuth / paid). Leave them out of MVP rather than shipping a broken adapter; the three keyless sources cover most of what this pipeline actually surfaces.

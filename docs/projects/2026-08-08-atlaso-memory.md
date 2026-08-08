# atlaso-memory — Cross-Session AI Memory MCP Server

**Source:** [Atlaso](https://www.atlaso.ai/) · Product Hunt Aug 6 2026 (250 votes, #3 of the day)  
**Language:** Plan: Node.js / TypeScript  
**Date discovered:** 2026-08-08

## What it is

Atlaso is a shared AI memory layer that you connect once, and every AI you use — Claude Code, Cursor, Codex, ChatGPT — automatically recalls the context that matters: your projects, decisions, and working style. Memories are captured as you work, secrets are scrubbed before storage, and before your first prompt lands each session the relevant context is already injected. When plans change, Atlaso detects contradictions, retires stale decisions, and grades every memory by the evidence behind it.

**Why it matters:** Claude Code sessions are siloed — every new session starts blank. You re-explain architecture decisions, repeat conventions, re-confirm which files to avoid. A memory MCP server solves this at the source: the SessionStart hook captures a summary of what just happened; the `recall` tool surfaces the three most relevant memories at the start of every new session. No cloud service needed; all SQLite, all local.

## Why it fits

- Core interest: **Claude/LLM tooling** — deep Claude Code integration via MCP + hooks
- Core interest: **dev productivity** — eliminates "re-explain everything" friction at session start
- `daily_utility = 1`: every Claude Code session benefits from persistent context
- `novel = 1`: cross-session memory for Claude Code via MCP + hooks has no equivalent in the backlog

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | MCP server skeleton + SQLite + Claude Code hook = 1 focused session |
| fills_gap | 1 | No persistent cross-session memory tool in the backlog |
| novel | 1 | MCP + SessionStart hook combination for local Claude Code memory is original |
| daily_utility | 1 | Every Claude Code session benefits; fully passive once set up |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
MCP server:    @modelcontextprotocol/sdk (Node.js) — stdio transport for Claude Code
Storage:       better-sqlite3 — memories, sessions, tags, keyword index
Search:        Full-text search via SQLite FTS5 (no vector dep) — fast enough at <10k memories
Hooks:         Claude Code SessionStart / Stop hooks in settings.json
Summariser:    Claude API call in the Stop hook — summarise session transcript into 3-5 memory bullets
Dedup:         Cosine similarity on cached TF-IDF vectors (100-line pure JS implementation)
Config:        ~/.atlaso/config.json — Claude API key, max memories, retention days
```

No external embedding services or vector databases. SQLite FTS5 + keyword scoring handles recall at personal memory scales (< 10,000 memories) with zero ongoing cost.

## MVP Scope (1 Claude session)

1. MCP server with two tools: `remember(content, tags[])` and `recall(query, limit=5)`
2. `remember` stores a memory row in SQLite with `{content, tags, created_at, source_session_id}`
3. `recall` does FTS5 keyword search + recency boost; returns top-5 results as a formatted string
4. Claude Code `SessionStart` hook: runs `atlaso recall "$(pwd)"` → pipes top memories into the session as a system note
5. Claude Code `Stop` hook: calls Claude API with the session transcript summary prompt → stores 3-5 bullet memories

## Phases

### Phase 1: MCP Server Skeleton + SQLite (2h)
- `npx @modelcontextprotocol/create-server atlaso-memory` → strip template → add `remember` and `recall` tools
- SQLite schema: `memories(id, content, tags TEXT, source_session, project_path, created_at, evidence_score REAL DEFAULT 1.0)`, `memory_fts(memory_id, content)`
- `remember`: INSERT into memories + FTS table
- `recall`: `SELECT * FROM memory_fts JOIN memories USING (memory_id) WHERE memory_fts MATCH ? ORDER BY rank, created_at DESC LIMIT ?`
- Wire MCP server into `~/.claude/settings.json` under `mcpServers`
- Verify: in Claude Code, call `remember` with "prefer pnpm over npm in this project" — row appears in SQLite

### Phase 2: SessionStart Hook — Auto-Recall (1-2h)
- Add `SessionStart` hook to `~/.claude/settings.json`: `{"hooks": {"SessionStart": [{"command": "node ~/.atlaso/bin/recall-hook.js"}]}}`
- `recall-hook.js`: reads `CLAUDE_PROJECT_PATH` env var → calls `atlaso recall $(basename $CLAUDE_PROJECT_PATH) --limit 5` → prints to stdout as `<!-- memory: ... -->` comment
- Claude Code prepends hook stdout to the session context
- Verify: start a new session in a project; confirm the recall output appears as the first context block

### Phase 3: Stop Hook — Auto-Summarise (2-3h)
- `Stop` hook fires when the session ends; receives session transcript path via env
- Read last N messages from `~/.claude/projects/<id>/*.jsonl`
- Call Claude API: `"Summarise the 3-5 most important decisions, patterns, or watch-outs from this session. Format: bullet points, each ≤ 40 words."`
- Parse bullets → call `remember` for each with `{source_session, project_path, tags: ["auto", "summary"]}`
- Verify: run a 10-message session discussing a coding decision → check that a memory about the decision appears in SQLite after stop

### Phase 4: Memory Management CLI (1-2h)
- `atlaso list [--project <path>] [--tag <tag>]` — display memories as a table
- `atlaso forget <id>` — mark memory as retired (`retired_at` column, excluded from recall)
- `atlaso tag <id> <tag>` — add a tag
- `atlaso stats` — count, oldest, newest, most-recalled memories
- Verify: add 3 memories via CLI, list them, forget one, confirm it no longer appears in recall

### Phase 5: Contradiction Detection + Evidence Scoring (2h)
- On `remember`, run recall against the new memory content; flag any existing memory whose content contradicts the new one (Claude: "Does memory A contradict memory B? Answer yes/no.")
- If contradiction detected: reduce `evidence_score` of older memory by 0.5; surfaced in `recall` output as `⚠️ possibly outdated`
- `evidence_score` also increases when a memory is recalled and the user doesn't dismiss it (future: thumbs-up via MCP tool)
- Verify: store "use pnpm" then store "use npm"; confirm "use pnpm" is flagged as contradicted

## Effort Estimate

| Phase | Hours |
|-------|-------|
| MCP Server + SQLite | 2h |
| SessionStart Hook | 1-2h |
| Stop Hook + Auto-Summarise | 2-3h |
| Memory Management CLI | 1-2h |
| Contradiction Detection | 2h |
| **Total** | **8-11h (~1-2 weekends)** |

Phases 1-3 deliver a fully functional auto-recall + auto-capture memory system in **5-7h (one session)**.

## Blockers / Risks

- Claude Code's `SessionStart` and `Stop` hooks are relatively new additions; verify the hook env vars (`CLAUDE_PROJECT_PATH`, `CLAUDE_SESSION_ID`) are available in the current CLI version before building the hook scripts
- The Stop hook receives the session transcript JSONL path — but the file may still be written by Claude Code as the hook fires; add a 500ms delay before reading, or watch for the file to stop growing
- FTS5 keyword search works well for technical terms but fails on semantic similarity ("use pnpm" vs "prefer pnpm over yarn") — acceptable at MVP scale; add a simple embeddings pass in a later phase if false negatives become a problem
- Memory quality depends on the summariser prompt — a session with no clear decisions produces noisy bullet points; add a confidence gate: only store if the Claude API confidence call returns `score >= 0.6`
- SQLite concurrent writes (Stop hook + manual `remember` calls) need `WAL` mode enabled: `PRAGMA journal_mode=WAL` — prevents "database is locked" errors

# Dokoro — Five-Layer Agent Memory MCP Server

**Source:** <https://github.com/byPawel/devlog-mcp>
**Discovered:** 2026-10-04
**Viability:** 4/4

> An MCP server that gives Claude Code persistent memory across sessions in five layers: working (current tasks), episodic (past sessions), semantic (entities and facts), procedural (plans and sequences), and *affective* (per-tool success/failure rates). The affective layer is the standout: it tracks which tools reliably succeed or fail in a project so the agent can route around broken or slow tools automatically.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

Existing memory MCPs (Memsync, claude-mem) store context as a flat log or vector store — none tracks *which tools performed well*. The affective layer is the gap: an agent that remembers "the test runner times out in this repo but `cargo check` is fast" makes better tool choices without the user narrating the project every session. MVP: working + episodic + affective layers over SQLite in 1-2 sessions; the vector search layer (LanceDB + embeddings) is a stretch goal.

---

## Implementation Plan

**2 Claude Code sessions** to a working MCP server with three memory layers and a Claude Code integration.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (Node.js 20+) | Same as original; MCP SDK is TS-native |
| Protocol | `@modelcontextprotocol/sdk` | Official SDK, stdio transport |
| Storage | SQLite via `better-sqlite3` | FTS5 for episodic search; no Docker needed |
| Vector search (stretch) | LanceDB | Embedded, no server |
| Embeddings (stretch) | `claude-haiku` via Anthropic SDK | Same provider |
| Package manager | npm | Simple |

---

## MVP Scope

Three memory layers with MCP tools:
- **Working** (`working_set`): `remember_working(key, value)`, `recall_working(key)`, `clear_working_set()` — in-memory hash reset each session start.
- **Episodic** (`episodic`): `log_episode(summary, tags[])`, `search_episodes(query, limit)` — SQLite FTS5 rows with timestamp.
- **Affective** (`affective`): `log_tool_outcome(tool, success, latencyMs, context)`, `get_tool_profile(tool)`, `list_tool_profiles()` — SQLite table with per-tool success rate and p95 latency.

Plus `memory_status()` — returns counts from all three layers.

Out of scope for MVP: semantic layer (entity extraction), procedural layer (plan storage), LanceDB vector search.

---

## Implementation Phases

### Phase 1: MCP scaffold and working layer

**Goal:** A runnable MCP server with the working memory layer and a Claude Code `claude mcp add` registration.

**Files:**
- `package.json`, `tsconfig.json`
- `src/index.ts` — MCP server entry, tool registrations
- `src/layers/working.ts` — `WorkingMemory` class (Map, session-scoped)
- `src/db.ts` — `openDb(path)`, migration runner

**Key steps:**
1. `npx @modelcontextprotocol/create-server dokoro --type stdio`.
2. Implement `WorkingMemory`: `set(key, value)`, `get(key)`, `clear()`. No persistence — resets on process restart.
3. Register MCP tools: `remember_working({key, value})`, `recall_working({key})`, `clear_working_set()`.
4. Verify with `claude mcp add dokoro -- npx -y dokoro` and `mcp__dokoro__remember_working`.

---

### Phase 2: Episodic layer (SQLite FTS5)

**Goal:** Log summaries and search them with BM25.

**Files:**
- `src/layers/episodic.ts` — `EpisodicMemory(db)` class

**Key steps:**
1. Schema: `CREATE VIRTUAL TABLE IF NOT EXISTS episodes USING fts5(summary, tags, timestamp UNINDEXED)`.
2. `log(summary, tags[])`: insert row with `datetime('now')`.
3. `search(query, limit=5)`: `SELECT * FROM episodes WHERE episodes MATCH ? ORDER BY rank LIMIT ?`.
4. Register `log_episode({summary, tags})` and `search_episodes({query, limit})`.
5. Test: log 3 episodes about different topics; confirm search returns the right one.

---

### Phase 3: Affective layer (tool performance tracking)

**Goal:** Track success/failure rates and latency per tool so Claude can identify unreliable tools.

**Files:**
- `src/layers/affective.ts` — `AffectiveMemory(db)` class

**Key steps:**
1. Schema:
   ```sql
   CREATE TABLE IF NOT EXISTS tool_outcomes (
     id INTEGER PRIMARY KEY,
     tool TEXT NOT NULL,
     success INTEGER NOT NULL,
     latency_ms INTEGER,
     context TEXT,
     ts TEXT DEFAULT (datetime('now'))
   );
   CREATE INDEX IF NOT EXISTS idx_tool ON tool_outcomes(tool);
   ```
2. `logOutcome(tool, success, latencyMs, context)`: insert row.
3. `getProfile(tool)`: aggregate — `success_rate`, `p50_latency`, `p95_latency`, `sample_count`, `last_seen`. Compute p95 with a simple `ORDER BY latency_ms LIMIT 1 OFFSET round(0.95 * count)` subquery.
4. `listProfiles()`: return all tools with their profiles, sorted by success rate ascending (worst first).
5. Register MCP tools: `log_tool_outcome({tool, success, latencyMs?, context?})`, `get_tool_profile({tool})`, `list_tool_profiles()`.
6. Add `memory_status()`: returns `{working: N keys, episodic: N rows, affective: N tools}`.

**Verify:** Log 10 outcomes for two tools (one reliable, one flaky). Call `list_tool_profiles()` and confirm the flaky one sorts first.

---

### Phase 4: Configuration and installation docs

**Goal:** Configurable DB path, `claude mcp add` snippet, and a `CLAUDE.md` snippet the user can paste into projects.

**Files:**
- `src/config.ts` — reads `DOKORO_DB_PATH` (default `~/.claude/dokoro.db`)
- `README.md` — install command, tool list, `CLAUDE.md` snippet

**CLAUDE.md snippet to paste into projects:**
```
## Memory
Use MCP tools mcp__dokoro__* to persist context across sessions:
- `remember_working` / `recall_working` for current-session state
- `log_episode` at the end of each session with a 2-3 sentence summary
- `log_tool_outcome` after each tool call that succeeds or times out
- `list_tool_profiles` at session start to check for unreliable tools in this repo
```

**Verify:** Install from npm (`npx -y dokoro`). Add the `CLAUDE.md` snippet to a project. Run a session, call `log_episode`, restart Claude Code, and confirm `search_episodes` finds it.

---

## Estimated Effort

About 1.5-2 Claude Code sessions.
- **Session 1 (≈ 2.5 h):** Phases 1-3. Scaffold, all three layers, tests.
- **Session 2 (≈ 1 h):** Phase 4 + stretch. Config, README, optional LanceDB vector search for semantic layer.

## Potential Blockers

- **FTS5 availability:** `better-sqlite3` bundles SQLite but FTS5 may need to be compiled in. Verify with `CREATE VIRTUAL TABLE t USING fts5(x)` at startup; fall back to `LIKE`-based search if it fails.
- **p95 latency SQL:** The percentile query assumes `latency_ms` is never NULL. Guard with `WHERE latency_ms IS NOT NULL`.
- **Working layer reset:** The working layer is in-memory and resets when the MCP server restarts (e.g., on Claude Code restart). Document this; if persistence is needed, store in a `working` table with a `session_id` column.
- **Tool name normalisation:** Tool names from Claude Code may include `mcp__server__` prefixes. Strip them before storing so profiles aggregate correctly: `tool.replace(/^mcp__[^_]+__/, '')`.

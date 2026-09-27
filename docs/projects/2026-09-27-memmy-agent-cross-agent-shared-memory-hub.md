# memmy-agent — One Memory Hub for Every Agent You Run

**Source:** <https://github.com/MemTensor/memmy-agent>
**Discovered:** 2026-09-27
**Viability:** 4/4

> Switch from Claude Code to Codex mid-task and each agent starts cold. No prior decisions, no established patterns, no memory of the codebase you've been discussing. memmy-agent closes that gap by exposing a single OpenAI-compatible `/memory` endpoint that any agent can read and write. The build is a local Node.js service with a structured key-value store and a thin MCP adapter.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

**Weekend-buildable (1):** A minimal version is a SQLite store + an OpenAI-compatible `/memory` REST API + a Claude Code MCP adapter that reads and writes to it. No desktop UI, no system tray, no Relay feature. Achievable in one session.

**Fills a gap (1):** Claude Code, Codex, OpenClaw, and Hermes each have their own memory mechanisms (Claude's own `/memory`, Codex's workspace context) and none of them share state. If you use more than one agent — even switching between Claude Code sessions on different machines — memory fragments. memmy-agent is the only open-source project in this lane that targets the multi-agent case rather than improving one agent's own memory.

**Novel (1):** Prior-art searches (`cross-agent shared memory`, `multi-agent memory hub openai compatible`, `claude code codex shared context`) returned `hindsight` (32k★, single-agent focus), `letta` (the former MemGPT, framework-level), and a collection of `~/.claude/CLAUDE.md` pattern repos. None targets the "run three different agent CLIs on the same project" scenario with a shared endpoint.

**Daily utility (1):** Used every time you switch tools, open a new Claude Code session in a fresh container, or let the nightly discovery run pick up context from the previous day's interactive session.

---

## Implementation Plan

### Overview

memmy-agent is a local service with three layers:

1. **Store** — SQLite table `memories(id, agent, key, value, ts, tags)`. Agents write structured facts; the store returns them on query.
2. **REST API** — an OpenAI-compatible `/v1/memory` endpoint plus a standard `/v1/chat/completions` shim that injects the most-relevant memories as a system message prefix before every completion.
3. **MCP adapter** — exposes `memory_read` and `memory_write` tools so Claude Code can use memmy as an MCP server without any API call.

The upstream project ships a desktop app, a system tray, a "Relay" feature, and deep OpenClaw integration. None of that is in Phase 1.

### Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (Node ≥22) | upstream is TS; MCP SDK is first-party TS |
| Store | SQLite via `better-sqlite3` | zero-dep, synchronous, survives process restarts |
| REST | Express or Fastify | thin HTTP layer; 3 routes total in MVP |
| MCP adapter | `@modelcontextprotocol/sdk` | official SDK; `memory_read`/`memory_write` tool definitions in 60 lines |
| Config | `~/.memmy/config.json` | port, store path, max memories per query |
| CLI | `memmy start`, `memmy list`, `memmy clear` | npm global install; no daemon/systemd in Phase 1 |

### MVP Scope

**In:**

1. `store.ts`: `upsert(agent, key, value, tags[])`, `query(q: string, limit: number)` (full-text search via SQLite FTS5), `list(agent?)`, `delete(key)`.
2. `api.ts`: three routes — `POST /v1/memory` (write), `GET /v1/memory?q=&limit=` (read), `DELETE /v1/memory/:key`. Plus `POST /v1/chat/completions` shim that prepends the top-5 query results as a system message and proxies the rest to any downstream LLM.
3. `mcp.ts`: MCP server exposing `memory_read(query: string)` → `{memories: [{key, value, agent, ts}]}` and `memory_write(key: string, value: string, tags: string[])` → `{ok: true}`.
4. `cli.ts`: `memmy start` (boots store + API + MCP), `memmy list [--agent]`, `memmy clear`.
5. Claude Code config snippet in README: add memmy as an MCP server in `~/.claude/settings.json`.

**Out of v1:** Relay (context handoff between agents), desktop UI, systemd service, embeddings-based semantic search (FTS5 covers the MVP), multi-machine sync.

### Phases

**Phase 1 — Store and REST API (2 h).** SQLite store with FTS5, three REST routes, `memmy start`. Verify by writing a memory via `curl` and reading it back.

**Phase 2 — MCP adapter (1.5 h).** `mcp.ts` with `memory_read` and `memory_write` tools. Add the MCP server config to Claude Code's settings. Verify by running a Claude Code session, writing a memory via the tool, starting a new session, and reading it back.

**Phase 3 — Completions shim (1 h).** `POST /v1/chat/completions` proxies to a downstream LLM (configurable: local oMLX, OpenAI, Anthropic) but prepends the top-5 relevant memories as a system message. This is the path for Codex and OpenClaw, which speak OpenAI completions rather than MCP.

**Phase 4 — Multi-agent tagging and filtering (30 min).** Add an `agent` tag to every memory write. Add `?agent=claude-code` to the query endpoint. Allows "show only memories from this session's Claude Code instance" without mixing in Codex notes.

**Phase 5 — Relay (1 h).** `POST /v1/relay` accepts a `{ from_agent, to_agent, context_summary }` payload, writes it as a structured memory with a `relay` tag, and optionally opens a named pipe or webhook to notify the target agent. This is the feature that makes context handoff explicit rather than just shared storage.

**Total effort:** 5–6 hours. Phase 1 + 2 (3.5 h) give a working MCP memory server for Claude Code. Phase 3 (1 h more) opens it to any OpenAI-compatible agent.

### Blockers and Known Ceilings

- **Memory relevance without embeddings.** FTS5 full-text search works for exact-word queries but misses semantic similarity ("database connection" won't match a memory written as "Postgres credentials"). Phase 1 ships with FTS5 and a clear path to replacing it with local embeddings (via `@xenova/transformers` or an oMLX embedding model) without changing the API surface.
- **Memory size and noise accumulate.** Without a TTL or a max-memories-per-agent limit, the store will fill with stale context. Phase 4 should add `created_at` and a default 30-day TTL, honouring `cleanupPeriodDays` if it mirrors the Claude Code setting.
- **MCP tool calls are opt-in.** Claude Code will only use `memory_read`/`memory_write` if the agent explicitly decides to call them. The real value appears when the MCP server is wired into a `UserPromptSubmit` hook that auto-reads relevant memories before every turn — that is a one-file addition after Phase 2.
- **Cross-machine sync is out of scope.** The upstream ships a cloud option; the MVP is local-only. If you run Claude Code sessions on multiple machines (e.g. remote cloud sessions), memories written on one will not appear on the other until a sync mechanism is added.

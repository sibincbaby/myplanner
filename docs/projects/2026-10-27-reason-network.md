# reason-network — MCP server for agent-to-agent coordination

**Source:** <https://github.com/reason-machines/reason-network>
**Discovered:** 2026-10-27
**Viability:** 3/4

> Fills a real gap in the user's multi-agent toolkit. The user runs multiple Claude Code sessions on the same repo — there's no built-in coordination layer between them. An MCP server for message-passing and shared context is a well-scoped weekend build with no exotic infrastructure.

## Viability Scores

| Criterion | Score | Reasoning |
|-----------|-------|-----------|
| Weekend-buildable | ✅ 1 | MCP protocol is documented; Node.js/Python MCP SDKs exist; MVP (register agents, send messages, share context blobs) is achievable in 1-2 Claude Code sessions with SQLite for persistence |
| Fills gap | ✅ 1 | User runs multiple Claude Code sessions on the same repo with no built-in coordination layer between them |
| Novel | ✅ 1 | MCP ecosystem for agent-to-agent communication is still nascent; no dominant well-maintained open-source alternative yet |
| Daily utility | ❌ 0 | Multi-agent coordination is situational, not constant — reached for during parallel work sessions, not every session |

**Total: 3/4 — Viable**

---

## Overview

A local MCP server that acts as a coordination layer between multiple Claude Code sessions (or other MCP-compatible agents) running against the same repo or organization. Agents connect to a shared server process, register themselves, post messages to named inboxes, and read/write shared context blobs. The server holds state in SQLite so messages and context survive restarts. Each Claude Code session adds the server to its MCP config and gains tools to coordinate with peer sessions.

---

## Stack Recommendation

- **Runtime:** Node.js 20+ with TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk` (official, npm) — handles transport, tool registration, and schema validation
- **Transport:** HTTP+SSE for a persistent daemon — one shared server process serves all agents simultaneously
- **Persistence:** `better-sqlite3` — zero-config, synchronous API, no separate process
- **Schema validation:** `zod` (already pulled in by MCP SDK)
- **Dev tooling:** `tsx` for running TypeScript directly, `vitest` for tests

---

## MVP Scope

Six MCP tools exposed to every connected agent:

| Tool | What it does |
|---|---|
| `register_agent` | Announces an agent with a name and optional metadata |
| `list_agents` | Returns all currently registered agents |
| `send_message` | Posts a message to another agent's inbox |
| `read_messages` | Reads (and optionally clears) messages from own inbox |
| `share_context` | Writes a named context blob (JSON or text) |
| `read_context` | Reads a named context blob |

No auth, no distributed state, no real-time push — polling is fine for a local MVP.

---

## Implementation Phases

### Phase 1: Project Scaffold and Minimal MCP Server

**Goal:** A TypeScript MCP server starts over HTTP+SSE, declares one no-op ping tool, and the MCP inspector can connect and call it.

**Files to create/modify:**
- `package.json` — project manifest with scripts
- `tsconfig.json` — strict TypeScript config targeting Node 20
- `src/server.ts` — entry point, creates and starts the MCP server
- `src/tools/ping.ts` — minimal tool returning `{ pong: true }`
- `.gitignore` — node_modules, dist, *.db

**Key steps:**
1. Run `npm init -y` then install deps: `npm install @modelcontextprotocol/sdk better-sqlite3 zod` and dev deps: `npm install -D typescript tsx vitest @types/node @types/better-sqlite3`
2. Write `tsconfig.json` with `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`, `"strict": true`, `"outDir": "dist"`
3. In `src/server.ts`, import `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` and `SSEServerTransport` from `@modelcontextprotocol/sdk/server/sse.js`; create an `http.createServer` that mounts the SSE transport at `GET /sse` and the POST handler at `POST /messages`; listen on `PORT` env var defaulting to `3737`
4. Register the ping tool using `server.tool('ping', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify({ pong: true }) }] }))`
5. Add `"start": "tsx src/server.ts"` to package.json scripts

**Verify:** `npm start` in one terminal; in another run `npx @modelcontextprotocol/inspector http://localhost:3737/sse` — inspector connects and calling `ping` returns `{ pong: true }`

---

### Phase 2: SQLite Schema and Agent Registry

**Goal:** Agents can register with a name and be listed; registrations persist in SQLite across server restarts.

**Files to create/modify:**
- `src/db.ts` — opens `reason-network.db`, runs migrations, exports `db` singleton
- `src/tools/register_agent.ts` — upserts a row in `agents`
- `src/tools/list_agents.ts` — selects all rows from `agents`
- `src/server.ts` — import and register the two new tools

**Key steps:**
1. In `src/db.ts`, call `better-sqlite3('reason-network.db')` and run `db.exec(schema)` on startup; schema creates: `agents(id TEXT PRIMARY KEY, name TEXT, metadata TEXT, registered_at INTEGER)`, `messages(id INTEGER PRIMARY KEY AUTOINCREMENT, to_agent TEXT, from_agent TEXT, body TEXT, created_at INTEGER, read INTEGER DEFAULT 0)`, `context_blobs(key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)`
2. `register_agent` input schema (via zod): `{ agent_id: z.string(), name: z.string(), metadata: z.record(z.string()).optional() }`; run `INSERT OR REPLACE INTO agents VALUES (...)` with `Date.now()` as timestamp
3. `list_agents` takes no input; returns all agent rows as JSON array in the MCP text content
4. Wire both tools in `server.ts` by importing and calling each tool's `register(server)` function

**Verify:** Start server, use inspector to call `register_agent` with `{ agent_id: "session-1", name: "Refactor Agent" }`, then call `list_agents` — the agent appears. Stop and restart server, call `list_agents` again — agent still appears.

---

### Phase 3: Message Passing

**Goal:** Agent A can send a message to Agent B's inbox; Agent B can poll and read its messages.

**Files to create/modify:**
- `src/tools/send_message.ts` — inserts a row into `messages`
- `src/tools/read_messages.ts` — selects unread messages for the caller, marks them read

**Key steps:**
1. `send_message` input schema: `{ from_agent: z.string(), to_agent: z.string(), body: z.string() }`; insert into `messages` with `read = 0` and `created_at = Date.now()`; return `{ message_id: lastInsertRowid }`
2. `read_messages` input schema: `{ agent_id: z.string(), mark_read: z.boolean().default(true) }`; select all rows where `to_agent = agent_id AND read = 0` ordered by `created_at ASC`; if `mark_read` is true, run `UPDATE messages SET read = 1 WHERE to_agent = ? AND read = 0`; return the messages array as JSON
3. Add optional `clear_after_read` boolean to `read_messages` that DELETEs rows instead of marking them read — useful to keep the DB small in long sessions
4. Register both tools in `server.ts`

**Verify:** In inspector, call `register_agent` for two agents. Call `send_message` from `session-1` to `session-2`. Call `read_messages` with `agent_id: "session-2"` — message appears. Call again — inbox is empty.

---

### Phase 4: Shared Context Store

**Goal:** Agents can write and read named context blobs (summaries, task lists, file diffs) accessible to all agents on the server.

**Files to create/modify:**
- `src/tools/share_context.ts` — upserts a row in `context_blobs`
- `src/tools/read_context.ts` — reads a row by key
- `src/tools/list_context_keys.ts` — lists all keys with timestamps

**Key steps:**
1. `share_context` input schema: `{ key: z.string(), value: z.string(), description: z.string().optional() }`; run `INSERT OR REPLACE INTO context_blobs(key, value, description, updated_at) VALUES (...)`; return `{ key, updated_at }`
2. `read_context` input schema: `{ key: z.string() }`; select the row, return `{ key, value, description, updated_at }` or an error object if not found
3. `list_context_keys` takes no input; runs `SELECT key, description, updated_at FROM context_blobs ORDER BY updated_at DESC`; returns array
4. Add `description TEXT` column: check `PRAGMA table_info(context_blobs)` and run `ALTER TABLE` if needed

**Verify:** Call `share_context` with key `"auth-module-plan"`. Call `list_context_keys` — key appears. Call `read_context` — full value returned. Restart server, call again — value persisted.

---

### Phase 5: Claude Code Integration and Developer Config

**Goal:** Two real Claude Code sessions on the same machine can coordinate through the server using a documented setup.

**Files to create/modify:**
- `README.md` — setup instructions, tool reference, example agent prompts
- `mcp-config-example.json` — drop-in MCP config snippet for `.claude/claude_mcp_config.json`
- `src/server.ts` — graceful shutdown, startup log showing all registered tools
- `scripts/start-daemon.sh` — starts server in background, writes PID to `.reason-network.pid`
- `src/__tests__/tools.test.ts` — integration tests covering all six tools against an in-memory DB

**Key steps:**
1. Add startup log: after server listens, print `Reason Network MCP server running on http://localhost:${PORT}/sse` and list all registered tool names
2. Write `mcp-config-example.json`: `{ "mcpServers": { "reason-network": { "url": "http://localhost:3737/sse" } } }`
3. Write `scripts/start-daemon.sh`: `tsx src/server.ts &` then `echo $! > .reason-network.pid`; add companion `stop-daemon.sh`
4. In tests, pass `:memory:` as the DB path via `DB_PATH` env var; export a `createServer()` factory that accepts a db instance
5. Add `"test": "vitest run"` and `"build": "tsc"` to package.json scripts

**Verify:** Run `bash scripts/start-daemon.sh`. Open two Claude Code sessions. In session 1's MCP config add the reason-network entry, run `/mcp` to confirm. Call `send_message` from session 1 to session 2. Call `read_messages` in session 2 — message received.

---

## Estimated Effort

**2 Claude Code sessions**

- **Session 1** (Phases 1–3): Scaffold, SQLite schema, agent registry, message passing — roughly 3 hours.
- **Session 2** (Phases 4–5): Context store, Claude Code integration config, daemon scripts, test suite — roughly 2 hours.

---

## Potential Blockers

- **HTTP+SSE transport vs stdio:** The MCP SDK's SSE transport requires careful handling of the POST endpoint path — the client sends messages to a URL returned in the SSE `endpoint` event. If this causes issues, fall back to stdio transport with a wrapper script.
- **MCP SDK version churn:** Pin to a specific version (e.g. `"@modelcontextprotocol/sdk": "1.0.4"`) — the `SSEServerTransport` constructor signature changed in 1.0.
- **Claude Code MCP config location:** Decide whether to add the server globally (`~/.claude/claude_mcp_config.json`) or per-project. Example config should cover both cases.
- **Port conflicts:** Add explicit error handling on `EADDRINUSE` with a message suggesting `PORT=3738 npm start`.
- **SQLite write contention:** `better-sqlite3` is synchronous and single-writer. Node.js event loop serializes all DB calls — fine for local MVP but would break under real concurrent load.

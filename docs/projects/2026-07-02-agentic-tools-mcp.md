# Agentic Tools MCP — Hierarchical Task Manager + Semantic Memory for Claude

**Inspired by:** [github.com/Pimzino/agentic-tools-mcp](https://github.com/Pimzino/agentic-tools-mcp)  
**Source:** GitHub Search / MCP tools (v1.8.0, 86 stars)  
**Interest score:** 4/4 (Claude/LLM tooling + MCP + dev productivity + daily task use)

## What It Is

An MCP server that gives Claude Code (or any MCP client) a structured task manager and a semantic memory store — persisted as JSON files in a `.agentic-tools-mcp/` directory inside each project. Tasks support unlimited nesting, priority (1–10), complexity estimates, dependencies, tags, and time tracking. The memory store lets Claude recall arbitrary snippets by semantic keyword search.

## Why Build Your Own

The published package works great for basic use, but rolling your own means: you control the storage backend (swap to SQLite for large projects), you add webhook/push events when tasks change (Slack, email), you can plug in actual embedding search (SQLite-vss or pgvector) instead of title/keyword matching, and you integrate directly with your existing planner schema. Buildable in one session.

## Stack Recommendation

- **TypeScript + Node.js** — same stack as the reference project
- **@modelcontextprotocol/sdk** — MCP server framework
- **Zod** — schema validation for all tool inputs
- **SQLite via `better-sqlite3`** — more robust than JSON files for large task sets
- **Bun** — fast dev server and test runner

## MVP Scope

MCP server exposing four tools: `create_task`, `list_tasks`, `update_task`, `add_memory` + `search_memory`. Tasks stored in SQLite with parent_id for nesting. Memory stored as plain text rows with `LIKE` search. Works inside Claude Code immediately after `npx install`.

---

## Implementation Phases

### Phase 1 — MCP Server Skeleton + Task CRUD
**Goal:** An MCP server with create/list/update/delete task tools backed by SQLite.

**Files:**
- `src/index.ts` — MCP server entry point, tool registration
- `src/db.ts` — `better-sqlite3` setup, `tasks` table migration
- `src/tools/tasks.ts` — `create_task`, `list_tasks`, `update_task`, `delete_task` implementations

**Schema:**
```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES tasks(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  complexity TEXT,
  tags TEXT,       -- JSON array
  due_date TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

**Key steps:**
1. `bun init && bun add @modelcontextprotocol/sdk better-sqlite3 zod`
2. Create `McpServer` instance, register four task tools with Zod input schemas
3. Each tool handler runs a prepared SQL statement and returns JSON
4. `list_tasks` accepts optional `parent_id` and `status` filters
5. Wire to stdio transport: `server.connect(new StdioServerTransport())`

**Verify:** Add to Claude Code `mcp.json`, ask Claude "create a task called Build landing page with priority 8", check that `tasks.db` contains the row.

---

### Phase 2 — Nested Tasks + Dependency Tracking
**Goal:** Tasks can have subtasks; blocking dependencies are enforced.

**Files:**
- Updated `src/tools/tasks.ts` — `list_tasks` returns tree structure
- `src/db.ts` — add `task_deps` junction table

**Key steps:**
1. Add `task_deps (task_id, depends_on_id)` table
2. `list_tasks` recurses over `parent_id` to build a tree; include `blocked: true` if any dependency is incomplete
3. Add `add_dependency` and `remove_dependency` tools
4. `update_task` to `completed` auto-checks if dependencies are clear first

**Verify:** Create task A → create task B depends on A → Claude tries to complete B → gets error "blocked by A".

---

### Phase 3 — Semantic Memory Store
**Goal:** Claude can store and retrieve knowledge snippets across sessions.

**Files:**
- `src/db.ts` — add `memories` table
- `src/tools/memory.ts` — `add_memory`, `search_memory`, `delete_memory`

**Schema:**
```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,
  project TEXT,
  created_at TEXT
);
CREATE VIRTUAL TABLE memories_fts USING fts5(title, content, content='memories');
```

**Key steps:**
1. Use SQLite FTS5 for full-text search over `title + content`
2. `add_memory(title, content, tags?, project?)` inserts and updates FTS index
3. `search_memory(query)` runs `memories_fts MATCH ?` ranked by BM25
4. Return top-5 matches with snippet highlights

**Verify:** Ask Claude to "remember that the Stripe webhook secret is stored in .env.local as STRIPE_WEBHOOK_SECRET". Later: "where is the Stripe webhook secret?" → Claude finds the memory.

---

### Phase 4 — VS Code Extension Panel
**Goal:** Visual task board and memory browser inside VS Code without leaving the editor.

**Files:**
- `vscode-extension/src/extension.ts` — activates WebviewPanel
- `vscode-extension/src/webview/TaskBoard.tsx` — React kanban board

**Key steps:**
1. `yo code` to scaffold a new VS Code extension
2. `WebviewPanel` reads `tasks.db` via a Node child process (or direct `better-sqlite3`)
3. Render tasks as columns: Pending → In Progress → Blocked → Done
4. Drag-and-drop updates `status` via `vscode.postMessage` → extension → SQLite write

**Verify:** Open VS Code task board, drag "Build landing page" to In Progress — status updates in DB and Claude Code sees the change on next query.

---

### Phase 5 — Slack / Webhook Notifications
**Goal:** Notify when high-priority tasks are created or blocked.

**Files:**
- `src/notifiers/slack.ts` — `IncomingWebhook` from `@slack/webhook`
- Updated `src/tools/tasks.ts` — call notifier on create/block events

**Key steps:**
1. Add `SLACK_WEBHOOK_URL` to `.env`
2. On `create_task` with priority >= 8: post to Slack "#tasks" channel
3. On any task becoming `blocked`: post with blocker list
4. Rate-limit to max 1 message per task per hour via a `last_notified_at` column

**Verify:** Ask Claude "create a critical priority 10 task called Ship v2.0" — Slack notification appears within 2 seconds.

---

## Estimated Effort

**1 Claude session.** Phases 1–3 take ~2 hours and produce a fully functional MCP with task + memory tools. Phase 4 adds ~1 hour. Phase 5 is 30 min.

## Potential Blockers

- **MCP protocol version**: pin `@modelcontextprotocol/sdk` to the version supported by your Claude Code release to avoid handshake failures
- **SQLite on Windows**: `better-sqlite3` needs native bindings — use `bun` which bundles them, or pre-build with `node-pre-gyp`
- **FTS5 availability**: ensure your SQLite build includes FTS5 (it's default in Node.js `better-sqlite3`)
- **File locking**: if VS Code extension and Claude Code both write to `tasks.db` simultaneously, use WAL mode (`PRAGMA journal_mode=WAL`) to prevent lock errors

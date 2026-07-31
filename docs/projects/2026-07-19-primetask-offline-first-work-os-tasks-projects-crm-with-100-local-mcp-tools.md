# PrimeTask — offline-first work OS (tasks/projects/CRM) with 100+ local MCP tools

**Source:** <https://www.primetask.app/>
**Discovered:** 2026-07-19
**Viability:** 3/4

> Validates the 'app as MCP tool surface, BYO-LLM brain' architecture for personal productivity — the same pattern as the user's calstakk/Super-Productivity-MCP interests. Not open source, so the value is as a design reference for an open cross-platform (Flutter/Nuxt) equivalent Claude could build.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

PrimeTask itself is a large proprietary macOS suite, but the buildable essence — a local-first SQLite task/project store exposed as an MCP server so Claude becomes the operator ("you pick the brain, we supply the hands") — is a clean 1-2 session MVP (schema + CRUD/query/plan MCP tools + a thin Nuxt or CLI view). weekend_buildable: 1 if scoped to the local store + MCP tool surface; 0 if attempting the full tasks/CRM/calendar/canvas suite. fills_gap: 1 because the user's toolkit is heavy on agent UIs and Claude wrappers but shows no Claude-operated personal task/project system of record (myplanner is a discovery/ideas pipeline, not a planner app); 0 only if an equivalent hidden tool exists. novel: 0 because MCP task-management servers are now commonplace (Todoist MCP, taskwarrior MCP, Obsidian MCP) and mature open-source task managers abound — the truly novel parts (integrated CRM/canvas/automations) are exactly what falls outside a weekend MVP; 1 would require the integrated local work-OS angle to be the MVP. daily_utility: 1 since task/project planning is a daily-touch workflow and pairs naturally with the user's existing Claude-driven routines; 0 if they would revert to existing tools after novelty wears off — mitigated because Claude operating it lowers friction to near zero. Total 3, viable.

---

## Implementation Plan

## Overview

Build **opentask-mcp** — an open, cross-platform distillation of PrimeTask's core idea: a local-first SQLite system-of-record for tasks/projects/contacts, exposed as an MCP server so Claude is the operator ("you pick the brain, we supply the hands"). No GUI-first suite; the MCP tool surface *is* the product, with a thin CLI for human glanceability. Lives at `~/my-works/opentask-mcp`.

## Stack Recommendation

- **Runtime:** Node.js 20+ / TypeScript (matches user's existing MCP/CLI tooling patterns)
- **MCP:** `@modelcontextprotocol/sdk` (`McpServer` + `StdioServerTransport`)
- **DB:** `better-sqlite3` (synchronous, zero-config, WAL mode for CLI+server co-access)
- **Validation:** `zod` (tool input schemas, doubles as runtime validation)
- **CLI:** `commander` + `cli-table3`
- **Tests:** `vitest`
- **Deferred:** Nuxt 4 dashboard (Phase 5, optional)

## MVP Scope

**In:** projects, tasks (status/priority/due/tags/subtask parent), contacts (light CRM), task↔contact links, activity log; ~18 MCP tools covering CRUD, query/search, `plan_day`, `weekly_review`, bulk ops; `ot` CLI with `today`/`list`/`show`.
**Out:** calendar sync, visual canvas, automations engine, focus modes, recurring tasks, any GUI beyond read-only views.

## Implementation Phases

### Phase 1: Scaffold + SQLite data layer
**Goal:** A tested repository layer over a migrated SQLite database with all core entities.
**Files to create/modify:**
- `package.json` — deps: `@modelcontextprotocol/sdk`, `better-sqlite3`, `zod`, `commander`, `cli-table3`; devDeps: `typescript`, `tsx`, `vitest`, `@types/better-sqlite3`; scripts: `build`, `test`, `serve` (`tsx src/server.ts`), `cli`
- `tsconfig.json` — NodeNext, strict, outDir `dist`
- `src/db.ts` — opens DB at `$OPENTASK_DB` or `~/.opentask/opentask.db`, sets `journal_mode=WAL`, `foreign_keys=ON`, runs migrations via `user_version` pragma
- `src/migrations.ts` — migration 1: `projects(id, name, status, description, created_at, updated_at)`, `tasks(id, project_id FK, parent_id FK, title, notes, status CHECK(status IN ('inbox','todo','doing','done','dropped')), priority INT, due_date, tags TEXT/*json*/, created_at, updated_at, completed_at)`, `contacts(id, name, email, company, notes, last_touch, created_at)`, `task_contacts(task_id, contact_id)`, `activity_log(id, entity_type, entity_id, action, detail, at)`
- `src/repo.ts` — typed functions: `createTask`, `updateTask`, `listTasks(filters)`, `searchTasks(text)` (LIKE over title+notes), same trio for projects/contacts, `linkContact`, `logActivity`; every mutation writes `activity_log`
- `src/types.ts` — `Task`, `Project`, `Contact` interfaces + zod schemas
- `tests/repo.test.ts` — CRUD, filter, cascade, activity-log assertions against in-memory DB (`new Database(':memory:')`)
**Key steps:**
1. `npm init -y && npm i @modelcontextprotocol/sdk better-sqlite3 zod commander cli-table3 && npm i -D typescript tsx vitest @types/better-sqlite3`
2. Write migrations with `PRAGMA user_version` gating so future schema changes are additive
3. Implement repo functions returning plain typed objects (parse `tags` JSON on read); dates stored as ISO strings
4. Write vitest suite using `:memory:` DB via an injectable `db` handle in `db.ts` (`getDb(path?)`)
**Verify:** `npx vitest run` — all repo tests green; `node -e "require('./dist/db.js')"` after `npm run build` creates `~/.opentask/opentask.db` with tables (`sqlite3 ~/.opentask/opentask.db .tables`).

### Phase 2: MCP server with CRUD/query tools
**Goal:** Claude can create, update, list, and search tasks/projects/contacts through a running stdio MCP server.
**Files to create/modify:**
- `src/server.ts` — `McpServer({name:'opentask'})` + `StdioServerTransport`, imports tool registrars
- `src/tools/tasks.ts` — `create_task`, `update_task`, `complete_task`, `list_tasks` (filters: status, project, tag, due_before, overdue), `search_tasks`, `get_task` (includes subtasks + linked contacts)
- `src/tools/projects.ts` — `create_project`, `update_project`, `list_projects` (with open-task counts)
- `src/tools/contacts.ts` — `create_contact`, `update_contact`, `list_contacts`, `link_contact_to_task`, `touch_contact` (bumps `last_touch`)
**Key steps:**
1. Register each tool with `server.registerTool(name, {description, inputSchema: zodShape}, handler)`; handlers call repo, return `{content:[{type:'text', text: JSON.stringify(result, null, 2)}]}`
2. Write rich tool descriptions (these are the "API docs" the LLM reads — include enum values and examples)
3. Add top-level error wrapper so repo/zod errors return `isError: true` with a readable message instead of crashing the transport
4. Keep stdout clean — all logging to stderr (stdio transport requirement)
**Verify:** `npx @modelcontextprotocol/inspector tsx src/server.ts` — list tools, call `create_task` then `list_tasks`, see the task echoed back.

### Phase 3: Planning & workflow tools (the PrimeTask essence)
**Goal:** Claude can run daily planning and weekly review as first-class operations, not just CRUD.
**Files to create/modify:**
- `src/tools/planning.ts` — `plan_day` (returns structured bundle: overdue, due today, in-progress, top-priority inbox, stale `doing` >3 days), `set_today` / `get_today` (a `today_list(date, task_id, rank)` table, migration 2), `weekly_review` (completed this week, slipped due dates, untouched projects, contacts with `last_touch` > 14 days), `bulk_update_tasks` (ids[] + patch), `reschedule` (id, new due date, logs reason)
- `src/migrations.ts` — migration 2: `today_list` table
- `tests/planning.test.ts` — seed fixture data, assert `plan_day` buckets and `weekly_review` sections
**Key steps:**
1. Implement `plan_day` as pure SQL queries composed into one JSON payload — one tool call gives Claude everything needed to propose a day plan
2. `set_today` replaces the ranked list for a date atomically (transaction)
3. `weekly_review` computes date windows in SQL (`date('now','-7 days')`)
4. Add `daily_utility` glue: tool descriptions instruct the model to call `plan_day` → converse → `set_today`
**Verify:** `npx vitest run` green, then via inspector: seed 5 tasks with mixed due dates, call `plan_day`, confirm correct bucketing.

### Phase 4: CLI view + register with Claude Code
**Goal:** `ot today` shows the human a readable board, and the MCP server is registered so any Claude Code session can operate the store.
**Files to create/modify:**
- `src/cli.ts` — commander program: `ot today` (today list + overdue table), `ot list [--status --project]`, `ot show <id>`, `ot projects`; bin entry `"ot": "dist/cli.js"` in `package.json`
- `README.md` — schema diagram, tool catalog table, registration instructions
- `~/.claude/CLAUDE.md` or project docs — *do not modify*; instead print the registration command in README
**Key steps:**
1. Build CLI as read-mostly (writes go through Claude/MCP by design); render with `cli-table3`
2. `npm run build && npm link` so `ot` is on PATH
3. Register globally: `claude mcp add opentask --scope user -- node /home/sibin/my-works/opentask-mcp/dist/server.js`
4. End-to-end: in a fresh Claude Code session, prompt "add a project 'opentask launch' with 3 tasks, plan my day" and confirm rows via `ot today`
**Verify:** `claude mcp list` shows `opentask` connected; `ot today` displays the tasks Claude created.

### Phase 5 (optional): Nuxt 4 read-only dashboard
**Goal:** A localhost board view (projects, today, CRM touch list) for visual review.
**Files to create/modify:**
- `dashboard/nuxt.config.ts` — `pages: true, srcDir: '.'`, Nitro server reading the same SQLite file via `better-sqlite3`
- `dashboard/layouts/default.vue` — `<slot />` (per user's Nuxt 4 standard)
- `dashboard/pages/index.vue` — today + overdue board
- `dashboard/pages/projects.vue`, `dashboard/pages/crm.vue` — project cards with task counts; contacts sorted by staleness
- `dashboard/server/api/{tasks,projects,contacts}.get.ts` — read-only endpoints reusing `src/repo.ts`
**Key steps:**
1. `npx nuxi init dashboard` inside the repo; import repo layer via relative path or workspace
2. Read-only: no mutation endpoints — all writes stay on the MCP surface
3. Poll every 10s or refresh-on-focus; no realtime needed
**Verify:** `cd dashboard && npm run dev` → `http://localhost:3000` shows tasks created earlier via Claude.

## Estimated Effort

**2 sessions** (3 with the optional dashboard).
- **Session 1:** Phases 1–2 — scaffold, schema, repo layer, tests, MCP server with full CRUD/query surface, inspector-verified.
- **Session 2:** Phases 3–4 — planning/review tools, CLI, `claude mcp add` registration, end-to-end "Claude plans my day" flow.
- **Session 3 (optional):** Phase 5 Nuxt dashboard.

## Potential Blockers

- **better-sqlite3 native build:** needs node-gyp toolchain; if `npm i` fails on this Linux box, fall back to `node:sqlite` (built-in from Node 22) with minor API changes in `src/db.ts` only.
- **Concurrent access:** MCP server, CLI, and Nuxt all open the same file — WAL mode + short transactions handles it, but forgetting `journal_mode=WAL` causes `SQLITE_BUSY` under simultaneous use.
- **MCP SDK API drift:** `registerTool` signatures changed across SDK 1.x versions; pin the SDK version and check the README of the installed version rather than trusting memory.
- **stdio pollution:** any `console.log` in repo/db code corrupts the JSON-RPC stream — enforce stderr-only logging from Phase 1.
- **Scope creep toward PrimeTask parity:** calendar/canvas/automations are explicitly out; if tempted, they each are their own multi-session project. The viability score depends on staying at store + tools + thin view.
- **Tool count vs. context cost:** 18 well-described tools is the ceiling for the MVP; PrimeTask's "100+ tools" would bloat every Claude session's context — resist splitting CRUD into micro-tools.

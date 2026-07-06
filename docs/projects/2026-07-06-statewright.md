# Statewright — Claude Code Phase Enforcer

**Inspired by:** [github.com/statewright/statewright](https://github.com/statewright/statewright)  
**Source:** Show HN (May 2026) — Visual state machines that make AI agents reliable  
**Interest score:** 3/4 (Claude/LLM tooling + agent UIs + dev productivity)

## What It Is

Statewright is a state machine guardrail system for AI coding agents: you define a workflow (phases like `plan → implement → test → review`) as a YAML config, and a Rust-powered MCP gateway enforces tool access per phase — read-only tools in planning, edit tools in implementation, only test commands in testing. The reference integrates with Claude Code, Codex, Cursor, and any MCP client via a hosted cloud gateway.

## Why Build Your Own

The reference needs a cloud account and their gateway. What fills a real gap is a **self-hosted, zero-dependency version** that lives entirely in your Claude Code project as a settings hook + local MCP proxy. Define your workflow once in `statewright.yaml`, and the hook refuses any tool invocation that violates the current phase. No Rust compiler, no cloud, just a TypeScript MCP server you run locally. It's also infinitely customisable: add a `paused` phase that blocks everything until you confirm, or a `dangerous` phase that requires typing `CONFIRM`.

## Stack Recommendation

- **TypeScript + `@modelcontextprotocol/sdk`** — MCP server that proxies or blocks upstream tool calls based on phase state
- **`js-yaml`** — parse the `statewright.yaml` workflow config
- **`better-sqlite3`** — persist current phase across agent restarts (single file, no setup)
- **Claude Code hooks** — `PreToolUse` hook calls the local MCP server; server returns an error if tool is not allowed in the current phase
- **`tsx` or `bun`** — zero-build local dev; ship as `npx statewright` for portability

## MVP Scope

A `statewright.yaml` that lists named phases, each with an `allowed_tools` list. A local MCP server that exposes `get_phase`, `set_phase`, and a `check_tool` validator. The Claude Code `PreToolUse` hook calls `check_tool` before any tool runs; if the tool is not in the current phase's allowlist the hook returns a blocking error message. Phase transitions happen via a terminal command (`npx statewright phase set implement`). A `statewright status` command prints current phase and allowed tools.

---

## Implementation Phases

### Phase 1 — YAML Config + Phase State
**Goal:** Parse a workflow config and persist the active phase to disk.

**Files:**
- `src/config.ts` — load and validate `statewright.yaml` (phases, allowed_tools per phase)
- `src/state.ts` — read/write current phase to `.statewright/state.db` via better-sqlite3
- `src/cli.ts` — `statewright phase set <name>`, `statewright status`

**Key steps:**
1. Define schema: `phases: [{name, allowed_tools: string[], description}]`
2. Validate on load: all tool names must be non-empty strings; no duplicate phase names
3. Store `{current_phase, updated_at}` in SQLite; fallback to first phase if unset
4. `status` command prints phase name, allowed tools, and time since last transition

**Verify:** `statewright phase set plan` → `statewright status` reports `plan` with the correct tool list.

---

### Phase 2 — MCP Server with check_tool
**Goal:** Expose phase state over MCP so Claude Code can query it.

**Files:**
- `src/server.ts` — MCP server with `get_phase`, `set_phase`, `check_tool(tool_name)` tools
- `src/index.ts` — entry point; start server via stdio

**Key steps:**
1. `get_phase` → returns `{phase, allowed_tools}`
2. `set_phase(name)` → validates name exists in config, persists; returns new phase
3. `check_tool(tool_name)` → returns `{allowed: bool, reason: string}` — the reason becomes the hook error
4. Start server with `npx statewright serve` on stdio (no HTTP, no port)

**Verify:** Run `npx statewright serve`, send MCP `check_tool("Edit")` in plan phase → `{allowed: false, reason: "Edit not permitted in 'plan' phase. Allowed: Read, Glob, Grep"}`.

---

### Phase 3 — Claude Code PreToolUse Hook
**Goal:** Block disallowed tool calls before they execute.

**Files:**
- `.claude/hooks/pre-tool-use.sh` — hook that queries the local MCP server
- `src/hook-client.ts` — tiny script that calls `check_tool` via stdio MCP and exits non-zero on block

**Key steps:**
1. Hook receives `CLAUDE_TOOL_NAME` env var from Claude Code
2. Pipe an MCP `check_tool` request to the running server process and parse the JSON response
3. If `allowed: false`, print the reason to stderr and exit 1 — Claude Code surfaces this to the agent as an error, aborting the tool call
4. Keep hook latency under 50ms: reuse a persistent server process via a named pipe or Unix socket

**Verify:** In Claude Code with phase=plan, attempt a file Edit → agent receives "Edit not permitted in 'plan' phase" error and cannot proceed.

---

### Phase 4 — Built-In Default Workflows
**Goal:** Provide a ready-to-use workflow config for a typical coding session.

**Files:**
- `templates/coding-workflow.yaml` — plan → implement → test → review → done
- `README.md` — copy-paste quickstart

**Coding workflow tool sets:**
- `plan`: Read, Glob, Grep, WebSearch — explore only
- `implement`: Read, Edit, Write, Glob, Grep, Bash (non-destructive) — build
- `test`: Read, Bash — run tests only
- `review`: Read, Glob, Grep, mcp__github__* — read + PR tools
- `done`: none (all blocked) — archive/complete state

**Verify:** Run through a real task — agent cannot edit in plan phase, cannot WebSearch in test phase, and cannot Edit in review phase.

---

### Phase 5 — Dashboard TUI
**Goal:** See phase, recent transitions, and blocked attempts in a live terminal view.

**Files:**
- `src/tui.ts` — `ink`-based React terminal UI showing phase timeline and last N blocked tool calls

**Key steps:**
1. Log blocked calls to SQLite with `{tool_name, phase, timestamp}`
2. TUI polls the DB every 500ms; renders a phase progress bar + block log
3. Hotkeys: `n` → advance to next phase; `r` → reset to first phase

**Verify:** In the TUI, attempt a disallowed tool in Claude Code → the block appears in the log within 1 second.

---

## Estimated Effort

**1.5 Claude sessions.** Phase 1+2 (config + MCP server) are ~2 hours and deliver a working validator. Phase 3 (the hook) is the critical integration step — ~1 hour, mostly testing the edge cases. Phase 4 (default workflows) is 30 min of config writing. Phase 5 (TUI) is optional polish, ~1.5 hours.

## Potential Blockers

- **Hook latency**: the `PreToolUse` hook runs on every tool call. A slow IPC round-trip makes the agent feel sluggish. Use a persistent daemon with a Unix socket rather than spawning a new process per hook invocation.
- **MCP server restart on phase change**: if the agent restarts the MCP server mid-session it loses phase state — persist phase to SQLite, not in-memory.
- **Tool name collisions**: Claude Code tool names include `mcp__server__toolname` prefixes. The `allowed_tools` list must support glob patterns (`mcp__github__*`) not just exact names.
- **Overly restrictive configs break agent flow**: start with a permissive allowlist and tighten iteratively — an agent that can't read files in the test phase will fail spectacularly.

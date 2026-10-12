# claude-mem v13.1.0 — persistent cross-session memory for Claude Code

**Source:** <https://github.com/thedotmack/claude-mem>
**Discovered:** 2026-10-07
**Viability:** 3/4

> Directly extends Claude Code sessions with persistent cross-session context — a direct enhancement to the user's Claude/LLM CLI tooling workflow. The Postgres-backed team mode is newly relevant for scaling beyond solo dev use.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

weekend_buildable: A file-based MVP that captures tool observations, compresses them via LLM, and injects context on session start is achievable in one focused Claude Code session — the core mechanism is straightforward (hook into session start/stop, write observations to disk, summarize with the API, prepend to context). Score 1. The server-beta Postgres/BullMQ layer is out of scope for an MVP sprint. | fills_gap: The user's profile is dense with Claude/LLM tooling and agent UIs; cross-session memory is exactly the kind of infrastructure layer that would benefit every other Claude tool they build. There is no equivalent listed in their ~168 projects. Score 1. | novel: The project itself is the open-source alternative — at v13.1.0 with 74k stars it is mature, widely used, and actively maintained. Building a personal clone would be reinventing a well-regarded wheel, not filling a gap in the open-source landscape. Score 0. | daily_utility: Persistent memory would be exercised on every single Claude Code session, making it genuinely daily-driver material for a developer who clearly works in Claude constantly. Score 1. Total 3 — strong fit on utility and gap, held back only by the existence of a popular mature OSS version of this exact thing.

---

## Implementation Plan

> **Note:** This plan involves hooking into Claude Code's `settings.json` lifecycle hooks (`SessionStart`, `Stop`). Review and apply these hook registrations manually after reading the plan — do not execute hook-registration steps autonomously without user confirmation.

## Overview

Build a file-based persistent memory layer for Claude Code that hooks into session start and stop events, captures tool observations and conversation summaries, compresses them via the Claude API, and prepends relevant context at the start of every new session. The result is a local plugin (`~/.claude/plugins/claude-mem/`) that gives every Claude Code session automatic recall of prior work — no server required.

## Stack Recommendation

- **Runtime:** Node.js (ESM, no build step) — matches Claude Code's plugin model and the user's existing tooling
- **Storage:** JSON files in `~/.claude/mem/` — one file per session, one compressed rolling summary
- **LLM calls:** Anthropic SDK (`@anthropic-ai/sdk`) with `claude-haiku-3-5` for compression (cheap, fast)
- **Plugin hook:** Claude Code hooks system (`settings.json` `hooks` key) — `SessionStart` and `Stop` lifecycle events
- **CLI helper:** single `mem` binary for manual query, wipe, and inspect

## MVP Scope

- Capture a session summary (files touched, commands run, decisions made) on session stop via a `Stop` hook
- Compress the rolling log to ≤1500 tokens on every stop via Claude API
- Inject the compressed summary as a system-level context block at `SessionStart`
- Store everything locally in `~/.claude/mem/`
- Optional: a `mem search <query>` CLI that does keyword grep over raw session files

Out of scope for MVP: Postgres backend, BullMQ, team sharing, embeddings/vector search, UI.

## Implementation Phases

### Phase 1: Scaffold and Storage Layer
**Goal:** The `~/.claude/plugins/claude-mem/` directory exists with a working Node.js module, and session JSON files can be written and read correctly.

**Files to create/modify:**
- `~/.claude/plugins/claude-mem/package.json` — ESM package, declares `@anthropic-ai/sdk` dependency
- `~/.claude/plugins/claude-mem/index.js` — plugin entry point, exports `hooks` object
- `~/.claude/plugins/claude-mem/lib/storage.js` — read/write helpers for `~/.claude/mem/`
- `~/.claude/plugins/claude-mem/lib/session.js` — session ID generation (`date-session-<uuid>`)

**Key steps:**
1. Create `~/.claude/plugins/claude-mem/` and run `npm init -y` inside it, then `npm install @anthropic-ai/sdk`
2. Set `"type": "module"` in `package.json`
3. In `storage.js`, implement `ensureMemDir()` that creates `~/.claude/mem/sessions/` and `~/.claude/mem/summary.json` if absent; implement `writeSession(id, data)` and `readSummary()` / `writeSummary(text)`
4. In `session.js`, generate a session ID as `${new Date().toISOString().slice(0,10)}-${crypto.randomUUID().slice(0,8)}`
5. In `index.js`, export a minimal `hooks` object with stub `onSessionStart` and `onStop` functions that console-log the session ID to confirm loading

**Verify:** `node ~/.claude/plugins/claude-mem/index.js` prints no errors; `node -e "import('~/.claude/plugins/claude-mem/index.js').then(m => console.log(Object.keys(m.default)))"` prints `[ 'hooks' ]`

---

### Phase 2: Stop Hook — Capture and Write Session Data
**Goal:** When a Claude Code session ends, a JSON file capturing the session's tool calls, files touched, and a raw transcript excerpt is written to `~/.claude/mem/sessions/<id>.json`.

**Files to create/modify:**
- `~/.claude/plugins/claude-mem/lib/capture.js` — extracts structured data from the hook payload
- `~/.claude/plugins/claude-mem/index.js` — implement `onStop(payload)` to call capture + storage
- `~/.claude/settings.json` (or `~/.claude/settings.local.json`) — register the `Stop` hook (manual step — review before applying)

**Key steps:**
1. In `capture.js`, implement `extractSessionData(payload)` that pulls: `toolCalls` (array of `{tool, args}` from `payload.toolResults`), `filesModified` (unique file paths from Write/Edit tool calls), `commands` (Bash commands run), `messageCount`, and `lastUserMessage` (the final human turn text, truncated to 500 chars)
2. In `onStop`, call `extractSessionData`, add `timestamp` and `sessionId`, then call `storage.writeSession(sessionId, data)`
3. Register in `~/.claude/settings.json` (user applies manually):
   ```json
   {
     "hooks": {
       "Stop": [{"command": "node ~/.claude/plugins/claude-mem/index.js --hook Stop"}]
     }
   }
   ```
4. Since Claude Code hooks pass payload via stdin, update `index.js` to detect `--hook Stop` CLI arg, read stdin as JSON, and route to `onStop`
5. Add error boundary so any failure exits 0 (never block session stop)

**Verify:** End a Claude Code session; confirm `ls ~/.claude/mem/sessions/` shows a new `.json` file; `cat` it and confirm it contains `toolCalls`, `filesModified`, and `timestamp` fields.

---

### Phase 3: AI Compression — Rolling Summary
**Goal:** After each session stop, the new session data is merged into a compressed rolling summary (`~/.claude/mem/summary.json`) using the Claude API, keeping the summary under 1500 tokens.

**Files to create/modify:**
- `~/.claude/plugins/claude-mem/lib/compress.js` — calls Claude API to summarize
- `~/.claude/plugins/claude-mem/index.js` — call compress after writing session file

**Key steps:**
1. In `compress.js`, implement `compressSummary(existingSummary, newSessionData)` that calls `anthropic.messages.create` with model `claude-haiku-3-5`, a system prompt instructing it to act as a memory compressor, and a user message containing the existing summary + new session JSON serialized as compact text
2. System prompt: `"You are a memory compressor for a developer's AI coding assistant. Given a prior summary and new session data, produce a concise updated summary (max 300 words) covering: recent files worked on, key decisions made, active tasks, and anything the developer would want to remember next session. Be concrete — name files and tasks."`
3. Read `ANTHROPIC_API_KEY` from `process.env`; if absent, skip compression and log a warning (graceful degradation)
4. Write the returned text back to `~/.claude/mem/summary.json` as `{ updatedAt, text, sessionCount }`
5. In `onStop`, call `compressSummary` after `writeSession`, await it with a 10-second timeout (abort if slow)

**Verify:** After a session stop, `cat ~/.claude/mem/summary.json` shows a coherent prose summary mentioning actual file names from the session; `jq .sessionCount ~/.claude/mem/summary.json` increments each run.

---

### Phase 4: SessionStart Hook — Context Injection
**Goal:** At the start of every new Claude Code session, the compressed summary is prepended to the context as a system message so Claude has immediate recall of prior work.

**Files to create/modify:**
- `~/.claude/plugins/claude-mem/lib/inject.js` — formats the context block
- `~/.claude/plugins/claude-mem/index.js` — implement `onSessionStart(payload)` to return injected context
- `~/.claude/settings.json` — register the `SessionStart` hook (manual step — review before applying)

**Key steps:**
1. In `inject.js`, implement `buildContextBlock(summary)` that returns a markdown-formatted string:
   ```
   ---
   ## Prior Session Memory (claude-mem)
   Last updated: <date>
   <summary.text>
   ---
   ```
2. In `onSessionStart`, call `storage.readSummary()`; if file exists and `text` is non-empty, write the context block to a temp file at `/tmp/claude-mem-context-<pid>.md` and print its path to stdout (Claude Code SessionStart hooks can inject files this way)
3. If summary is absent or empty (first ever session), skip silently
4. Register in `~/.claude/settings.json` (user applies manually):
   ```json
   "SessionStart": [{"command": "node ~/.claude/plugins/claude-mem/index.js --hook SessionStart"}]
   ```
5. Test by manually running `node ~/.claude/plugins/claude-mem/index.js --hook SessionStart` and confirming output is the formatted memory block

**Verify:** Start a new Claude Code session in any project; the first system message or context includes the `## Prior Session Memory` block with content from the previous session's summary.

---

### Phase 5: CLI Helper and Polish
**Goal:** A `mem` CLI command lets the user inspect, search, and wipe memory; the plugin handles errors gracefully and logs to `~/.claude/mem/plugin.log`.

**Files to create/modify:**
- `~/.claude/plugins/claude-mem/bin/mem.js` — CLI entry point
- `~/.claude/plugins/claude-mem/lib/log.js` — append-only file logger
- `~/.claude/plugins/claude-mem/package.json` — add `bin` field
- Shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`) — add `mem` to PATH via `npm link` (user applies manually)

**Key steps:**
1. In `bin/mem.js`, implement subcommands using `process.argv`:
   - `mem show` — pretty-prints `summary.json`
   - `mem sessions` — lists all session files with timestamps and file counts
   - `mem search <query>` — greps raw session JSON files for the query string (case-insensitive)
   - `mem wipe` — deletes all session files and resets `summary.json`; prompts `Are you sure? (y/N)` before wiping
2. In `log.js`, implement `logEvent(level, msg)` that appends `[ISO timestamp] [LEVEL] msg\n` to `~/.claude/mem/plugin.log`; wrap all hook entry points with try/catch that log errors here
3. Add `"bin": { "mem": "./bin/mem.js" }` to `package.json`; run `npm link` inside the plugin directory so `mem` is on PATH
4. Add graceful degradation throughout: if `ANTHROPIC_API_KEY` is unset, hooks still run but skip compression; if `summary.json` is corrupt JSON, overwrite with empty state rather than crashing
5. Add a `mem status` subcommand that prints: session count, summary word count, last updated, API key present (yes/no), log file size

**Verify:** Run `mem show` and see the current summary; run `mem sessions` and see a list of past sessions; run `mem search index.js` and see sessions that touched `index.js`; start a Claude session and confirm `~/.claude/mem/plugin.log` shows `[INFO] SessionStart hook ran` with no errors.

## Estimated Effort

**2 Claude Code sessions**

- **Session 1 (Phases 1–3):** Scaffold the plugin, wire up the Stop hook, implement storage, and get AI compression working end-to-end. By end of session: session files are being written and `summary.json` is updated after every stop.
- **Session 2 (Phases 4–5):** Wire the SessionStart injection, build the `mem` CLI, add logging and error handling, and do end-to-end testing across two real Claude sessions to confirm memory persists correctly.

## Potential Blockers

- **Hook payload schema:** Claude Code's hook payload format for `Stop` and `SessionStart` is not publicly documented in detail. The actual fields available (tool results, transcript, etc.) need to be discovered by logging raw stdin in Phase 2 Step 1 before writing `capture.js`. Plan: add a `--hook Dump` debug path that writes raw stdin to `~/.claude/mem/debug-payload.json` first.
- **SessionStart context injection mechanism:** How Claude Code actually consumes SessionStart hook output (stdout text? file path? env var?) must be confirmed against the live hook docs or by testing. If stdout injection is not supported, the fallback is writing the context block to `~/.claude/CLAUDE.md` as a prepended section (which Claude Code always reads) and removing it at stop time.
- **`ANTHROPIC_API_KEY` in hook environment:** Hooks run as child processes; the API key may not be in their environment depending on shell config. Phase 3 must test this explicitly and document that users must add `ANTHROPIC_API_KEY` to `~/.claude/settings.json` under `env` if it's not picking up from shell.
- **Token cost creep:** If sessions are long (hundreds of tool calls), the raw session JSON fed to the compression prompt could be large. Cap `toolCalls` array at 50 entries and `commands` at 30 in `capture.js` to keep prompt size predictable.
- **Plugin loading mechanism:** Confirm whether `~/.claude/plugins/` is the correct auto-load path for Claude Code plugins or whether the plugin must be explicitly registered in `settings.json`. If auto-loading is not supported, Phase 1 must include the `settings.json` registration step for the module itself.

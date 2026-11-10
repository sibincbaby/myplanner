# beacon.sh — Self-Improving Memory for AI Coding Agents

**Source:** [producthunt.com/posts/beacon-sh](https://www.producthunt.com/posts/beacon-sh) (Product Hunt, Nov 2 2026)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** build-the-gap. beacon.sh is a closed/hosted Product Hunt launch. The gap it describes — persistent, self-improving memory for coding agents — has no strong open-source implementation. Build the open version.

## Why this one

Claude Code sessions start fresh every time. Any conventions, decisions, or preferences accumulated in one session are gone in the next. beacon.sh markets itself as "open-source self-improving memory for AI coding agents" but the Product Hunt listing links to a hosted service. The opportunity is to build the local-first, open-source version using Claude Code hooks and a simple file-backed store.

**Why FG=1:** Agent memory is broken today. Prior discovery found lorekit's `.agmem` proposal (2026-11-09), which proposes a portable format but no hook-based capture. beacon.sh adds the idea of *self-improving* memory — the agent notices patterns in its own tool calls and distills them into durable facts. No open tool does this today.

**Why N=1:** The self-improving angle is new: rather than requiring manual `remember` calls, the agent observes its own behavior (which files it always reads first, which commands it always runs) and writes memory entries automatically. This is distinct from lorekit (manual memory) and claude-mem (manual memory).

**Why WB=1:** MVP is a Claude Code hooks script that tails the session log, identifies repeated patterns, and writes them to a JSON store. Claude reads the store at session start. This is a focused afternoon build.

**Why DU=1:** Every session improves. After a week, the agent knows your stack, your conventions, and your project structure without being told.

## Stack recommendation

- **Python** — hooks script invoked by Claude Code pre/post hooks
- **SQLite + JSON** — store for memory entries (one DB per project, global DB for preferences)
- **Claude claude-haiku-5-5** — cheap pass over session events to extract durable facts
- **Claude Code hooks** — `PreToolUse` and `Stop` hooks to capture session events and distill patterns

## MVP scope

A hooks-based memory distiller with two parts:

1. **Session logger (`beacon-log.py`):** a `PostToolUse` hook that appends every tool call (tool name, file paths, success/failure) to a session log in `~/.beacon/sessions/YYYY-MM-DD-HH.jsonl`.

2. **Memory distiller (`beacon-distill.py`):** a `Stop` hook that reads today's session log, calls Claude claude-haiku-5-5 with the log and the prompt "What conventions or patterns in this session should this developer remember for future sessions?", and appends the result as an entry in `~/.beacon/memory.json`.

3. **Context injector (`beacon-inject.py`):** a `PreCompact` hook (or session-start hook) that reads the last 20 memory entries from `~/.beacon/memory.json` and injects them as a system message via the `system` prompt injection mechanism.

Out of scope (MVP): semantic search over memories, per-project memory namespacing, memory expiry, cloud sync.

## Phases

1. **Logger (1 session).** Write `beacon-log.py` as a `PostToolUse` hook. Configure it in `~/.claude/settings.json`. Verify that after a session, `~/.beacon/sessions/` has a JSONL file with tool calls. Run a 10-minute real session and inspect the output.

2. **Distiller (1 session).** Write `beacon-distill.py` as a `Stop` hook. Use Claude claude-haiku-5-5 (cheap) with a focused extraction prompt. Run it on the JSONL from phase 1. Tune the prompt until the extracted facts are concrete (e.g., "Always reads CLAUDE.md before editing" not "User is productive").

3. **Injector (30 min).** Write `beacon-inject.py` to prepend the top 10 memory entries to the system prompt. Test that Claude acknowledges the injected context in a fresh session.

4. **Self-improvement loop (1 session).** Add deduplication: before writing a new memory entry, check if a semantically similar one exists. Use simple keyword matching or a local embedder. Add a "confidence score" that increases when a pattern is observed in multiple sessions and decreases when it stops appearing.

5. **CLI (optional, 30 min).** A `beacon` CLI command that lists, edits, and deletes memory entries. `beacon list`, `beacon edit <id>`, `beacon forget <id>`.

## Effort

Phases 1–3: 1.5 sessions. Full implementation: 2.5 sessions.

## Blockers / risks

- **Claude Code hooks documentation:** hooks are well-documented but `Stop` hook timing needs testing (does it fire before or after the conversation ends?). Check the hooks docs before building the distiller.
- **Distillation quality:** a cheap haiku call may produce vague memories. If quality is poor, run a second pass with a stronger model (Sonnet) on only the high-signal events (file writes, test failures, long chains of retries).
- **Memory bloat:** after 30 days, `memory.json` could have hundreds of entries. Add a weekly pruning pass that removes low-confidence entries and merges duplicates.
- **Relationship to lorekit:** the `.agmem` format from lorekit (2026-11-09) could be used as the storage format here, making the two projects interoperable. Worth reading the lorekit spec before finalizing the memory schema.

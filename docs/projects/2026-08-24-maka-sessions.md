# maka-sessions — Durable Agent Session Log with Crash Recovery

**Source:** [apache/maka](https://github.com/apache/maka) · GitHub · TypeScript+Electron+SQLite · ~2.3k★ · Apache Incubator
**Date discovered:** 2026-08-24

## What it is

Apache Maka is a local-first AI agent workspace that records all agent interactions — model messages, tool calls, tool results, permission decisions, and termination events — as an **append-only log** to SQLite. The key innovation: because events are immutable and sequenced, a crashed session can be recovered by replaying the log. The user never loses work because "the session died."

Maka ships a full Electron desktop app with a TUI and evaluation framework. The core insight worth extracting is the **event-sourced session architecture**, not the desktop UI.

## Why it fits

- Core interest: **Claude/LLM tooling** — the event log is provider-agnostic, wrapping any agent including Claude Code
- Core interest: **Agent UIs** — the session viewer (timeline + branching) is a new kind of agent interface
- Core interest: **Dev productivity** — crash recovery and session replay solve a real daily friction point
- `novel = 1`: loopx (08-21) tracks goals and evidence in YAML; maka captures every tool call at full fidelity. These are complementary layers — loopx is the agenda, maka-sessions is the transcript. No prior plan addresses full tool-call-level session durability.
- `daily_utility = 1`: every Claude Code session today can lose state to a crash, context compaction, or terminal close. A durable log ends that.

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | The core is a SQLite append-only event table + a write hook + a status CLI; that's one session |
| fills_gap | 1 | No prior plan addresses full tool-call fidelity logging; loopx covers goals, not transcripts |
| novel | 1 | Event-sourced session architecture for AI agents is not in the toolkit |
| daily_utility | 1 | Immediately useful: every Claude Code session becomes recoverable |
| **Total** | **4/4** | **VIABLE** |

**Note:** The plan targets a minimal personal version of the maka event-log pattern — a SQLite writer + a CLI recovery tool + a Claude Code hook — not a reimplementation of Maka's full Electron workspace. If Maka's desktop fits your workflow, install it directly (`brew install apache-maka` on Apple Silicon). The plan exists for the case where a lightweight log-and-recover tool is enough.

## Stack Recommendation

```
Language:  TypeScript with tsx (or Python 3.11+ with uv — either works)
Storage:   SQLite via better-sqlite3 (sync writes = safe from crashes)
Schema:    events(id, session_id, ts, kind, payload JSON)
CLI:       maka-session start|status|replay|tail
Hook:      Claude Code pre/post-ToolUse hook that calls the writer
Config:    ~/.maka/sessions.db (single file, no server)
```

One SQLite file. All events are JSON-serialized payloads. The file is git-ignoreable or git-committable as desired.

## MVP Scope (1-2 Claude sessions)

Four commands and one hook:

1. `maka-session start [--label "fix auth bug"]` — create a new session row, return `SESSION_ID`, export to env
2. `maka-session event <kind> <json>` — append one event to the active session (called by the hook)
3. `maka-session tail` — stream the last N events for the active session (useful while working)
4. `maka-session replay <session-id>` — print the full event sequence for a past session, formatted as a readable log

The **Claude Code hook** (a `pre-ToolUse` + `post-ToolUse` pair in `.claude/hooks/`) calls `maka-session event tool_call '{"tool":"...", "input":{...}}'` before each tool call and `maka-session event tool_result '{"output":"...", "error":null}'` after. The session ID is set at session start and exported into the hook env.

## Phases

### Phase 1: Schema + Core CLI (1.5h)
- Define SQLite schema: `sessions(id, label, started_at, ended_at)`, `events(id, session_id, seq, ts, kind, payload)`
- Implement `start`, `event`, `tail`, `replay` commands
- `tail` output: `[HH:MM:SS] kind: payload_preview` — one line per event
- `replay` output: full JSON log, or a human-readable mode (`--pretty`)
- Verify: start a session, append 5 events of different kinds, tail them, replay in order

### Phase 2: Claude Code Hook (0.5h)
- Write `.claude/hooks/maka-pre.sh` and `.claude/hooks/maka-post.sh`
- Pre hook: `maka-session event tool_call "${TOOL_NAME}" "${TOOL_INPUT}"`
- Post hook: `maka-session event tool_result "${TOOL_NAME}" "${TOOL_OUTPUT}" "${TOOL_ERROR}"`
- Register in project `.claude/settings.json` under `hooks.PreToolUse` and `hooks.PostToolUse`
- Verify: run a Claude Code session with a Bash tool call — two events appear in `maka-session tail`

### Phase 3: Session Recovery CLI (1h)
- `maka-session recover <session-id>` — print a recovery prompt: last goal (if loopx is installed), last 20 events, last tool result, any open `edit` operations that didn't receive a result
- Outputs a markdown block the user can paste into a new Claude session to continue from where the crash occurred
- Verify: start a session, append events, kill the terminal, run `maka-session recover` in a new terminal — the recovery prompt is readable and complete

### Phase 4: Session Diff (0.5h)
- `maka-session diff <session-id-a> <session-id-b>` — show which tools were called in one session but not the other (useful for comparing "what did I do yesterday vs today")
- Outputs a side-by-side table of tool kinds and counts
- Verify: two sessions with different tool usage — diff shows the delta

### Phase 5: Metrics CLI (0.5h)
- `maka-session stats [--last N]` — show: sessions count, tool calls per session (mean/max), most-used tools, sessions with errors
- One-page summary, no charts
- Verify: 3 sessions of varied depth — stats output matches manual count

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Schema + core CLI | 1.5h |
| Claude Code hook | 0.5h |
| Session recovery | 1h |
| Session diff | 0.5h |
| Metrics CLI | 0.5h |
| **Total** | **4h (one day)** |

## Blockers / Risks

- **Maka itself may be the right answer.** Before building, try `brew install apache-maka` (macOS Apple Silicon build is available). If the desktop workspace fits your workflow, the plan is unnecessary. The build plan exists for the lightweight CLI-only case where Electron is unwanted overhead.
- **Hook ordering with other hooks matters.** If `.claude/settings.json` already has `PreToolUse` hooks (e.g., from `~/.git-hooks`), the maka hooks must be appended, not replace them. The hook system runs all matching hooks in order; register maka-pre.sh as an additional entry.
- **SQLite sync writes add ~1ms per tool call.** `better-sqlite3` uses synchronous WAL writes which are safe but not free. For sessions with hundreds of tool calls (large migrations, multi-file refactors), this is imperceptible. If you run parallel agent sessions writing to the same DB, add a session-level write lock.
- **Payload size grows fast on large file edits.** A single Write tool call with a 50KB file produces a 50KB JSON payload. Either truncate payloads above 4KB in the event writer (store `payload_truncated: true`) or store diffs instead of full content. Phase 1 should set a 4KB cap immediately.
- **`maka-session recover` requires loopx for the goal line.** If loopx is not installed, the goal line is omitted. The recovery prompt still works — it shows the last 20 events — but it won't include the objective. The two tools compose but neither depends on the other.

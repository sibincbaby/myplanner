# Corgi — Agent-Aware Terminal Multiplexer

**Source:** HN Weekly Digest (Oct 19-26, 2026) — 137 points, 46 comments  
**HN thread:** https://news.ycombinator.com/item?corgi-terminal-agent  
**Discovered:** 2026-10-30  
**Viability:** 4/4 (WB ✅ · FG ✅ · N ✅ · DU ✅)

## What it is

Corgi is described as "a helpful {agent, terminal} multiplexer" — a tool that runs multiple AI agent sessions in parallel panes, routes messages between them, and lets you inspect, pause, or redirect individual agents. Unlike tmux (which is process-agnostic), Corgi understands agent session structure: it can show which tool calls each pane is waiting on, surface live token counts, and let you send a message to all agents or a specific one. The 46-comment thread suggests active discussion about its architecture and use cases.

Key details:
- Multiplexes multiple concurrent agent sessions in split terminal panes
- Agent-aware: shows tool-call state, wait status, and session metadata per pane
- Cross-pane messaging: broadcast a message to all agents or target one
- Lightweight Python/Go daemon, not a full TUI framework

## Why it scores

- **Weekend-buildable:** A Python daemon using `tmux` or `screen` as the pane backend, plus a thin agent-state tracker that reads Claude Code session logs, is achievable in 1-2 Claude sessions. The hard part (terminal rendering) is delegated to tmux.
- **Fills gap:** Running multiple Claude Code sessions — one for tests, one for the main feature, one for a background research task — is a common pattern with no good orchestration layer. There is no tool that lets you manage and observe them as a group.
- **Novel:** tmux is session management without agent awareness. Claude Code's built-in session tracking is per-session, not cross-session. Corgi's cross-agent message routing and tool-call visibility is genuinely new.
- **Daily utility:** Any session involving parallel Claude Code subagents, or running a background agent alongside an interactive one, benefits immediately.

## Build angle

Build a lightweight agent multiplexer as a tmux wrapper with a Claude Code hook:

1. A Python daemon (`corgi`) that spawns named tmux windows for each agent session.
2. A `PostToolUse` hook that writes `{session_id, tool_name, status, ts}` to a shared state file.
3. A sidebar TUI pane (rendered by `rich`) that reads the state file and shows per-session status bars.
4. A `corgi send <message>` command that pipes a message to a chosen session's stdin (or all sessions with `--all`).
5. A `corgi ps` command listing all active sessions with their current tool-call status.

## MVP Scope (weekend build)

- [ ] `corgi start <name>` — spawns a new tmux window with a Claude Code session, registers it in `~/.corgi/state.json`
- [ ] `corgi ps` — lists active sessions with current tool name, status (running/waiting/done), and token count from session log
- [ ] `corgi send <name> <message>` — injects a message into the named session
- [ ] Sidebar status pane: `rich` app that tails `~/.corgi/state.json` and renders a live status board
- [ ] `PostToolUse` hook that writes tool-call events to the state file

## Phases

### Phase 1 — Session registry (Day 1, ~1.5h)
- `corgi start`, `corgi stop`, `corgi ps` commands
- State stored in `~/.corgi/state.json`: `{name, tmux_window, session_id, started_at}`
- Tmux integration: launch window, capture window, send keys

### Phase 2 — Agent state hook (Day 1, ~1.5h)
- `PostToolUse` hook script (`~/.claude/hooks/corgi-post-tool.sh`) appends `{session_id, tool, status, ts}` to `~/.corgi/events.jsonl`
- Parser reads events.jsonl and derives current per-session status

### Phase 3 — Status board (Day 2, ~2h)
- `rich` live display: one row per session showing name, current tool, wait status, elapsed time, token estimate
- Updates every 2 seconds by re-reading the events file
- Keyboard: `[s]elect session → [k]ill · [m]essage · [q]uit`

### Phase 4 — Cross-agent messaging (Day 2, ~1.5h)
- `corgi send <name> <msg>` sends a message to the session's tmux window via `tmux send-keys`
- `corgi broadcast <msg>` sends to all running sessions
- Broadcast log appended to `~/.corgi/broadcast.log`

## Effort estimate

| Phase | Hours |
|-------|-------|
| Session registry | 1.5 |
| Agent state hook | 1.5 |
| Status board | 2 |
| Cross-agent messaging | 1.5 |
| **Total** | **~6.5h** |

## Blockers / risks

- Claude Code session IDs are per-invocation; correlating a tmux window to a session ID requires either passing `--session-id` at launch or reading the session log path from the process environment.
- `tmux send-keys` injects text at the cursor position; Claude Code's input handling may not pick up keys sent this way if it uses readline with custom key bindings — test before committing.
- Token count estimation from session logs is approximate; the actual count is only accessible via the API response metadata, which the hook can capture.

## Reference

- HN thread: https://news.ycombinator.com/item?corgi-terminal-agent
- tmux docs: https://man7.org/linux/man-pages/man1/tmux.1.html
- Claude Code hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- rich live display: https://rich.readthedocs.io/en/stable/live.html

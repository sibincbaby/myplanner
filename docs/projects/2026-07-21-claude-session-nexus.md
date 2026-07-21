# Claude Session Nexus

> Multi-session dashboard for Claude Code: live-tail logs, run queue, multi-account isolation

**Inspired by:** [CCManagerUI](https://github.com/LunarWerxs/CCManagerUI) (11 ⭐)  
**Date discovered:** 2026-07-21

---

## What gap it fills

Claude Code has no native view into multiple concurrent sessions. You can run three `claude` processes in three terminals, but there is no unified place to see what each is doing, queue follow-up runs, or track which session is on which task. CCManagerUI is a 11-star proof-of-concept; the concept is sound and entirely unbuildable-in-public territory.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Backend daemon | Node.js + Bun | Fast startup, native `fs.watch`, runs without installation |
| Session discovery | `~/.claude/projects/*/` glob | Claude Code writes session state here |
| IPC | Unix socket / HTTP | Daemon ↔ UI communication |
| Frontend | SvelteKit (SSR off) | Lightweight, reactive, ships as a static HTML page served by the daemon |
| MCP integration | MCP server exposed on daemon | AI agents can query session list programmatically |

## MVP scope (1 Claude session)

1. Daemon reads `~/.claude/projects/` every 2 s; discovers active session directories
2. Per-session: exposes last-modified timestamp, project root, working dir
3. Web UI at `localhost:7172`: session list table with project name, status (idle/running), last activity
4. Live log tail: click a session → WebSocket stream of its output log
5. Basic queue: text field to enqueue a `claude "<prompt>"` CLI command; executed sequentially

Out of scope for MVP: multi-account isolation, Docker profiles, mobile UI.

## Phases

### Phase 1 — Session discovery (2 h)
- Reverse-engineer `~/.claude/projects/` directory structure
- Write a watcher that extracts: project name, cwd, last-active timestamp, running/idle status
- Unit-test discovery against fixtures

### Phase 2 — Daemon + API (2 h)
- Bun HTTP server at `localhost:7172`
- `GET /sessions` → JSON list
- `GET /sessions/:id/log` → streaming plain-text
- `POST /queue` → enqueue a `claude` CLI invocation

### Phase 3 — SvelteKit dashboard (3 h)
- Session list: project name, status badge, time-since-last-activity
- Log panel: live WebSocket tail with ANSI color stripping
- Queue panel: input field, queue status, cancel button

### Phase 4 — MCP server (1 h)
- Expose `list_sessions`, `get_session_log`, `enqueue_command` as MCP tools
- Allows a Claude agent to introspect its own sibling sessions

### Phase 5 — Packaging + polish (1 h)
- Single `npx claude-session-nexus` install
- macOS menu-bar icon (optional, using `menubar` npm package)

## Effort estimate

~9 hours total · fits 2 focused Claude Code sessions

## Blockers / risks

- **Undocumented session format**: Claude's `~/.claude/projects/` schema is not public; Phase 1 must reverse-engineer it from a live session. Fallback: parse the JSONL transcript files if the directory schema proves too opaque.
- **Log file location**: Claude Code may write output only to stdout/stderr with no persistent log. Mitigation: wrap `claude` invocations with a pty/pipe layer that tees to a log file.
- **Multi-platform paths**: Windows uses `%APPDATA%\Claude\` — scope to macOS/Linux for MVP.

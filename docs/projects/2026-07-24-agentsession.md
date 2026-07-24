# AgentSession

> Browser-based viewer for Claude Code session history — browse, search, and replay your agent conversations the same way pi-web does for the pi agent, but tailored for Claude Code's `.jsonl` session files

**Inspired by:** [agegr/pi-web](https://github.com/agegr/pi-web) (GitHub trending July 24 2026, +315 stars today)  
**Date discovered:** 2026-07-24

---

## What gap it fills

Claude Code stores every conversation in `~/.claude/projects/<hash>/conversation_<id>.jsonl` but there is no visual way to browse, search, or review what happened. When an agent session fails mid-way, understanding what tools it called and what it cost means manually grepping opaque JSONL. AgentSession gives you a local web app: a sidebar of all past sessions, a chat-style viewer with tool calls rendered inline, full-text search across all sessions, and a cost/token dashboard — the same UX that pi-web delivers, built for Claude Code's actual file format.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Backend | Bun + Hono (TypeScript) | Tiny server, reads local filesystem, watch mode built-in |
| Frontend | React 19 + Vite + Tailwind | Fast DX, familiar, ships as localhost SPA |
| JSONL parsing | Streaming line reader | Sessions can be large; don't load entire file at once |
| Search | Fuse.js (in-browser fuzzy) | No infra needed for search across a few hundred sessions |
| Cost display | Token counts from session metadata | Claude Code embeds usage in each message turn |

## MVP scope (1 Claude session)

A single-page app served locally at `localhost:3721` that:

1. Discovers all session JSONL files under `~/.claude/projects/`
2. Lists them in a sidebar sorted by recency, with project name and date
3. Clicking a session renders the conversation: human turns, assistant text, tool calls (name + input + output), and cost per turn
4. A search bar filters sessions by content, file path mentioned, or tool name used

Out of scope for MVP: authentication, cloud sync, diffing sessions, plugin system.

## Phases

### Phase 1 — Session discovery (45 min)
- Walk `~/.claude/projects/` recursively, find `*.jsonl` files
- Extract session metadata: first human message, timestamp, total cost, turn count
- Return as JSON list sorted by last-modified date
- Handle malformed lines gracefully (skip + log)

### Phase 2 — Session viewer (1.5 h)
- Render each JSONL line as a typed message block:
  - `human` turns → user bubble
  - `assistant` turns → assistant bubble with markdown rendering
  - `tool_use` entries → collapsible card with tool name, input JSON, output
  - `tool_result` entries → nested inside the tool card
- Show per-turn token count and running cumulative cost
- Highlight code blocks inside tool outputs

### Phase 3 — Sidebar + navigation (30 min)
- Project grouping: sessions under the same `projects/<hash>` path group together
- Session list shows: project dir name, first human message truncated to 80 chars, date, cost
- Keyboard navigation: `j`/`k` to move between sessions, `/` to jump to search

### Phase 4 — Full-text search (45 min)
- Index all sessions' text content in Fuse.js on load (or lazy-load as user scrolls)
- Search bar filters sidebar list in real time
- Match highlighting inside the session viewer
- Filter chips: by project, by tool used, by date range

### Phase 5 — Cost dashboard (30 min)
- Summary panel: total spend across all sessions, last 7 days chart (sparkline)
- Per-project spend breakdown
- Most expensive sessions ranked
- Average cost per turn across all sessions

## Effort estimate

~4 hours for Phases 1–3 (browsable MVP) · 1 Claude session  
~6 hours complete with search + cost dashboard

## Blockers / risks

- **JSONL schema changes across Claude Code versions**: the session format is undocumented and may differ by version. Mitigation: be defensive — skip unknown `type` fields rather than failing, and display raw JSON for unrecognized entries.
- **Large session files**: a long coding session can be 10–50 MB of JSONL. Mitigation: stream-read line-by-line; paginate the viewer to show last 200 turns with a "load more" button.
- **Path to sessions varies by OS**: `~/.claude` on Linux/Mac but different on Windows. Mitigation: read `CLAUDE_CONFIG_DIR` env var if set, fallback to `~/.claude`, show a "configure path" UI if nothing found.

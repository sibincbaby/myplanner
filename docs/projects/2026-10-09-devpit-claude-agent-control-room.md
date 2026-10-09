# devpit — Native Control Room for Claude Code Agents

**Source:** Product Hunt Oct 5, 2026 daily leaderboard  
**Tagline:** "A native control room for your Claude Code agents"  
**Discovered:** 2026-10-09

---

## Why it fits

With Claude Code mods and cloud sessions multiplying, users increasingly run 3–6 parallel agent sessions. There's no single pane of glass to see what's running, what it's costing, or which one is stuck. devpit fills exactly that gap as a mods-era native Claude plugin.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Dashboard + session hooks is a known pattern; 1–2 sessions |
| fills_gap | 1 | Nothing unified exists for multi-session oversight in the mods era |
| novel | 1 | Mods-native approach is genuinely new vs. older Electron dashboards |
| daily_utility | 1 | Anyone running multiple agents would open this every session |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Claude Code plugin** (TypeScript) — runs inside the Claude Code UI as a live panel
- **SQLite** — lightweight session history and cost tracking
- **WebSocket / IPC** — connect to active Claude Code processes
- Node.js file-system watcher for session state files (`~/.claude/sessions/`)

## MVP Scope

A Claude Code plugin panel that shows:
1. All active sessions with current task and status (idle / working / waiting)
2. Token spend per session (live, from session logs)
3. A kill/pause button per session

Not in MVP: replay, cost forecasting, cross-machine sync.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Discover active Claude Code sessions via `~/.claude/sessions/` and IPC socket | 2 h |
| 2 | Plugin panel UI — session cards with status indicators | 3 h |
| 3 | Token + cost counter from session logs | 2 h |
| 4 | Kill/pause controls via Claude Code plugin API | 2 h |
| 5 | Historical session list with duration + cost totals | 2 h |

**Total estimate:** ~11 h (1.5 Claude sessions)

## Blockers

- Claude Code session IPC API — need to inspect `~/.claude/` for the session socket format
- Plugin panel API surface for reading live session state may not be fully documented
- Cost data may need to be derived from log files rather than a first-class API

## References

- Product Hunt Oct 5, 2026: https://www.producthunt.com/leaderboard/daily/2026/10/5
- Claude Code plugin authoring: use `/plugin-authoring` skill

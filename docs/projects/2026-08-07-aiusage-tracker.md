# aiusage-tracker — Local AI Coding Cost & Quota Dashboard

**Source:** [juliantanx/aiusage](https://github.com/juliantanx/aiusage) · GitHub search (claude-code usage tracking, 113 ★)
**Language:** TypeScript · React · better-sqlite3 · Node.js 20+ · MIT
**Date discovered:** 2026-08-07

## What it is

A local-first usage tracker for AI coding assistants. It parses session logs from Claude Code, Codex, Cursor, Copilot, Gemini CLI, and 15 others, then presents a unified dashboard showing tokens consumed, cost, session count, quota pressure, tool calls, and model distribution — without uploading your prompts or source code.

Features: desktop tray widget for live cost-per-session, optional sync to S3/R2/MinIO for multi-machine aggregation, a public leaderboard (aggregate stats only), and per-project breakdowns.

**Why a personal build:** `aiusage` has 113 stars and is actively maintained. The value in building your own is customisation: your own alert thresholds, Slack/phone notifications when daily spend crosses a limit, and integration with your existing project tracking (e.g. tagging sessions by ticket number from git branch names). The upstream is a great reference, not a reason to stop.

## Why it fits

- Core interest: **Claude/LLM tooling** — directly tracks Claude Code sessions, tokens, and cost
- Core interest: **dev productivity** — knowing daily spend informs how aggressively to use Claude Code
- `weekend_buildable = 1`: at its core it is "parse JSONL logs + SQLite + a minimal React dashboard"
- `daily_utility = 1`: check cost at the end of every coding session; alert if monthly quota is at risk

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Log parser + SQLite + basic dashboard; the upstream proves this is a weekend build |
| fills_gap | 1 | No cost/quota visibility tool exists in the current toolkit |
| novel | 0 | aiusage itself implements this well (113 ★); the concept is fully explored |
| daily_utility | 1 | Check at the end of each coding day; configure monthly budget alerts |
| **Total** | **3/4** | **VIABLE** |

## Stack Recommendation

```
Log parsing:    Node.js file watcher + JSONL parser (claude-sessions/*.jsonl)
Storage:        better-sqlite3 — sessions, turns, token counts, cost, model, project
Dashboard:      React 18 + Vite + Recharts (charts) + shadcn/ui (tables)
Tray widget:    menubar (npm) — shows running daily cost in the menu bar
Alerts:         node-notifier for desktop; optional: POST to ntfy.sh or a Slack webhook
Sync (opt.):    aws-sdk → S3/R2 for multi-machine aggregation
```

Simpler alternative: skip the dashboard entirely for v1 and just emit a daily summary to stdout via a cron job — cost, sessions, top project. Add the UI in v2.

## MVP Scope (1 Claude session)

1. Locate Claude Code's session log directory (`~/.claude/projects/` or the path from `claude --version`)
2. Parse all `*.jsonl` files: extract `session_id`, `model`, `usage.input_tokens`, `usage.output_tokens`, `total_cost_usd`, `timestamp`, `project_path`
3. Insert parsed rows into SQLite; upsert on `(session_id, turn_index)` to handle re-runs
4. Generate a daily summary: total sessions, total cost, top 3 projects by cost, most expensive single turn
5. Print summary to stdout; also write `~/.aiusage/daily/YYYY-MM-DD.json`
6. Verify: totals match what `claude /cost` reports for the same sessions

## Phases

### Phase 1: Log Parser + SQLite Schema (2h)
- Discover Claude Code log path: check `~/.claude/projects/`, `~/.config/claude/`, and `CLAUDE_PROJECTS_DIR` env var
- Parse JSONL lines: branch on `type` — extract cost and usage from `result` events, tool names from `tool_use` events, project path from `system.init`
- SQLite schema:
  ```sql
  sessions(id, project, model, started_at, ended_at, cost_usd, input_tokens, output_tokens)
  turns(id, session_id, role, cost_usd, input_tokens, output_tokens, tool_calls_json, ts)
  projects(path, total_cost_usd, last_seen)
  ```
- Verify: parse a real session directory; row count matches the number of `result` events in the JSONL

### Phase 2: Daily Summary CLI (1h)
- `aiusage summary [--date YYYY-MM-DD]`: query SQLite, print to stdout
  ```
  2026-08-07  4 sessions  $0.83  21k tokens in / 8k out
  Top projects:  myplanner $0.41 · dotfiles $0.26 · scratch $0.16
  Biggest turn:  myplanner, 14:32, $0.31, 9k tokens
  ```
- `aiusage budget --set 30` — store monthly budget in `~/.aiusage/config.json`; print `⚠ 67% of $30 monthly budget used` when > 60%
- Cron entry (printed during install): `0 18 * * * aiusage summary >> ~/.aiusage/log.txt`
- Verify: run summary for yesterday; cost matches the claude `/cost` output for the same day

### Phase 3: React Dashboard (3-4h)
- Vite + React 18 + shadcn/ui; served locally on `http://localhost:7474` via `aiusage serve`
- Views:
  - **Overview**: daily cost bar chart (Recharts), 30-day trend line, sessions-per-day sparkline
  - **Projects**: table sorted by total cost, last used, session count; click row to see turns
  - **Sessions**: list with model, cost, duration, project; click to expand turn-by-turn breakdown
  - **Budget**: progress bar for monthly spend, forecast to month end based on last-7-day average
- Verify: navigate all three views; budget forecast matches manual calculation

### Phase 4: Tray Widget + Alerts (1-2h)
- `menubar` npm package: show `$0.14 today` in the menu bar, update every 60s
- Click tray icon → open dashboard in default browser
- Alert triggers (configurable in `~/.aiusage/config.json`):
  - Daily cost > $X: desktop notification via `node-notifier`
  - Session cost > $Y: notification immediately on session close
  - Monthly budget > 80%: notification + optional POST to ntfy.sh push endpoint
- Verify: manually set daily threshold to $0.01; run a Claude Code session; confirm notification fires

### Phase 5: Git Branch Tagging + Multi-Tool (1h)
- On each log parse, check `git -C <project_path> branch --show-current` → tag turns with the active branch name
- Add branch column to sessions table; dashboard filter by branch (useful for per-PR cost tracking)
- Add a second parser: Codex CLI (`~/.codex/sessions/`) — minimal, just extracts cost and tokens
- Verify: sessions on a feature branch are tagged; filtering by branch in the dashboard shows only those turns

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Log Parser + SQLite Schema | 2h |
| Daily Summary CLI | 1h |
| React Dashboard | 3-4h |
| Tray Widget + Alerts | 1-2h |
| Git Branch Tagging | 1h |
| **Total** | **8-10h (one weekend)** |

Phases 1-2 deliver a useful CLI summary in **3h (one evening)**.

## Blockers / Risks

- Claude Code's JSONL log schema is not a public API; it has changed between versions. Parse defensively: skip unknown event types, never assume required fields are present
- Log file paths differ across OSes and Claude Code versions — discover at runtime, document two fallback paths, fail gracefully with a clear "no logs found" message if neither exists
- The tray widget requires macOS or Linux with a system tray; on headless servers, skip it and use the CLI + cron only
- Token cost calculation requires knowing the model's per-token price. Store a `prices.json` that maps model names to `{input, output}` USD per million tokens; update it when Anthropic adjusts pricing — hardcoded prices go stale
- Multi-machine sync via S3 requires AWS credentials; for most personal use, syncing the SQLite file via iCloud/Dropbox is simpler and avoids an external dependency in the MVP

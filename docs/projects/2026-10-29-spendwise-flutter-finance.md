# spendwise — Flutter AI Expense Tracker with MCP Server

**Source:** GitHub Trending (AI finance / Flutter apps)  
**Repo:** https://github.com/Emmyu/spendwise  
**Discovered:** 2026-10-29  
**Viability:** 4/4 (WB ✅ · FG ✅ · N ✅ · DU ✅)

> **Note:** This repo was identified from search results that could not be fully verified at discovery time. Confirm the MCP server folder exists at the repo before starting a build.

## What it is

An AI-powered expense tracker built with Flutter, featuring an integrated MCP server alongside the mobile app. The MCP server exposes expense data and analysis tools to AI coding agents — so you (or an AI agent) can query your finances via natural language through Claude Code. The Flutter app handles daily expense logging, auto-categorization, and spending analysis; the MCP layer makes that data agent-accessible.

Key details:
- Flutter mobile app (iOS + Android) for expense tracking
- AI auto-categorization of transactions
- Integrated MCP server for agent access to expense data
- Natural-language queries: "what did I spend on food last week?" via Claude Code
- Open source

## Why it scores

- **Weekend-buildable:** A Flutter AI expense tracker MVP is a well-documented project type, achievable in 1-2 Claude sessions. The MCP server layer adds ~1 extra session.
- **Fills gap:** The user has personal finance AI as an explicit interest area. The combination of a Flutter mobile app + MCP server for agent access to personal finance data is a genuine gap — no existing tool in the seen list covers this combination.
- **Novel:** The MCP integration that makes expense data agent-queryable is the differentiating angle. Most Flutter finance apps are standalone; adding an MCP layer makes this a "personal finance copilot" that Claude Code can query during a session.
- **Daily utility:** Expense tracking is a daily-use case; the agent-queryable MCP layer adds a productivity multiplier for anyone who uses Claude Code regularly.

## Build angle

Build a Flutter + MCP personal finance system:

1. Flutter app: quick-add expense screen, category picker, history list, monthly summary chart.
2. FastAPI or Node.js backend that stores expenses in SQLite and exposes a REST API.
3. MCP server wrapping the API: tools for `add_expense`, `list_expenses`, `spending_summary`, `category_breakdown`.
4. Claude Code integration: point Claude Code's MCP config at the local server for natural-language finance queries.

## MVP Scope (weekend build)

- [ ] Flutter app: add expense (amount, category, note, date), list view, monthly total
- [ ] SQLite backend (via `drift` for Flutter, or a FastAPI/SQLite side-car server)
- [ ] MCP server with tools: `add_expense`, `get_expenses(period)`, `spending_summary`, `top_categories`
- [ ] Claude Code `settings.json` integration pointing at local MCP server
- [ ] AI auto-categorization: call Claude with expense description → return category

## Phases

### Phase 1 — Flutter app + local storage (Day 1, ~3h)
- Flutter project with three screens: Add Expense, History, Summary
- `drift` (SQLite wrapper) for local storage
- Expense model: `{id, amount, category, note, date, source}`
- Category picker with common defaults (Food, Transport, Shopping, Bills, etc.)

### Phase 2 — MCP server (Day 1, ~2h)
- Python FastMCP server with four tools: `add_expense`, `list_expenses`, `spending_summary`, `category_breakdown`
- `list_expenses` accepts `period: "today|week|month|year"` and returns structured JSON
- `spending_summary` returns totals per category for the period
- Register in Claude Code `settings.json` as a local stdio MCP server

### Phase 3 — AI categorization (Day 2, ~2h)
- `POST /categorize` endpoint: sends expense description to Claude, returns suggested category + confidence
- Auto-fill category field in Flutter app on description blur
- Manual override always possible

### Phase 4 — Charts + weekly digest (Day 2, ~1h)
- `fl_chart` bar chart for monthly category breakdown
- Weekly Claude-generated spending digest: `GET /weekly-digest` → 3-sentence AI summary of the week's spending patterns

## Effort estimate

| Phase | Hours |
|-------|-------|
| Flutter app + local storage | 3 |
| MCP server | 2 |
| AI categorization | 2 |
| Charts + weekly digest | 1 |
| **Total** | **~8h** |

## Blockers / risks

- The `Emmyu/spendwise` repo may not have the MCP server fully implemented — verify before forking; build it yourself if the folder is empty or stub-only.
- `drift` requires code generation (`flutter pub run build_runner build`) — factor this into setup time.
- The MCP server runs as a local process; it must be started before opening Claude Code for agent access. Consider a startup script or launchd/systemd service.
- AI auto-categorization adds latency to expense entry — make it async with a "categorizing…" indicator.

## Reference

- spendwise repo: https://github.com/Emmyu/spendwise
- drift (Flutter SQLite): https://drift.simonbinder.eu/
- FastMCP (Python MCP server): https://github.com/jlowin/fastmcp
- fl_chart (Flutter): https://pub.dev/packages/fl_chart
- Claude Code MCP config: https://docs.anthropic.com/en/docs/claude-code/mcp

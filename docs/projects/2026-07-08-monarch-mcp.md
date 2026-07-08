# monarch-mcp — Monarch Money MCP Server for Claude

**Source:** <https://github.com/jamiew/monarch-mcp>
**Discovered:** 2026-07-08
**Viability:** 4/4

> Personal finance AI + Claude/LLM tooling — gives Claude live read/write access to connected financial accounts (transactions, budgets, net worth, spending trends) via the Monarch Money API; token-efficient design with natural-language date parsing and parallel multi-account queries.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

weekend_buildable: A Python FastMCP server wrapping a financial data API (Monarch Money, YNAB, or a personal CSV/SQLite source) is a proven 1-session build. The upstream repo is a full-rewrite reference; the MVP is 5–8 tools covering the most common queries (transactions, spending by category, account balances, budget status). Score 1.

fills_gap: The user has catalogued finance-related tools (finance-agent, expense-budget-tracker, FinPilot) but none of them give Claude live, read-write access to an actual connected financial service with multi-month trend analysis and natural-language date queries. "What did I spend on food last month compared to the month before?" requires real transaction data, not an empty tracker. Score 1.

novel: The token-efficient compact transaction format (80% smaller than raw API output), natural-language date parsing ("last month", "this year"), and parallel multi-account fan-out are not present in any finance tool previously catalogued. The FastMCP architecture (uvx install, MCP prompt library) is also a cleaner pattern than the Flask-based tools seen earlier. Score 1.

daily_utility: A daily "morning finance briefing" Claude prompt — "how much did I spend yesterday?", "am I on track for my grocery budget?" — would open this every session. The Monarch Money API (or YNAB/Plaid equivalent) makes this a real-data tool rather than a demo. Score 1.

---

## Overview

monarch-mcp is a Model Context Protocol server that gives Claude (and any MCP client) authenticated access to Monarch Money — a personal finance platform that aggregates bank accounts, credit cards, investments, and budgets.

**What Claude can do with it:**
- Natural-language transaction search: "find all Amazon purchases over $50 last quarter"
- Spending analysis: multi-month category breakdowns with trend comparison
- Budget monitoring: live budget vs. actual for any category
- Net worth snapshot: total assets, liabilities, and trend
- Transaction categorization: bulk-update categories via Claude
- Financial overview: a single tool that fans out to 5 Monarch APIs in parallel

**Token efficiency design (key upstream insight):**
- Default compact transaction format: `2026-07-01 | Trader Joe's | Groceries | -$42.50` — 80% smaller than the raw API JSON
- Categories return only `id+name` by default; full payload only when `verbose=true`
- Natural-language dates: "last month", "30 days ago", "Q2" all parsed server-side
- MCP prompts for guided workflows: "monthly spending review", "budget check", "find unusual charges"

## Stack Recommendation

For a personal build (using Monarch Money or adapting to YNAB/a CSV source):

- **Framework:** FastMCP (Python) — `uvx` install, decorator-based tool registration, built-in MCP prompt support.
- **API client:** `monarchmoney` Python package (PyPI) for Monarch; or `ynab` SDK; or direct SQLite queries for a CSV-based personal version.
- **Auth:** Monarch Money email/password → session token stored in `~/.monarch_mcp/token.json`; or YNAB personal access token in env var.
- **Install:** published to PyPI so `uvx monarch-mcp-<yourname>` works without a git clone.
- **Config:** Claude Desktop `claude_desktop_config.json` → `mcpServers` entry with `command: "uvx"`, `args: ["monarch-mcp-<yourname>"]`, `env: {"MONARCH_EMAIL": "...", "MONARCH_PASSWORD": "..."}`.

## MVP Scope

**In scope:**
- `get_overview` — parallel fan-out to accounts, recent transactions, budget summary, net worth; returns a single compact snapshot.
- `search_transactions` — date range (natural-language), amount range, merchant substring, category filter; compact format.
- `get_spending_by_category` — for a date range, group transactions by category with total + count.
- `get_budget_status` — current month budget vs. actual for each category.
- `get_account_balances` — all accounts with current balance and 30-day change.
- `update_transaction_category` — set category for a transaction ID (write operation).
- Natural-language date parser (utility function used by all tools).
- MCP prompts: "morning_briefing", "monthly_review".

**Out of scope for MVP:** investment performance tracking, goal monitoring, cash-flow forecasting, multi-user support.

## Implementation Phases

### Phase 1: FastMCP server skeleton + auth + overview tool
**Goal:** `uvx run . --python 3.12` starts the server; Claude Desktop can connect and call `get_overview`.

- `pyproject.toml`: `[project]` with `name`, `version`, `dependencies = ["fastmcp>=0.9", "monarchmoney>=0.7"]`; `[project.scripts] monarch-mcp = "monarch_mcp.server:main"`.
- `src/monarch_mcp/auth.py`: `MonarchSession` class — login with email/password, cache token to `~/.monarch_mcp/token.json`, refresh on 401.
- `src/monarch_mcp/server.py`: `mcp = FastMCP("Monarch Money")`. Register `get_overview` tool: async, calls `accounts()`, `get_transactions(limit=10)`, `get_budget_summary()`, `get_net_worth()` in parallel via `asyncio.gather()`; format as compact markdown summary.
- `src/monarch_mcp/formatters.py`: `format_transaction(t) → str` → `"YYYY-MM-DD | Merchant | Category | $Amount"`.

**Verify:** Claude Desktop → "Give me a financial overview" → gets a compact summary in under 2 seconds.

### Phase 2: Transaction search + spending analysis
**Goal:** Claude can answer "what did I spend on dining last month?" and "show me all transactions over $100 this week".

- `src/monarch_mcp/dates.py`: `parse_natural_date(s: str) → (start: date, end: date)` — handle "last month", "this year", "last 30 days", "Q2", ISO dates.
- `search_transactions(date_range, amount_min, amount_max, merchant, category, limit=50)`: call Monarch `get_transactions()` with filters; return compact format; add `verbose` flag for full JSON.
- `get_spending_by_category(date_range)`: fetch transactions, group by category, sort by total descending; return `| Category | Total | Count | Avg |` table.

### Phase 3: Budget monitoring + account balances
**Goal:** "Am I on budget this month?" and "what's my net worth breakdown?"

- `get_budget_status(month?)`: fetch Monarch budget data for the given month; for each category: `| Category | Budget | Spent | Remaining | % |`; flag over-budget rows.
- `get_account_balances()`: all accounts with name, type, current balance, 30-day delta; group by type (checking, savings, credit, investment).
- `update_transaction_category(transaction_id, category_id)`: write operation; confirm with Claude before executing (add a `dry_run=True` default).

### Phase 4: MCP prompts + natural-language UX polish
**Goal:** Claude can run guided workflows: "Run my morning briefing" → structured multi-step finance review.

- Add MCP prompts via `@mcp.prompt()`: `morning_briefing` (yesterday's transactions + budget status + account alerts), `monthly_review` (spending vs. last month + budget variance + top merchants).
- Improve date parser: "yesterday", "last week", "YTD", named months ("June", "last June").
- Add `get_top_merchants(date_range, limit=10)` tool: top 10 merchants by spend with total and transaction count.

### Phase 5 (optional): YNAB / CSV adapter layer
**Goal:** Make the server work without Monarch Money — swap in YNAB or a local CSV/SQLite data source.

- Abstract `MonarchSession` behind a `FinanceProvider` protocol with `get_transactions()`, `get_accounts()`, `get_budget()`.
- Implement `YNABProvider` (YNAB API, personal access token).
- Implement `CSVProvider` (flat CSV file + pandas/polars; no external auth needed).
- Config-driven: `FINANCE_PROVIDER=ynab|monarch|csv` env var.

## Estimated Effort

**1–2 Claude Code sessions.**

- **Session 1 — Phases 1 & 2:** Auth, server skeleton, overview, transaction search, spending analysis. After this session Claude can answer 80% of daily finance questions.
- **Session 2 — Phases 3 & 4:** Budget monitoring, balances, MCP prompts, UX polish. This makes it a complete daily-driver finance assistant.
- **Session 3 (optional) — Phase 5:** YNAB/CSV adapter for Monarch-free use.

## Potential Blockers

- **Monarch Money API stability:** the `monarchmoney` PyPI package reverse-engineers Monarch's private GraphQL API; if Monarch changes their schema or adds bot detection, the package may break. Pin a known-good version and have a fallback CSV export path ready.
- **Auth token caching:** storing credentials or session tokens in `~/.monarch_mcp/` requires appropriate file permissions (600). Add a check on startup and fail loudly if the file is world-readable.
- **Write operation safety:** `update_transaction_category` modifies real financial data. Default to `dry_run=True` (returns what would change without executing); require an explicit `dry_run=False` in the tool call for Claude to execute. Log all write operations to `~/.monarch_mcp/write_log.jsonl`.
- **Rate limiting:** Monarch's API may rate-limit aggressive parallel queries. Add `asyncio.sleep(0.1)` between the parallel `asyncio.gather()` calls and retry once on 429.
- **FastMCP version compatibility:** FastMCP's decorator API changed between 0.8 and 0.9. Pin `fastmcp>=0.9,<1.0` and verify the `@mcp.tool()` and `@mcp.prompt()` signatures against the current docs before starting.

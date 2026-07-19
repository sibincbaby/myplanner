# local-finance-mcp — local-first personal finance copilot

**Source:** <https://github.com/googlarz/taxde-skill>
**Discovered:** 2026-07-19
**Viability:** 4/4

> Seeded by *finance-assistant* (googlarz/taxde-skill, 33★, v3.14 July 6 2026) — a Claude Code skill that applies real statutory tax math (6 countries, 33 validated test cases) and runs FIRE Monte Carlo simulations locally. The build target here is a narrower, more conversational MVP: an MCP server that keeps a local SQLite ledger of your transactions, imports from bank CSV exports, and lets you talk to Claude in plain English to log expenses, query your spending, and get simple budget projections — all on-device with zero cloud.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

The finance toolkit so far — finance-agent, expense-budget-tracker, monarch-mcp, frugon — is either read-only (frugon), a full-stack web app (expense-budget-tracker), or broad analytics dashboards. None provide a low-friction conversational log-as-you-go workflow: type "spent ₹450 on lunch" into Claude and have it recorded, categorized, and instantly queryable. The MCP pattern makes this a 1-session build: a few MCP tools (add\_transaction, query, import\_csv, report) backed by a single SQLite file. Local-first means no auth, no API keys for the storage layer, and no privacy exposure of financial data. The googlarz project is the closest analog but requires a separate skill install and is oriented at complex tax math; the conversational expense-logging angle is open. 4/4, viable.

---

## Implementation Plan

## Overview

An MCP server (`local-finance`) that gives Claude three capabilities: **log** (natural-language expense entry → structured SQLite row), **query** (ask about spending patterns, categories, monthly totals), and **import** (ingest a bank CSV export and categorize rows). All state lives in `~/.local-finance/finance.db` (SQLite). No cloud, no auth, no separate backend — install the MCP server, add it to Claude Code or Claude Desktop, and start logging by chatting.

The MVP is: **add transaction via chat → query spending → import a bank statement CSV**. Tax math, FIRE projections, and multi-currency are out of scope for the MVP.

## Stack Recommendation

- **Runtime: Python 3.11+ with `mcp` SDK (official Anthropic Python MCP SDK).** Python's `csv` module, `sqlite3` stdlib, and the MCP SDK are all zero-extra-dependency for the core MVP. `uvicorn`/`stdio` transport both work; `stdio` is simplest for local use.
- **Storage: SQLite via `sqlite3` (stdlib).** One `~/.local-finance/finance.db` file. Schema: `transactions(id, date, amount, currency, category, description, source, created_at)`. No migrations needed for MVP — `CREATE TABLE IF NOT EXISTS` on startup.
- **LLM-side categorization: Claude itself.** The `add_transaction` tool accepts a freeform string; a short system-prompt fragment tells Claude to parse amount, date, and category from it before calling the tool. No separate NLP library.
- **CSV parsing: Python `csv` + heuristic column detection.** Detect date/amount/description columns by header keywords; fall back to first-3-columns assumption for unknown formats.
- **Install: `pipx install local-finance-mcp` or a single `uv tool install` one-liner.** Expose the MCP server as a console script entry point.

## MVP Scope

In:
- `add_transaction(description: str, amount: float, currency: str, date: str | None, category: str | None)` — insert a row; `date` defaults to today, `category` defaults to "uncategorized".
- `query_spending(period: str, category: str | None)` — return total and itemized list for a period string like "this month", "last 30 days", "July 2026".
- `import_csv(path: str, date_col: str | None, amount_col: str | None, desc_col: str | None)` — parse the file, preview the first 5 rows for Claude to confirm mapping, then bulk-insert.
- `list_categories()` — return all distinct categories seen in the ledger.
- `monthly_summary(month: str | None)` — income vs. expenses vs. top-5 categories for a month.

Out (later): recurring transaction detection, multi-currency conversion, budget targets with alerts, tax-aware categories (seeded by the googlarz project), bank API integration (Open Banking), export to CSV/PDF, a web dashboard.

## Implementation Phases

### Phase 1: MCP server scaffold + SQLite ledger
**Goal:** The MCP server starts, connects to Claude, and can store/retrieve transactions.
**Files to create/modify:**
- `local_finance_mcp/server.py` — MCP server entry point using `mcp.server.stdio.stdio_server()`; registers all tools.
- `local_finance_mcp/db.py` — SQLite connection management; `init_db()` creates the transactions table on first run; `add_tx()`, `query_tx()`, `list_cats()` basic CRUD.
- `local_finance_mcp/__main__.py` — `python -m local_finance_mcp` entry point.
- `pyproject.toml` — package definition with `[project.scripts]` entry for the `local-finance-mcp` command.
**Key steps:**
1. DB path: `Path.home() / ".local-finance" / "finance.db"`; create the directory if missing.
2. `init_db()` runs `CREATE TABLE IF NOT EXISTS` — idempotent on every startup.
3. Register the `add_transaction` and `query_spending` tools with proper JSON schema so Claude can call them without ambiguity.
**Verify:** Add the MCP server to Claude Desktop config; ask Claude "log ₹200 grocery expense yesterday" — confirm the row appears in the DB via `sqlite3 ~/.local-finance/finance.db "SELECT * FROM transactions"`.

### Phase 2: Natural-language query engine
**Goal:** Claude can answer spending questions like "how much did I spend on food this month?" correctly.
**Files to create/modify:**
- `local_finance_mcp/db.py` — `query_transactions(start_date, end_date, category)` that returns rows + aggregate totals.
- `local_finance_mcp/periods.py` — `parse_period(period_str)` converts "this month", "last 30 days", "July 2026", "this week" → `(start_date, end_date)` using `datetime`.
- `local_finance_mcp/server.py` — wire `query_spending` tool to `parse_period` + `query_transactions`, return a summary string.
**Key steps:**
1. `parse_period` must handle relative ("last 7 days") and absolute ("July 2026") without an NLP library — regex + `datetime` is sufficient for the common cases.
2. `query_spending` returns both totals AND a breakdown by category so Claude can surface insights ("you spent 60% on food").
3. For unknown period strings, return a clear error rather than silently returning all-time data.
**Verify:** After inserting a few test transactions with different categories and dates, ask Claude "what did I spend last month by category?" — confirm the numbers match `SELECT SUM(amount), category FROM transactions WHERE date >= '...' GROUP BY category`.

### Phase 3: CSV import
**Goal:** Import a bank statement export in one command from Claude.
**Files to create/modify:**
- `local_finance_mcp/importer.py` — `detect_columns(headers)` (keyword match for date/amount/description), `preview_csv(path)`, `import_csv(path, col_map)`.
- `local_finance_mcp/server.py` — `import_csv` MCP tool: calls `preview_csv`, returns a preview + detected column mapping for Claude to confirm, then calls `import_csv` with the confirmed mapping.
**Key steps:**
1. Two-phase import: preview first (Claude shows the user), then bulk insert on confirmation. Never auto-import without a preview step.
2. Amount parsing: handle negative (debit) and positive (credit) signs, strip currency symbols, handle comma-as-decimal-separator.
3. Deduplicate on `(date, amount, description)` hash to avoid double-import on re-run.
**Verify:** Export 10 transactions from a test bank CSV; import via Claude; confirm all 10 appear once (run import twice — no duplicates); confirm amounts and dates are parsed correctly.

### Phase 4: Monthly summary + install polish
**Goal:** A crisp `monthly_summary` report and a one-liner install that works on a fresh machine.
**Files to create/modify:**
- `local_finance_mcp/db.py` — `monthly_summary(year, month)`: total income (positive amounts), total expenses (negative), net, top-5 categories by spend.
- `local_finance_mcp/server.py` — `monthly_summary` tool; default month = current month if not specified.
- `README.md` — install one-liner (`pipx install local-finance-mcp`), MCP config snippet for Claude Code and Claude Desktop, quick-start examples ("Log a coffee", "Show last month", "Import statement.csv").
**Key steps:**
1. Income/expense split: positive amounts = income, negative = expenses. Absolute values in the expense total.
2. "Top 5 categories" output is a ranked list with percentage of total spend — useful without a chart.
3. Config snippet covers both `~/.claude/settings.json` (for Claude Code) and `~/Library/Application Support/Claude/claude_desktop_config.json` (for Claude Desktop).
**Verify:** Insert a mix of income and expense rows for a month; call `monthly_summary`; confirm income/expense/net are arithmetically correct; run `pipx install` from the packed wheel and confirm the MCP server connects to Claude Desktop without additional setup.

## Estimated Effort

**1–2 Claude Code sessions.**
- **Session 1:** Phases 1–2 — MCP scaffold, SQLite ledger, `add_transaction`, `query_spending`. This is the daily-use core.
- **Session 2:** Phases 3–4 — CSV import, monthly summary, install polish. The import phase is the most error-prone (CSV format diversity) and benefits from a dedicated session.

## Potential Blockers

- **CSV format diversity.** Every bank exports a slightly different format: date formats (DD/MM/YYYY vs YYYY-MM-DD), header names ("Transaction Date" vs "Date"), amount columns (one "Amount" with sign vs separate "Debit"/"Credit"). The heuristic column detection will miss edge cases. Mitigate: the two-phase import (preview + confirm) gives Claude a chance to surface misdetections; add a `col_map` override parameter so the user can specify columns explicitly.
- **Negative vs. positive amount convention.** Some banks export debits as negative, some as positive. Parse sign and a "debit/credit" flag column if present; default to "negative = expense" with an `invert_amounts` config option.
- **SQLite file locking.** If Claude Code and Claude Desktop both have the MCP server running simultaneously, they'll share the same DB file. SQLite's WAL mode handles concurrent reads well; writes serialize automatically. Enable WAL on `init_db()` (`PRAGMA journal_mode=WAL`) to avoid "database is locked" errors.
- **Period string ambiguity.** "Last month" is clear; "Q1" or "this financial year" are not. For MVP, handle only the common cases (`today`, `this week`, `this month`, `last N days`, `<Month> <Year>`); for anything else, return a `"Period not understood; try 'last 30 days' or 'July 2026'"` error rather than silently returning wrong data.
- **Privacy.** The DB lives at `~/.local-finance/finance.db` — not git-ignored by default. The README should prominently note: add `~/.local-finance/` to your global `.gitignore`, and never add this file to a repository.

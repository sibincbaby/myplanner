# Leviai-ai/personal-finance-mcp

**Source:** <https://github.com/Leviai-ai/personal-finance-mcp>
**Discovered:** 2026-09-20
**Viability:** 3/4

> Directly addresses personal finance AI interest. Ready-to-use MCP server means Claude can immediately become a finance assistant — no custom build needed. Freemium model with a $12/month premium tier suggests a viable product pattern for your own Flutter finance AI app.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

weekend_buildable=1: An MCP server with SQLite backend is a well-understood pattern. The scope is clearly defined — transactions, budgets, savings goals, spending analysis — and Claude can scaffold this fully in a focused 1-2 session sprint. No specialized infrastructure needed. fills_gap=1: The user's interest profile explicitly calls out "Personal finance AI: expense tracking, budget analysis, card management tools" as an active area. An MCP server brings a new architectural angle — AI-native access to personal finance data directly inside Claude Desktop — which is distinct from standalone finance apps they may already have. novel=1: MCP as a protocol is young (2024), and personal finance MCP servers are sparse and immature. The privacy-first local SQLite approach avoids cloud sync dependencies that existing polished tools (YNAB, Firefly III) require, making it genuinely distinct for Claude-integrated workflows. daily_utility=0: Personal finance review is a weekly or transactional habit for most people, not a daily open-every-morning workflow. Even with Claude Desktop integration, budget checks and transaction entry don't rise to daily-driver frequency the way a coding assistant or diary tool would.

---

## Implementation Plan

## Overview

A Model Context Protocol (MCP) server that turns Claude into a personal finance assistant. The server exposes tools for transaction entry, budget management, savings goal tracking, and spending analysis — all backed by a local SQLite database. Once registered in Claude Desktop or Cursor, Claude can query and mutate finance data directly during conversation without any web service or cloud sync.

The reference repo (Leviai-ai/personal-finance-mcp) is the inspiration, not the base. This plan builds a clean, fully-owned implementation.

## Stack Recommendation

- **Runtime:** Python 3.11+ with `uv` for dependency management
- **MCP SDK:** `mcp` (Anthropic's official Python SDK, `pip install mcp`)
- **Database:** SQLite via `sqlite3` (stdlib) + `aiosqlite` for async access
- **Schema migrations:** plain SQL files, applied at startup
- **Config:** single `config.json` for DB path and alert thresholds
- **Testing:** `pytest` + `pytest-asyncio`
- **Packaging:** `pyproject.toml`, runnable via `uvx` or `python -m finance_mcp`

Python is the right call here: the MCP Python SDK is mature, SQLite async support is trivial, and the entire server fits in one focused package with no build step.

## MVP Scope

- Four account types: checking, savings, credit, investment
- Transaction CRUD with category tagging
- Monthly budgets per category with overspend alerts returned inline
- Savings goals with progress tracking
- Spending analysis: category breakdown, monthly trend, top merchants
- All data in `~/.finance_mcp/finance.db` by default
- MCP tools (not resources) so Claude can call them as actions

Out of scope for MVP: recurring transactions, multi-currency, import from CSV/OFX, authentication.

## Implementation Phases

### Phase 1: Project Scaffold and Database Layer

**Goal:** A runnable Python package with a versioned SQLite schema that opens cleanly and passes schema-integrity tests.

**Files to create/modify:**
- `pyproject.toml` — package metadata, dependencies (`mcp>=1.0`, `aiosqlite>=0.19`)
- `finance_mcp/__init__.py` — package marker
- `finance_mcp/db.py` — async DB wrapper: `get_db()`, `init_db()`, migration runner
- `finance_mcp/schema/001_initial.sql` — accounts, transactions, budgets, savings_goals tables
- `finance_mcp/schema/002_categories.sql` — seed category list
- `tests/test_db.py` — schema smoke test

**Key steps:**
1. Run `uv init finance-mcp && cd finance-mcp` then edit `pyproject.toml` to add `mcp`, `aiosqlite`, `pytest`, `pytest-asyncio` under `[project.dependencies]` and `[tool.pytest.ini_options]` with `asyncio_mode = "auto"`.
2. Write `001_initial.sql` with these tables: `accounts (id, name, type CHECK(type IN ('checking','savings','credit','investment')), balance, currency, created_at)`, `transactions (id, account_id FK, amount, description, category, merchant, date, notes, created_at)`, `budgets (id, category, monthly_limit, month TEXT, created_at)`, `savings_goals (id, name, target_amount, current_amount, deadline, created_at)`.
3. In `db.py` implement `init_db(db_path)`: create parent dirs, open aiosqlite connection, read and execute each `schema/*.sql` file in numeric order only if the migration hasn't been recorded in a `_migrations` table.
4. Write `tests/test_db.py`: call `init_db` with a temp path, assert all four tables exist via `SELECT name FROM sqlite_master WHERE type='table'`, assert idempotent (calling twice doesn't error).
5. Run `uv run pytest tests/test_db.py -v` and confirm green.

**Verify:** `uv run pytest tests/test_db.py -v` shows 2+ passing tests, no errors.

---

### Phase 2: Core MCP Tools — Accounts and Transactions

**Goal:** Claude Desktop can add accounts and log transactions via MCP tool calls.

**Files to create/modify:**
- `finance_mcp/server.py` — MCP server instance, tool registration, startup
- `finance_mcp/tools/accounts.py` — `add_account`, `list_accounts`, `get_account_balance`
- `finance_mcp/tools/transactions.py` — `add_transaction`, `list_transactions`, `delete_transaction`
- `finance_mcp/__main__.py` — entry point: `asyncio.run(main())`
- `tests/test_tools_accounts.py`
- `tests/test_tools_transactions.py`

**Key steps:**
1. In `server.py`, instantiate `mcp.Server("personal-finance")`, call `init_db()` in the lifespan handler. Register tools with `@server.tool()` decorators; each tool function takes typed Pydantic-style arguments and returns a string or dict.
2. Implement `add_account(name: str, type: str, initial_balance: float = 0.0, currency: str = "USD") -> str`: INSERT into accounts, return `f"Account '{name}' created with id {id}"`.
3. Implement `list_accounts() -> list[dict]`: SELECT all accounts, return list of dicts with `id, name, type, balance, currency`.
4. Implement `add_transaction(account_id: int, amount: float, description: str, category: str, date: str, merchant: str = "", notes: str = "") -> str`: INSERT transaction, UPDATE account balance (subtract for credit accounts, add otherwise), return confirmation string including new balance.
5. Implement `list_transactions(account_id: int = None, category: str = None, start_date: str = None, end_date: str = None, limit: int = 50) -> list[dict]`: build parameterized SELECT with optional WHERE clauses, return rows.
6. In `__main__.py`: `from finance_mcp.server import server; server.run(transport="stdio")`.
7. Write tool tests using a shared `tmp_db` fixture; test round-trip add+list for both accounts and transactions.

**Verify:** `uv run python -m finance_mcp` starts without error (hangs on stdin — that's correct for stdio MCP). `uv run pytest tests/test_tools_*.py -v` passes.

---

### Phase 3: Budgets and Overspend Alerts

**Goal:** Setting a budget for a category causes `add_transaction` to return an inline overspend warning when the monthly total exceeds the limit.

**Files to create/modify:**
- `finance_mcp/tools/budgets.py` — `set_budget`, `list_budgets`, `get_budget_status`
- `finance_mcp/tools/transactions.py` — modify `add_transaction` to call `check_budget_alert`
- `finance_mcp/alerts.py` — `check_budget_alert(db, category, month) -> str | None`
- `tests/test_budgets.py`

**Key steps:**
1. Implement `set_budget(category: str, monthly_limit: float, month: str = None) -> str`: month defaults to current `YYYY-MM`. UPSERT into budgets (INSERT OR REPLACE). Return confirmation.
2. Implement `get_budget_status(month: str = None) -> list[dict]`: JOIN budgets with SUM of transactions for that month+category, return `[{category, limit, spent, remaining, pct_used}]`.
3. In `alerts.py`, `check_budget_alert`: query total spending for the category in the current month, compare to budget limit if one exists, return a warning string like `"⚠ OVERSPEND: Groceries $340 of $300 budget (113%)"` or `None`.
4. Modify `add_transaction` to call `check_budget_alert` after INSERT and append any alert to the return string: `f"Transaction added. {alert or ''}"`.
5. In test: create a $100 Groceries budget, add $80 transaction (no alert), add $30 more (alert fires), assert alert text in return value.

**Verify:** `uv run pytest tests/test_budgets.py -v` passes, including the overspend alert assertion.

---

### Phase 4: Savings Goals and Spending Analysis

**Goal:** Claude can create savings goals, contribute to them, and ask for a full spending breakdown — all returning structured data.

**Files to create/modify:**
- `finance_mcp/tools/savings.py` — `create_savings_goal`, `contribute_to_goal`, `list_savings_goals`
- `finance_mcp/tools/analysis.py` — `spending_by_category`, `monthly_trend`, `top_merchants`
- `tests/test_savings.py`
- `tests/test_analysis.py`

**Key steps:**
1. Implement `create_savings_goal(name: str, target_amount: float, deadline: str = None) -> str`: INSERT, return id + summary.
2. Implement `contribute_to_goal(goal_id: int, amount: float) -> str`: UPDATE `current_amount += amount`, return `f"Goal '{name}': ${current}/{target} ({pct}%)"`. If `current >= target` append `"GOAL REACHED!"`.
3. Implement `spending_by_category(start_date: str = None, end_date: str = None) -> list[dict]`: `SELECT category, SUM(amount) as total, COUNT(*) as txn_count FROM transactions WHERE ... GROUP BY category ORDER BY total DESC`. Default date range: current month.
4. Implement `monthly_trend(months: int = 6) -> list[dict]`: `SELECT strftime('%Y-%m', date) as month, SUM(amount) as total FROM transactions GROUP BY month ORDER BY month DESC LIMIT ?`.
5. Implement `top_merchants(limit: int = 10, start_date: str = None) -> list[dict]`: group by merchant, sum amount, return top N.
6. Register all new tools in `server.py`.

**Verify:** `uv run pytest tests/test_savings.py tests/test_analysis.py -v` passes. Manually run `uv run python -m finance_mcp` and confirm no import errors on startup.

---

### Phase 5: Claude Desktop Integration and Polish

**Goal:** The server is registered in Claude Desktop, Claude can invoke all tools conversationally, and a README documents setup in under 5 minutes.

**Files to create/modify:**
- `README.md` — install steps, Claude Desktop JSON config block, example prompts
- `finance_mcp/config.py` — load `~/.finance_mcp/config.json`, expose `DB_PATH`, `ALERT_THRESHOLD_PCT`
- `claude_desktop_config_snippet.json` — copy-paste config block
- `pyproject.toml` — add `[project.scripts] finance-mcp = "finance_mcp.__main__:main"`
- `tests/test_server_smoke.py` — import server, call `list_tools`, assert expected tool names present

**Key steps:**
1. Add `finance_mcp/config.py`: read `~/.finance_mcp/config.json` if it exists, fall back to defaults `DB_PATH = Path.home()/".finance_mcp"/"finance.db"`, `ALERT_THRESHOLD_PCT = 80`. Replace hardcoded path in `db.py`.
2. Write `claude_desktop_config_snippet.json`:
   ```json
   {
     "mcpServers": {
       "personal-finance": {
         "command": "uvx",
         "args": ["--from", ".", "finance-mcp"]
       }
     }
   }
   ```
   Document merging this into `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).
3. Add a `list_tools` smoke test: `from finance_mcp.server import server; tools = server.list_tools(); names = [t.name for t in tools]; assert "add_transaction" in names`.
4. Run `uv build` to verify the package builds cleanly, then `uv run finance-mcp` to confirm the console script entry point works.
5. Write 5 example prompts in README: "Add a $45 grocery purchase at Trader Joe's to my checking account", "What did I spend on dining last month?", "Set a $500 budget for groceries this month", "How close am I to my vacation savings goal?", "Show me my top 5 merchants this year".

**Verify:** Restart Claude Desktop, open a new conversation, type "list my accounts" — Claude should invoke `list_accounts` and return results (or an empty list on a fresh DB). `uv run pytest` (full suite) green.

---

## Estimated Effort

**2 Claude Code sessions**

- **Session 1 (Phases 1–3):** Scaffold, schema, DB layer, account/transaction tools, budget alerts. This is the critical path — get data flowing and alerts working. ~3 hours of Claude work.
- **Session 2 (Phases 4–5):** Savings goals, spending analysis tools, Claude Desktop wiring, config file, full test suite pass, README. ~2 hours of Claude work.

## Potential Blockers

- **MCP SDK version drift:** The `mcp` Python package API changed significantly between 0.x and 1.x. Pin `mcp>=1.0,<2.0` in `pyproject.toml` and verify `@server.tool()` decorator syntax against the installed version's source before writing all tools — a 30-minute mistake if done after.
- **Async SQLite in MCP lifecycle:** `aiosqlite` connections must be opened inside the async event loop. If `init_db` is called at module import time (outside `async def`), it will fail silently or raise a RuntimeError. Use MCP's lifespan context (`@server.lifespan`) to open the DB connection once and inject it into tool handlers via a module-level variable or context var.
- **Claude Desktop config merge:** Claude Desktop reads a single JSON file; if the user already has other MCP servers configured, a naive file replace will break them. The README must show a diff-style merge, not a full-file replacement.
- **Date handling edge cases:** SQLite stores dates as TEXT. If a user passes `"today"` or a locale-formatted date instead of `YYYY-MM-DD`, queries silently return empty results. Add a date normalization helper at the tool layer and document the expected format clearly in each tool's description string.
- **Credit account balance sign convention:** Credits decrease net worth; checking/savings increase it. The `add_transaction` balance update logic must branch on account type. Getting this wrong corrupts balance data silently — write an explicit test for each account type in Phase 2.

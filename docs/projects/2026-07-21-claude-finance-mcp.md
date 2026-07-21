# Claude Finance MCP

> Bank-connected personal finance MCP: ask Claude about your spending, budgets, and account balances in plain English

**Inspired by:** [personal-finance-mcp (Leviai)](https://github.com/Leviai-ai/personal-finance-mcp) · [personal-finance-mcp (zrabin)](https://github.com/zrabin/personal-finance-mcp)  
**Date discovered:** 2026-07-21

---

## What gap it fills

The July 19 *Local Finance MCP* plan was broader and more ambitious. This project is narrower and immediately shippable: a minimal Python MCP server that ingests bank CSV exports + Venmo CSV → SQLite, then gives Claude 6 focused tools to query the data conversationally. No Teller API dependency for the MVP — start with CSV imports that any bank supports.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| MCP server | Python + `fastmcp` | Zero boilerplate, auto-generates tool schemas |
| Storage | SQLite (via `aiosqlite`) | No server to run, single file, queryable by AI |
| Bank ingestion | CSV parser + heuristic column mapper | Works with Chase, Wise, Revolut, Monzo exports |
| Optional live sync | Teller API | Free for personal use; requires registration |
| Runtime | `uv` (no pip install) | Fast, reproducible, Claude Code can spin it up instantly |

## MVP scope (1 Claude session)

Six MCP tools:
1. `import_transactions(csv_path, account_name)` — parse and deduplicate
2. `log_transaction(amount, category, description, date?)` — manual entry
3. `get_spending_by_category(month?)` — returns ranked category totals
4. `get_balance(account?)` — running balance per account
5. `set_budget(category, monthly_limit)` — store a limit
6. `check_budget_status()` — compare YTD spend vs limits, flag over-budget categories

Out of scope for MVP: charts, web UI, Teller API, recurring transaction detection.

## Phases

### Phase 1 — Schema + ingestion (2 h)
- `transactions(id, date, amount, description, category, account, raw_csv_row)`
- `budgets(category, monthly_limit)`
- CSV parser that auto-detects column names for the 5 most common UK/US bank exports
- Deduplicate by `(date, amount, description)` hash

### Phase 2 — MCP server skeleton (1 h)
- `fastmcp` server with `@mcp.tool` decorators
- All 6 tools wired to SQLite queries
- `claude mcp add` compatible `pyproject.toml`

### Phase 3 — Categorisation (1.5 h)
- Keyword → category mapping table seeded with 80 common merchants
- Claude fallback: for uncategorised transactions, call Claude to suggest a category
- User can override via `log_transaction` or a `recategorise` tool

### Phase 4 — Budget alerts (0.5 h)
- `check_budget_status` returns structured JSON: `{category, limit, spent, pct_used, over_budget}`
- Optional: hook into Claude Code's notification system to surface alerts daily

### Phase 5 — Teller API sync (optional, 2 h)
- `sync_account(account_id)` tool calls Teller API and upserts transactions
- OAuth flow handled via a one-time CLI step

## Effort estimate

~5 hours for MVP (Phases 1–4) · 1 focused Claude session  
~7 hours with Teller sync

## Blockers / risks

- **CSV column variation**: banks name columns inconsistently (`Date`, `Transaction Date`, `Posted Date`). Mitigation: heuristic mapper + user-supplied column override flag.
- **Teller API approval**: Teller requires manual approval for production accounts. Mitigation: MVP uses CSV import only; Teller is Phase 5.
- **Currency**: MVP assumes single currency; multi-currency is a separate phase.

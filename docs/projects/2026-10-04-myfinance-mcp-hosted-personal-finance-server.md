# MyFinance MCP — Hosted Personal Finance MCP Server

**Source:** <https://github.com/alex-odoo/myfinance-mcp>
**Discovered:** 2026-10-04
**Viability:** 4/4

> A hosted MCP server (TypeScript + Express + Prisma + PostgreSQL) with 28 tools for personal finance: log expenses, track budgets, import bank statements, report net worth, and query transaction history. Supports OAuth 2.1 with PKCE so it works as a native claude.ai connector — log expenses in a claude.ai chat without opening a terminal.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

Prior plans in this repo (Local Finance MCP, Claude Finance MCP from July 2026) were terminal/local-only. This one is hosted with a claude.ai connector, which changes the workflow: you can log expenses mid-conversation in the web app, on mobile, without `claude mcp` in a terminal. The MVP described below is local-first (SQLite instead of Postgres, no OAuth for day-1) but adds a proper HTTP transport that can be promoted to hosted later. 5-8 core tools in 1-2 sessions.

---

## Implementation Plan

**2 Claude Code sessions** to a locally-hosted MCP server with expense logging, budget tracking, and monthly summaries integrated into claude.ai.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Same as original; MCP SDK is TS-native |
| Transport | HTTP + SSE (Streamable HTTP) | Required for claude.ai connector |
| MCP SDK | `@modelcontextprotocol/sdk` | Official, supports Streamable HTTP |
| Storage | SQLite via `better-sqlite3` | Local-first; swap to Postgres later |
| Web framework | Express | Minimal; original uses it |
| Auth (stretch) | OAuth 2.1 + PKCE | Required for production claude.ai connector |

---

## MVP Scope

**8 core tools:**
- `log_expense(amount, currency, category, description?, date?)` — insert a transaction
- `get_balance(period?)` — income minus expenses for a period
- `get_monthly_summary(year, month)` — total by category + top 5 expenses
- `set_budget(category, amount, period)` — upsert a budget limit
- `check_budgets()` — list categories over/under budget this month
- `search_transactions(query?, category?, from_date?, to_date?)` — FTS5 + filter
- `get_net_worth()` — assets minus liabilities (manually configured)
- `list_categories()` — returns known categories with monthly totals

Out of scope for MVP: bank CSV import, OAuth 2.1, multi-currency exchange rates.

---

## Implementation Phases

### Phase 1: Schema, core CRUD tools, and `log_expense` / `get_monthly_summary`

**Goal:** Running MCP server with the two most-used tools.

**Files:**
- `package.json`, `tsconfig.json`
- `src/db.ts` — `openDb()`, migrations
- `src/tools/expenses.ts` — `logExpense`, `searchTransactions`
- `src/tools/reports.ts` — `getBalance`, `getMonthlySummary`, `listCategories`
- `src/index.ts` — Express + MCP Streamable HTTP server on port 3456

**Key steps:**
1. Schema:
   ```sql
   CREATE TABLE transactions (
     id INTEGER PRIMARY KEY,
     amount REAL NOT NULL,
     currency TEXT DEFAULT 'USD',
     category TEXT NOT NULL,
     description TEXT,
     date TEXT DEFAULT (date('now')),
     created_at TEXT DEFAULT (datetime('now'))
   );
   CREATE VIRTUAL TABLE transactions_fts USING fts5(description, content=transactions, content_rowid=id);
   ```
2. `logExpense`: insert and keep FTS5 in sync via triggers.
3. `getMonthlySummary`: `SELECT category, SUM(amount) as total FROM transactions WHERE strftime('%Y-%m', date)=? GROUP BY category ORDER BY total DESC`.
4. MCP transport: mount `createServer()` on `POST /mcp` (Streamable HTTP), with CORS for claude.ai.
5. Add to claude.ai: Settings → Connectors → Add → URL `http://localhost:3456/mcp`.

**Verify:** `log_expense({amount:12.50, category:'food', description:'lunch'})` returns success. `get_monthly_summary` returns the logged expense.

---

### Phase 2: Budgets, balance, net worth, search

**Goal:** Full 8-tool set working.

**Files:**
- `src/tools/budgets.ts` — `setBudget`, `checkBudgets`
- `src/tools/networth.ts` — `getNetWorth` (reads from a JSON config file)

**Key steps:**
1. Budgets table:
   ```sql
   CREATE TABLE budgets (category TEXT, period TEXT, amount REAL, PRIMARY KEY(category, period));
   ```
2. `checkBudgets`: join `budgets` with `transactions` aggregated for current period, compute % used.
3. `getNetWorth`: reads `~/.myfinance/networth.json` (`{assets: {name:amount}, liabilities: {name:amount}}`); returns sum. If file missing, returns `{message: 'run /vault-add to set up net worth config'}`.
4. `searchTransactions`: FTS5 match on description + optional category / date range filter.
5. `listCategories`: `SELECT DISTINCT category FROM transactions ORDER BY category`.

**Verify:** Set a food budget of $200, log $190 of food expenses, call `check_budgets()` → "food: 95% used".

---

### Phase 3: Auto-categorisation via Claude and CSV import

**Goal:** Expenses typed in plain language get auto-categorised; basic CSV import from a bank statement.

**Files:**
- `src/tools/categorise.ts` — `autoCategory(description)` via `claude-haiku`
- `src/tools/import.ts` — `importCsv(csvText, formatHint?)` tool

**Key steps:**
1. `autoCategory`: call Anthropic SDK with a one-shot prompt mapping a description to one of the known categories. Cache results in SQLite with a `category_cache` table.
2. `importCsv`: accept CSV text (pasted or from `$.fs.read`). Ask Claude to parse the format (date, amount, description columns vary by bank). Insert rows via `logExpense`.
3. Extend `log_expense` to call `autoCategory` when `category` is omitted.

**Verify:** `log_expense({amount:45, description:'Spar grocery run'})` → category auto-set to `food`.

---

## Estimated Effort

About 2 Claude Code sessions.
- **Session 1 (≈ 2.5 h):** Phases 1-2. Schema, all 8 tools, Express + MCP transport, claude.ai connector test.
- **Session 2 (≈ 2 h):** Phase 3. Auto-categorisation, CSV import, and optionally OAuth 2.1 for production hosting.

## Potential Blockers

- **Streamable HTTP transport:** The MCP SDK's HTTP transport requires `POST /mcp` with `Content-Type: application/json` and a matching `GET /mcp` for SSE. Double-check the SDK's `createExpressServer` helper vs manual Express mounting.
- **claude.ai connector auth:** For localhost, claude.ai may require HTTPS (use `mkcert`). For production, OAuth 2.1 is mandatory; the original has an implementation to reference.
- **FTS5 triggers:** Content-table FTS5 requires `INSERT`, `UPDATE`, and `DELETE` triggers to keep the shadow table in sync. Missing triggers cause stale search results.
- **Currency handling:** `amount` is stored as REAL in the base currency. Add a `currency` column but defer exchange-rate conversion to avoid complexity in MVP.

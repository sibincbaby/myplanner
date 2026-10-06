# Fin — MCP Server for Personal Finance Management

**Source:** <https://github.com/looph0le/fin>
**Discovered:** 2026-10-06
**Viability:** 3/4

> A lightweight, LLM-native MCP server for personal finance. Features multi-account tracking with balance history, auto-categorized transactions, monthly budgets, recurring items, loan amortization schedules, comprehensive spending reports, and salary allocation. Designed to be queried entirely through natural language via any MCP-compatible AI agent.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

Fin sits between MyFinance MCP (Oct 4, cloud-hosted, 28 tools for expense tracking) and finlynq (Oct 5, full FIRE/Monte Carlo planning). Fin is lighter and local-only: a stdio MCP server with a SQLite backend, no Docker, no cloud. The gap it fills is low-friction daily transaction logging — you log a transaction by typing "spent €42 at Lidl" in Claude chat with zero context switching. Novel because it's the only MCP-first finance tool that handles both multi-account balances and loan amortization in a minimal footprint. Daily utility is 0 because like finlynq, the high-value interactions (budget review, loan schedule) happen weekly, not every session.

---

## Implementation Plan

**1 Claude Code session** to install, seed with starting balances, and wire to Claude Desktop.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Deploy | `npx fin-mcp` (stdio) | Zero-install, starts as a subprocess |
| Storage | SQLite (bundled) | Local, no server needed |
| Integration | Claude Desktop `settings.json` | Finance queries feel natural outside a code session |
| Data seeding | Manual via Claude chat | Log starting balances and last 30 days via NL |

---

## MVP Scope

1. Add Fin to Claude Desktop `settings.json` as an MCP server
2. Create checking and savings accounts with current balances
3. Log the last 30 days of transactions from memory or bank statement
4. Set up monthly budgets for groceries, dining, transport, and entertainment
5. Verify: "What did I spend on dining last month?" returns a correct answer

Out of scope for MVP: CSV import, bank API connections, Plaid integration, recurring reminders.

---

## Implementation Phases

### Phase 1: MCP installation + account setup

**Goal:** Fin MCP running in Claude Desktop with basic accounts created.

**Steps:**
1. In Claude Desktop `settings.json`, add:
   ```json
   {
     "mcpServers": {
       "fin": {
         "command": "npx",
         "args": ["-y", "fin-mcp"],
         "env": {
           "FIN_DB_PATH": "~/.fin/finance.db"
         }
       }
     }
   }
   ```
2. Restart Claude Desktop; verify "fin" appears in the tool picker
3. In Claude chat: "Create a checking account called 'Main Checking' with balance €2,450" → confirm created
4. "Create a savings account called 'Emergency Fund' with balance €8,200" → confirm
5. "List all my accounts with balances" → verify both appear

---

### Phase 2: Transaction backfill + categorization

**Goal:** Last 30 days of transactions logged and auto-categorized.

**Steps:**
1. Export last 30 days from your bank as CSV (or review PDF statement)
2. In Claude chat: "Log these transactions for October: €42 Lidl groceries on Oct 1, €85 restaurant on Oct 3..." (batch-paste a list)
3. Verify auto-categorization: "Show my October transactions grouped by category" — check that Lidl → Groceries, restaurant → Dining, etc.
4. Add custom categorization rule: "Any transaction with 'Spotify' in description should be categorized as Entertainment"
5. Test: "What was my total spending in September?" → confirm totals are reasonable

---

### Phase 3: Budgets + recurring items

**Goal:** Monthly budgets set and recurring bills tracked.

**Steps:**
1. "Set a monthly budget of €400 for Groceries, €150 for Dining, €100 for Transport, €50 for Entertainment"
2. "Add a recurring item: Rent €850, due 1st of each month, category Housing"
3. "Add a recurring item: Spotify €9.99, due 15th, category Entertainment"
4. "How am I tracking against my budgets this month?" → confirm Fin returns a budget vs. actual comparison
5. Set a loan: "I have a car loan of €12,000 at 4.5% interest, 48-month term, started July 2024 — add it with monthly payment schedule"

---

### Phase 4: Salary allocation setup

**Goal:** Monthly income and savings allocation configured.

**Steps:**
1. "Set my monthly net salary to €3,200, paid on the 25th"
2. "Allocate: 30% to savings, 20% to investments, remaining to expenses"
3. Verify: "Show me my allocation breakdown for this month" → confirm percentages and amounts
4. End-of-month check: "How much of my budget remains in each category?" → bookmark this as a monthly ritual

---

## Estimated Effort

About 1 Claude Code session (2 hours), mostly data entry.

- **15 min:** MCP install + account setup
- **45 min:** Transaction backfill (30 days)
- **30 min:** Budgets + recurring items + loan
- **30 min:** Salary allocation + monthly check flow

## Potential Blockers

- **Overlap with recent projects:** finlynq (Oct 5) covers FIRE + Monte Carlo + portfolio. MyFinance MCP (Oct 4) covers cloud-hosted expense tracking. Fin is the local-only middle ground. If you already deployed either of those, evaluate whether a third finance MCP adds confusion or value before installing.
- **SQLite path expansion:** `~` in `FIN_DB_PATH` may not expand correctly on some systems. Use the full absolute path (e.g., `/Users/yourname/.fin/finance.db`) to be safe.
- **Early-stage, small community:** Fin has a small star count. Expect missing features in the loan amortization schedule (early repayment scenarios may not be implemented). File an issue if you hit a gap.
- **No CSV import:** Data backfill is manual or via Claude chat. If you have more than 60 days of transactions to import, consider writing a short script to call Fin's MCP tools in batch rather than pasting everything manually.

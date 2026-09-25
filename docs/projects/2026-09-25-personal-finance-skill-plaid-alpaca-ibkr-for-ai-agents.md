# Personal Finance Skill — Plaid + Alpaca + IBKR for AI Agents

**Source:** <https://github.com/6missedcalls/personal-finance-skill>
**Discovered:** 2026-09-25
**Viability:** 4/4

> Ask Claude Code "what did my portfolio do this week, and did any subscriptions renew?" and get an answer sourced from your actual bank account and brokerage in one shot — not a spreadsheet, not a CSV import, live data from Plaid, Alpaca, and IBKR via a single agent skill.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

**Weekend-buildable (1):** Plaid has a sandbox environment with fake bank data and a free developer tier. Alpaca has a paper trading API with no real money required. Phase 1 (bank transactions via Claude Code) is buildable in one session with no production API access.

**Fills a gap (1):** The existing finance plans (expense-budget-tracker Sep 16, leviai-ai-personal-finance-mcp Sep 20, finance-assistant Aug 4) cover expense tracking and budgeting. None connect to a brokerage. The gap is: brokerage portfolio + bank account + tax estimation in one agent skill you can query in natural language.

**Novel (1):** `tomfunk/fungible` (108★) is the standing superset kill for expense tools: TUI + GUI, Plaid sync, CSV import, AI assistant, MCP server. What fungible does not have: Alpaca paper/live trading, IBKR position tracking, SEC filing analysis, social sentiment for tickers. The trading layer is the novelty; the expense-tracking half alone would not clear the bar.

**Daily utility (1):** Daily if you want a morning financial brief ("P&L since yesterday, any subscriptions renewed, any limit orders filled"). Weekly is the floor — portfolio review and spending check are weekly habits for most.

---

## Lane Note

**Finance is a saturated lane.** Seven plans already on file (claude-financial-dashboard Sep 10, expense-budget-tracker Sep 16, leviai-ai-personal-finance-mcp Sep 20, finance-assistant Aug 4, financial-planning-agent Aug 5, copilot-money-mcp Aug 2, claude-finance-mcp Jul 21). This plan is admitted only because the Alpaca/IBKR trading layer is genuinely absent from all prior plans. If you do not have a brokerage account or have no interest in portfolio tracking, this is a kill — use fungible or leviai instead.

---

## Implementation Plan

## Overview

An agent skills protocol skill with three independently usable extensions:

1. **Banking (Plaid):** connect a bank account (sandbox first), list transactions, categorize spending, detect recurring subscriptions, query in natural language.
2. **Trading (Alpaca):** connect a paper (or live) account, get portfolio overview, list recent trades, set price alerts.
3. **Tax estimation:** given a year's transactions, estimate quarterly tax liability for self-employed income (US, UK, DE as Phase 4).

Extensions 1 and 2 are independent — you can build and use either without the other.

## Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript 5+, Node.js 18+ | matches upstream; Plaid and Alpaca SDKs are TS-first |
| Skill protocol | Agent Skills Protocol (`.claude/commands/` + MCP) | the upstream approach; works with Claude Code, Cursor, Codex |
| Bank data | Plaid SDK (`plaid-node`) + sandbox credentials | no real bank needed for v1; sandbox has 40+ fake institutions |
| Trading data | `@alpacahq/typescript-sdk` | Alpaca's official TS SDK; paper trading is free |
| Storage | Local SQLite or JSON file | cache fetched data; avoid hitting API limits on every query |
| Auth | `.env` file with API keys | simplest for a personal-use tool; do not commit |

## MVP Scope

**In:**

1. Plaid sandbox connection: authenticate, list the last 30 days of transactions, categorize them by Plaid's taxonomy.
2. Natural language query via Claude Code: "what did I spend on food this month?", "any subscriptions that renewed this week?", "show my top 5 merchants".
3. A `/finance` command that runs the morning brief: total spent this week, total income this week, any recurring charges detected.

**Out of v1:** Alpaca/IBKR connection, tax estimation, multi-currency, multi-account linking, chart generation.

## Phases

**Phase 1 — Plaid sandbox: transactions and categories (≈2 hours).**
Install `plaid-node`. Create a sandbox Plaid item (fake Chase checking account). Implement `getTransactions(startDate, endDate)`. Write a Claude Code skill command that calls this and returns formatted Markdown. Run `/finance transactions last 7 days` and confirm real-looking fake data comes back.

**Phase 2 — Natural language query layer (≈1 hour).**
Expose the transaction data as a set of Claude Code tools (not commands): `queryTransactions(query: string)`, `detectSubscriptions()`, `getSpendingSummary(period: string)`. Write a system prompt for the skill that tells Claude when to call each tool. Test: "did Netflix charge me this month?" → calls `queryTransactions`, returns the result.

**Phase 3 — Morning brief hook (≈1 hour).**
A `UserPromptSubmit` hook that, on the first prompt of the day, prepends a one-paragraph finance brief (yesterday's spending total, any new charges, any alerts). The brief fetches from cached data (updated once per hour) so it does not slow the prompt. `FINANCE_BRIEF=off` disables it.

**Phase 4 — Alpaca paper trading connection (≈2 hours).**
Install `@alpacahq/typescript-sdk`. Connect to paper trading. Implement `getPortfolio()`, `getRecentTrades()`, `getPositions()`. Add to the `/finance` brief: current portfolio value, daily P&L. Test with a paper account funded with the default $100k.

**Phase 5 — Tax estimation (≈3 hours, optional).**
Given a year's transactions, split into income categories and deductible expense categories. Apply a configurable effective tax rate (or the upstream's 23-tool tax engine). Output quarterly estimated payments. Useful for freelancers and self-employed; irrelevant for salaried workers.

## Effort Estimate

**One Claude session for Phases 1–3** (~4 hours). Phase 4 adds another 2 hours. Phase 5 is an optional weekend project on its own.

## Blockers and Risks

- **Plaid production requires business justification.** The sandbox is free and unlimited, but connecting your real bank account requires Plaid Production access, which requires a business purpose and approval. Mitigation: build entirely in sandbox first; production approval can take 1–2 weeks; start that application early if you want real data.
- **Alpaca paper trading is free but requires account creation.** Signed up in 5 minutes at alpaca.markets. Paper trading has no restrictions. Live trading requires identity verification.
- **IBKR requires a real brokerage account.** If you do not have an Interactive Brokers account, skip Phase 4's IBKR portion entirely — Alpaca alone covers the core use case.
- **API rate limits are low on free tiers.** Plaid Sandbox: 100 requests/day. Alpaca paper: 200 requests/min. Caching (Phase 3's hourly refresh) keeps you well under both.
- **The finance lane is seven plans deep.** If the goal is expense tracking, use upstream `6missedcalls/personal-finance-skill` directly (MIT, 20★, TypeScript) — installing it is faster than building from scratch. Build a local version only if you want the Alpaca/IBKR integration or the morning brief hook, which the upstream does not ship.

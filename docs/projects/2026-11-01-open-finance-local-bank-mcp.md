# open-finance — local MCP server: ask Claude your bank balance and spending, nothing leaves your machine

**Source:** [j0nl1/open-finance](https://github.com/j0nl1/open-finance) (no confirmed creation date; matches interest profile; installable as Claude Code plugin via marketplace)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** build-first. The MCP server is already written; this plan is about connecting your actual bank data and building a natural-language finance habit on top.

## Why this one

open-finance is a local MCP server that connects Claude Code to your bank data — balances, transactions, and spending patterns. Data stays on your machine; no cloud account required.

The finance backlog has 15+ tools in seen.json. Most fall into one of two camps:
- **Manual entry:** you log the expense yourself (accountant24, Actual Budget MCP, expense-mcp-server, budget trackers)
- **Cloud accounts:** your data goes to Monarch, Copilot Money, Finometr, or similar

open-finance is the only one that aims to be data-at-source and local-first simultaneously. The gap it fills: "Claude, how much did I spend on food last month?" answered from your actual bank data without uploading it anywhere.

**Why FG=1:** No tool currently active here lets Claude query live bank data locally. The copilot-money-mcp (seen 2026-08-02) connects to Copilot Money via their cloud API, not to the bank directly. open-finance skips the middleman.

**Why N=1:** Local-first bank MCP with no cloud dependency is a different architecture than everything in the finance backlog. The closest prior art (Monarch MCP, zrabin/personal-finance-mcp) requires a third-party cloud account.

**Why DU=1:** A 30-second morning query — "What's my checking balance and my top 3 spend categories this week?" — replaces a browser session that takes 3 minutes.

**Why WB=1:** The server is written. MVP is: install it, connect a CSV export from your bank, and ask 3 questions. If the repo supports a direct bank API (Teller, Plaid), that's Phase 3.

## Do this today

```sh
# Install via Claude Code plugin marketplace
# /plugin marketplace add j0nl1/open-finance
# /plugin install open-finance@open-finance

# Or: clone and run the MCP server directly
git clone https://github.com/j0nl1/open-finance ~/.mcp-servers/open-finance
cd ~/.mcp-servers/open-finance
npm install && npm run build  # or pip install -e . depending on stack

# Add to Claude Code MCP config
claude mcp add open-finance node ~/.mcp-servers/open-finance/dist/index.js
# or: claude mcp add open-finance python ~/.mcp-servers/open-finance/server.py
```

First queries to run after setup:
1. "What is my current checking balance?"
2. "What were my top 5 spending categories last month?"
3. "How much did I spend at restaurants in October?"

## Stack

- MCP server: Node.js or Python (check repo; README will confirm)
- Data source: bank CSV export (Phase 1), or Teller/Plaid API (Phase 3)
- Claude Code plugin with marketplace entry
- Local SQLite or flat-file storage of imported transactions
- No cloud connectivity; all data stays in `~/.open-finance/` or similar local path

## MVP scope

1. MCP server installed and visible in Claude Code tool list
2. Bank CSV imported (most banks support CSV export from their web UI)
3. Three natural-language queries answered correctly

Out of scope (MVP): direct bank API connection, multi-account aggregation, budget alerts, recurring expense detection.

## Phases

1. **Install + CSV import (30 min).** Install the plugin, export the last 90 days of transactions from your bank as CSV, import them, run 3 test queries.
2. **Natural-language spend analysis (1h).** Ask Claude to categorize spending into 8–10 buckets (food, transport, subscriptions, utilities, shopping, entertainment, health, other). Save the mapping as a reusable skill.
3. **Daily balance check workflow (30 min).** A `/finance:morning` skill that runs 4 fixed queries: balance, weekly spend vs last week, top category this month, any transactions > $200 since yesterday.
4. **Direct bank API (optional, 1 session).** If open-finance supports Teller or Plaid, connect it for live balance sync instead of CSV refresh. Requires an API key from Teller (free dev tier) or Plaid.
5. **Monthly summary report (1 session).** At month-end, ask Claude to write a 1-page spending summary: totals by category, 3-month trends, budget variance if tracked. Save to `docs/finance/YYYY-MM.md`.

## Effort

Phase 1: 30 min. Phases 2–3: 1h total. Phases 4–5: 1 session each if wanted.

## Blockers / risks

- **Bank CSV format variation:** Different banks export transactions in different CSV layouts (date formats, column names, transaction descriptions). The MCP server may need a format config or import mapping step. Check the README for supported formats before committing.
- **No confirmed creation date:** This project was found via web search without a verified GitHub creation date. Check the repo's commit history before spending significant time. If it's abandoned, the CSV import approach (Phase 1) still works as a manual skill without the MCP layer.
- **Direct API cost:** Teller has a free developer tier but charges in production. Plaid is more expensive. Evaluate whether the CSV export workflow is sufficient before paying for an API.
- **Transaction description noise:** Bank transaction descriptions are notoriously messy ("AMZN*MKTP US AMZN.COM/BILLWA"). Categorization quality depends on how well the MCP server normalizes these. Plan for a manual correction pass in the first month.
- **Security:** Local MCP servers run as your user and have access to whatever you give them. Review the open-finance source before connecting it to live bank data.

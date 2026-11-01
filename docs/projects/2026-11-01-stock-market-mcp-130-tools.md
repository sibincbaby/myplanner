# stock-market-mcp — 130-tool Claude Code plugin: SEC filings, congressional trades, live quotes, earnings, FRED macro

**Source:** [daniel3303/stock-market-mcp-server](https://github.com/daniel3303/stock-market-mcp-server) (listed ~Oct 21, 2026; free plan 100 req/day, no card required)
**Score:** 3/4 (WB 0 · FG 1 · N 1 · DU 1)
**Shape:** install-first. 15 minutes to wire in; start querying. The 130 tools are already built; this plan is about wiring, verifying, and building a daily portfolio-check workflow on top.

## Why this one

130 tools covering:
- **SEC filings:** 13F holdings (who's buying what, quarterly), institutional ownership changes
- **Congressional and insider trades:** which Congress members and insiders bought or sold, with timing
- **Options chains:** open interest, implied volatility, put/call ratios
- **FRED macro:** interest rates, CPI, unemployment, GDP — the context behind the numbers
- **Earnings call transcripts:** full text searchable by ticker
- **Live quotes, IPOs, short interest, portfolio tracking**

The personal finance backlog is deep in expense tracking and budgeting tools. The MCP infrastructure gap that remains is *access to live market instruments without leaving Claude*. Every existing finance project in seen.json is either about spending (what you've already done) or requires a cloud account. This one is market-facing and free-tier accessible.

**Why FG=1 (measured on this box):** The finance backlog has Monarch MCP, copilot-money-mcp, accountant24, Actual Budget MCP, and 12 more expense tools. None gives Claude a live view of SEC filings, congressional trade disclosures (Form 4s), or earnings call text. Those three alone justify the install.

**Why N=1:** The combination — SEC 13F + congressional trades + FRED macro + options in one MCP — is not something Monarch, Copilot Money, or any seen tool covers. The closest is daniel3303's own earlier `fin-mcp-personal-finance` (seen 2026-10-06), which is a different, simpler server.

**Why DU=1:** "Show me what Congress bought this week" or "What's the institutional position change in NVDA this quarter" are questions worth asking daily during market hours.

**Why WB=0:** Nothing to build. Install cost is 15 minutes.

## Do this today (no build)

Install the MCP server and Claude Code plugin:

```sh
# Add to Claude Code MCP config
claude mcp add stock-market-server npx @daniel3303/stock-market-mcp-server

# Or if packaged as a plugin:
# /plugin marketplace add daniel3303/stock-market-mcp-server
# /plugin install stock-market-mcp-server@stock-market-mcp-server
```

Then verify with three test queries:
1. "List the top 5 congressional stock purchases in the last 30 days"
2. "What are the latest 13F filings mentioning NVDA?"
3. "Show me the FRED 10-year treasury rate for the last 6 months"

If the free plan's 100 req/day runs short, the natural daily workflow is 1-2 focused queries rather than bulk lookups.

## Stack

- MCP server: Node.js/npm (`@daniel3303/stock-market-mcp-server`), runs locally
- Data sources: SEC EDGAR, FinancialModelingPrep (free tier), Yahoo Finance, FRED API
- Claude Code plugin with marketplace entry
- No persistent storage; all queries are stateless

## MVP scope

1. MCP server wired into Claude Code config
2. Verify 3 query categories work: SEC filings, congressional trades, FRED macro
3. One daily-check workflow: a 3-question morning brief on portfolio positions

Out of scope (Phase 1): Options chain queries (require more context on positions), earnings call transcript search (large context), FRED macro dashboard.

## Phases

1. **Install + smoke test (15 min).** Add MCP, confirm the tool list loads in Claude, run 3 test queries above.
2. **Congressional trades brief (30 min).** Build a `/morning-market` skill that runs 4 fixed queries: congressional purchases, congressional sales, insider buys above $100k, and S&P 500 vs FRED 10Y spread. Output a 10-line summary.
3. **Portfolio tracker (1 session).** Given a list of 5-10 tickers, ask Claude to pull institutional ownership changes, next earnings date, and 52-week range. Compare to prior week's snapshot saved in `state/portfolio.json`.
4. **Earnings calendar skill (1 session).** Alert when any tracked ticker has an earnings call in the next 7 days; include the last transcript's 3-sentence summary.
5. **(Optional) FRED macro dashboard.** Monthly report: inflation trend, yield curve shape, unemployment delta. Saved to `docs/reports/YYYY-MM-macro.md`.

## Effort

Phase 1: 15 min. Phase 2: 30 min. Phase 3: 1 session. Phases 4–5: 1 session each if wanted.

## Blockers / risks

- **Free tier limit (100 req/day):** The morning brief (Phase 2) is ~10 queries; portfolio tracker (Phase 3) is ~30–50 per run. Should fit comfortably, but avoid bulk backfills.
- **API key sign-up:** FinancialModelingPrep requires an account for some endpoints. Free plan has no credit card requirement, but sign-up step is needed.
- **Rate limit on SEC EDGAR:** EDGAR has its own rate limits. Heavy 13F backfills may hit them; keep queries targeted.
- **Data freshness:** SEC filings have a filing lag (13Fs are quarterly, disclosed 45 days after quarter end). Congressional trades can lag 30–45 days by law. Don't treat them as real-time signals.
- **No price data for direct trading:** This is research/analysis tooling, not a trading system. Claude cannot execute trades.

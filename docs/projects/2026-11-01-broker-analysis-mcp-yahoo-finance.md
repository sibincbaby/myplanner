# broker-analysis-mcp — Yahoo Finance MCP plugin with 5 pre-built broker-analysis skills

**Source:** [chetto1983/broker-analysis-mcp](https://github.com/chetto1983/broker-analysis-mcp) (prototype; no confirmed creation date; packaged as Claude Code plugin for Claude Code, Codex, and Aura)
**Score:** 3/4 (WB 1 · FG 1 · N 1 · DU 0)
**Shape:** install-first (prototype). Install, run the 5 built-in skills against a watchlist, note what works and what breaks. Extend if useful.

## Why this one

broker-analysis-mcp wraps Yahoo Finance data in an MCP server and bundles five broker-analysis skills directly into the Claude Code plugin:

1. **sector-analysis:** compare sector exposure across a list of tickers
2. **portfolio-metrics:** P/E, P/B, EV/EBITDA, beta for a set of holdings
3. **earnings-calendar:** next earnings dates and estimated vs actual EPS for the last 4 quarters
4. **dividend-tracker:** dividend yield, payout ratio, ex-dividend dates
5. **watchlist-summary:** one-line brief per ticker (price, 52-week range, analyst consensus)

**Why FG=1:** The stock-market-mcp-server (also viable today) covers macro and regulatory data (SEC, FRED, congressional trades). broker-analysis-mcp covers the fundamental analysis layer — P/E ratios, earnings history, dividend tracking. They're complementary, not overlapping.

**Why N=1:** Pre-packaged skills for broker-style analysis (sector exposure, fundamental ratios, dividend tracking) in a single plugin is a different scope than general finance MCPs. The bundled skills mean zero setup beyond install; the stock-market MCP requires writing your own queries.

**Why DU=0:** Active portfolio management happens in bursts (before earnings, when rebalancing) rather than every day. This is a "when I need it" tool, not a daily ritual.

**Why WB=1:** It's a prototype. The real weekend work is: install it, run all 5 skills against a real watchlist, write up what works, and add one custom skill if anything is missing.

## Do this today

```sh
# Install via Claude Code plugin marketplace
# /plugin marketplace add chetto1983/broker-analysis-mcp
# /plugin install broker-analysis-mcp@broker-analysis-mcp
```

Or clone and run manually:
```sh
git clone https://github.com/chetto1983/broker-analysis-mcp ~/.mcp-servers/broker-analysis-mcp
cd ~/.mcp-servers/broker-analysis-mcp
pip install -e .  # or npm install, check the repo
claude mcp add broker-analysis python ~/.mcp-servers/broker-analysis-mcp/server.py
```

First queries (prototype validation):
1. `watchlist-summary ["AAPL", "NVDA", "MSFT", "VTI"]` — does the one-liner per ticker look right?
2. `portfolio-metrics ["AAPL", "NVDA"]` — do the P/E ratios match Yahoo Finance?
3. `earnings-calendar ["NVDA"]` — is the next earnings date correct?

If all three return reasonable data, the prototype is worth using.

## Stack

- MCP server: Python (likely; check repo stack)
- Data source: Yahoo Finance (yfinance library, no API key needed)
- Five bundled skills (sector-analysis, portfolio-metrics, earnings-calendar, dividend-tracker, watchlist-summary)
- Read-only; no writes to any local state
- No API key required (Yahoo Finance via yfinance)

## MVP scope

1. Plugin installed and all 5 skills loaded in Claude Code
2. Validation run: all 5 skills return correct data for 2–3 tickers
3. One real use: portfolio metrics for current holdings

Out of scope (MVP): custom skills, sector comparison vs benchmark, historical backtesting.

## Phases

1. **Install + validate (30 min).** Install plugin, run 3 test queries above, compare outputs to Yahoo Finance web. Note any data accuracy issues.
2. **Watchlist workflow (30 min).** Save a watchlist of 8–10 tickers in `state/watchlist.json`. Build a `/broker:weekly` skill that runs `watchlist-summary` + `earnings-calendar` every Monday and saves results to `docs/finance/weekly-YYYY-MM-DD.md`.
3. **Portfolio analysis (1h).** Run `portfolio-metrics` + `sector-analysis` on current holdings. Compare sector weights to VTI as benchmark. Note any concentration risks.
4. **Extend with one custom skill (optional, 1 session).** If a needed capability is missing (e.g., short interest, analyst price targets), add a 6th skill using the same MCP server's Yahoo Finance data access.
5. **Combine with stock-market-mcp (optional).** If both MCPs are installed, build a `pre-earnings-brief` skill that pulls (a) upcoming earnings date from broker-analysis-mcp, (b) institutional 13F position changes from stock-market-mcp, and (c) congressional trades in the ticker from stock-market-mcp. One 3-tool query.

## Effort

Phase 1: 30 min. Phase 2: 30 min. Phase 3: 1h. Phases 4–5: 1 session each if wanted.

## Blockers / risks

- **Prototype quality:** "Prototype" in the README means expect rough edges: stale data, missing tickers, occasional yfinance API failures (Yahoo Finance is not a documented public API). Run Phase 1 validation before spending time on Phases 2–3.
- **No confirmed creation date:** Found via web search without a verified GitHub creation date. Check commit history; if the last commit is > 6 months old, the yfinance dependency may have broken against Yahoo's current API.
- **Yahoo Finance rate limits:** yfinance is an unofficial wrapper that scrapes/queries Yahoo's endpoints. Heavy usage (large watchlists, many historical lookups) can trigger rate limiting or temporary blocks.
- **Data accuracy:** P/E ratios and other fundamental metrics from yfinance can lag by 1–2 quarters relative to the company's latest filing. Verify against a second source before making decisions.
- **Prototype vs stock-market-mcp:** If bandwidth allows only one install today, stock-market-mcp-server (130 tools, more established, free API tier with official documentation) is the safer first choice. broker-analysis-mcp is the second install, for fundamental analysis depth.

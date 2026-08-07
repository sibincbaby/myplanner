# langalpha-invest — Personal Investment Research Agent with Claude

**Source:** [ginlix-ai/LangAlpha](https://github.com/ginlix-ai/LangAlpha) · GitHub trending (finance-ai topic, 1.6k ★)
**Language:** Python 3.11+ · Claude Sonnet (via MCP financial data servers) · MIT
**Date discovered:** 2026-08-07

## What it is

LangAlpha is a "Claude Code for Investing" harness: Claude becomes a financial analyst with access to live market data through MCP servers. It uses Programmatic Tool Calling — the agent writes and executes Python inside sandboxes to pull financial data rather than embedding raw numbers into context. Research workflows are stored as persistent workspaces so analysis compounds over time.

Key capabilities out of the box: real-time quotes, SEC filings, options chains, macro data, technical indicators, DCF modelling, comps analysis, earnings calendar, and coverage initiation reports. 23 pre-built research skills. Agent-generated charts via TradingView integration.

**Why it matters for a personal build:** LangAlpha is complex (1,670 commits, 269 forks). But the *idea* strips down cleanly to a weekend MVP: a few MCP data sources + Claude + a CLAUDE.md that knows how to act as your analyst. The existing finance projects in the backlog (expense tracking, budget analysis) don't touch investment research at all.

## Why it fits

- Core interest: **personal finance AI** — investment research is the gap not yet covered
- Core interest: **Claude/LLM tooling** — Claude Code as the analyst interface, MCP for data
- Core interest: **agent UIs** — structured research workspace that persists findings across sessions
- `fills_gap = 1`: expense trackers fill the backlog; nothing covers stock/portfolio research
- `novel = 1`: a personal fork tuned to your holdings, preferred metrics, and risk tolerance

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | MVP = 3 MCP data connectors + CLAUDE.md + 5 research skill prompts; no frontend needed |
| fills_gap | 1 | No investment research agent in the backlog; expense tracking is well-saturated |
| novel | 1 | Personal version: your holdings, your thresholds, your risk profile — not a LangAlpha clone |
| daily_utility | 1 | Morning portfolio brief, pre-earnings research, sector rotation check — every trading day |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Claude Code         — analyst interface (CLAUDE.md + skills)
MCP data servers:
  yahoo-finance-mcp — free tier: quotes, fundamentals, historical prices
  sec-edgar-mcp     — SEC filings (10-K, 10-Q, 8-K) via EDGAR full-text search
  fred-mcp          — Federal Reserve macro data (rates, CPI, GDP)
Python sandbox      — pandas + yfinance + matplotlib for computations Claude writes
SQLite workspace    — persist research notes, target prices, watchlist, thesis per ticker
```

Deliberately no paid data subscription for the MVP. Yahoo Finance + EDGAR + FRED cover 95% of retail research needs. Add a brokerage API (Alpaca, Interactive Brokers) only in a later phase.

## MVP Scope (1 Claude session)

1. Configure three MCP servers in `claude_desktop_config.json`: `yahoo-finance-mcp`, `sec-edgar-mcp`, `fred-mcp`
2. Write `CLAUDE.md` for the workspace: declare analyst role, available data sources, output formats (thesis statement, bull/bear cases, price target, key risks)
3. Author 3 core research skills: `morning-brief`, `earnings-preview`, `sector-scan`
4. Create `research/` workspace structure: `holdings/`, `watchlist/`, `theses/`, `notes/`
5. Run a live test: ask Claude to generate a one-page brief on a stock in your portfolio — verify it pulls live data, runs a DCF, and saves a summary to `research/theses/<ticker>.md`

## Phases

### Phase 1: MCP Data Layer (2-3h)
- Install and configure three MCP servers locally:
  - `yahoo-finance-mcp`: `npx -y yahoo-finance-mcp-server` — quotes, fundamentals, earnings dates, dividends
  - `sec-edgar-mcp`: `npx -y sec-edgar-mcp` — search 10-K/10-Q/8-K by ticker + keyword
  - `fred-mcp`: `npx -y fred-mcp-server` — macro series (T10Y2Y, FEDFUNDS, CPIAUCSL, etc.)
- Test each tool individually in Claude Code: pull a quote, fetch the most recent 10-K intro, get 10-year treasury yield
- Write a `data-sources.md` reference with one example call per tool and known rate limits
- Verify: `What is AAPL's P/E ratio and the latest Fed funds rate?` returns live data from two MCP calls in one turn

### Phase 2: CLAUDE.md + Research Workspace (1-2h)
- `CLAUDE.md` declares:
  - Analyst persona and response format (1-page brief: thesis / bull case / bear case / risks / price target)
  - Available MCP tools and when to use each
  - Workspace paths: `research/holdings/`, `research/watchlist/`, `research/theses/`
  - Output conventions: save every thesis as `<ticker>-<date>.md` in `research/theses/`
  - Quantitative defaults: 10% WACC for DCF unless overridden, 5-year projection horizon
- Initialise workspace: `research/holdings/portfolio.json` with your actual positions and cost basis
- Verify: Claude can answer "What's in my portfolio?" from the workspace without being told

### Phase 3: Core Research Skills (2h)
- `morning-brief.md` skill: pull overnight price moves for all holdings, flag >2% movers, check any earnings releases, summarise macro news from FRED series; save `research/notes/YYYY-MM-DD-brief.md`
- `earnings-preview.md` skill: for a given ticker, pull last 4 earnings calls (revenue, EPS beats/misses), upcoming consensus estimates, analyst revision trend; output structured preview
- `sector-scan.md` skill: given a sector (e.g. "semiconductors"), list top 5 stocks by market cap, compare P/E and EV/EBITDA, identify the outlier, save a comparison table
- Verify: run all three skills for a real stock; each produces a structured, data-backed output with citations to the MCP source

### Phase 4: Python Sandbox + DCF (2-3h)
- Enable Claude Code's bash tool to write + execute Python in `research/sandbox/`
- Write a DCF template (`research/templates/dcf.py`): takes revenue growth, EBIT margin, WACC, terminal growth as inputs; outputs NPV and implied price
- Add `dcf-model.md` skill: Claude extracts financials from EDGAR, fills the DCF template, executes it, saves output as a CSV + chart (matplotlib)
- Add `portfolio-performance.md` skill: reads `holdings/portfolio.json`, fetches current prices via Yahoo Finance MCP, computes return vs SPY, saves to `research/notes/performance-<date>.md`
- Verify: DCF for a stock returns a valid implied share price within 20% of market consensus

### Phase 5: Watchlist Alerts + Weekly Review (1-2h)
- `watchlist.json`: array of `{ticker, thesis_date, thesis_file, target_price, stop_loss, trigger_conditions}`
- `weekly-review.md` skill: iterate watchlist, flag any triggers hit (target/stop within 5%, earnings within 7 days, major news), update thesis files if Claude changes the view
- Cron-friendly: `claude -p "/morning-brief" --workspace ~/research` runs headlessly from a cron job at 8am on trading days
- Verify: add a ticker at $100 target; run weekly review after a 5% move; confirm Claude flags the trigger

## Effort Estimate

| Phase | Hours |
|-------|-------|
| MCP Data Layer | 2-3h |
| CLAUDE.md + Workspace | 1-2h |
| Core Research Skills | 2h |
| Python Sandbox + DCF | 2-3h |
| Watchlist Alerts | 1-2h |
| **Total** | **8-12h (1-2 weekends)** |

Phases 1-3 deliver a working morning brief + earnings preview in **5-7h (one weekend)**.

## Blockers / Risks

- Yahoo Finance's unofficial API breaks periodically — if `yfinance` errors, fall back to `sec-edgar-mcp` for fundamental data and add a `finnhub-mcp` as a redundant quote source
- EDGAR full-text search has rate limits (10 req/sec); batch searches and add `time.sleep(0.15)` between EDGAR calls in the Python sandbox
- DCF quality is only as good as the inputs; Claude can hallucinate revenue projections if EDGAR data is sparse. Always require Claude to cite its source for each DCF input line
- Claude's Python sandbox writes to `research/sandbox/` — add that path to `.gitignore` to avoid committing large CSVs or generated charts
- The workspace is local only; if you want to access it from multiple machines, point the `research/` directory at a synced folder (iCloud, Dropbox) or commit notes to a private GitHub repo
- Tax implications: this tool provides analysis, not advice. Add a disclaimer to `CLAUDE.md` so Claude includes it in any output that could be construed as a recommendation

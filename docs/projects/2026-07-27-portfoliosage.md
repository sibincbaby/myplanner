# PortfolioSage

> A local-first Flutter investment portfolio tracker with a Claude chat panel — import broker CSVs, visualize allocation and returns, then ask Claude natural-language questions about your portfolio

**Inspired by:** [wealthfolio/wealthfolio](https://github.com/wealthfolio/wealthfolio) + d1g1t MCP Server launch (GitHub/Product discovery July 27 2026)  
**Date discovered:** 2026-07-27

---

## What gap it fills

Existing finance plans in this collection (Claude Finance MCP — July 21, LedgerBot — July 23) focus on **spending and budgeting**. The investment portfolio domain is separate and uncovered: tracking stock/ETF holdings, cost basis, time-weighted returns, and allocation drift. Wealthfolio is the best open-source solution but is React/Tauri and has no Claude integration — you connect your own LLM key but the chat is a generic Q&A box with no portfolio-aware tools. d1g1t launched an enterprise MCP for financial advisors on July 20; there is nothing equivalent for personal use.

PortfolioSage fills this gap: a Flutter desktop/web app that ingests brokerage CSV exports, calculates performance, and exposes a Claude chat panel with 4 portfolio-aware MCP-style tools. You open Claude and ask "what's dragging down my portfolio this quarter?" or "am I overexposed to US tech?" and Claude has structured data to answer accurately.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Flutter (desktop + web) | User's primary stack; one codebase for Mac app + browser |
| ORM / storage | `drift` (SQLite) | Type-safe queries, migrations, local-first |
| AI | `anthropic` Dart SDK (claude-haiku-4-5-20251001 for quick queries, claude-sonnet-5 for analysis) | Native; haiku keeps costs near zero for daily use |
| CSV parsing | `csv` Dart package + heuristic column mapper | Covers Interactive Brokers, Trading 212, Fidelity, Schwab |
| Charts | `fl_chart` | Native Flutter; smooth animations; no JS bridge |
| State management | `riverpod` | Reactive, testable; works well with drift streams |
| Prices (optional) | Yahoo Finance CSV endpoint (unofficial) | Free; no API key; pull closing prices on demand |

## MVP scope (1–2 Claude sessions)

A Flutter desktop app that:

1. **Imports** one broker CSV export and maps it to a normalized schema (ticker, quantity, cost_basis, date, currency)
2. **Displays** a holdings screen: current value, P&L per position, total return %, allocation pie chart
3. **Exposes** a Claude chat panel with 4 tools:
   - `get_holdings()` → list of positions with cost basis and current value
   - `get_performance(period)` → portfolio return vs. SPY over N days/months
   - `get_allocation(dimension)` → breakdown by sector, geography, or asset class
   - `get_top_movers(n, direction)` → best/worst performers by absolute P&L
4. Claude chat answers questions using tool results; no hallucinated numbers

Out of scope for MVP: real-time prices (manual refresh), multiple currency conversion, options/derivatives.

## Phases

### Phase 1 — Data layer: drift schema + CSV importer (1.5 h)
- `drift` schema: `Holdings` table (id, ticker, name, quantity, cost_basis, currency, account, date_acquired) + `Prices` table (ticker, date, close_price)
- `CsvImporter` class: detect broker format by column headers (Interactive Brokers: "Symbol","Quantity","Cost Basis"; Trading 212: "Ticker","Shares","Currency cost"); map to normalized schema
- Support 2 broker formats in MVP; emit parse errors as structured exceptions with row numbers
- `PortfolioRepository`: computed properties via drift Queries — `currentValue()`, `unrealizedPL()`, `totalReturn()`

### Phase 2 — Holdings and performance UI (1.5 h)
- `HoldingsScreen`: `DataTable` with sortable columns (ticker, shares, value, P&L, P&L%), search field
- `AllocationScreen`: `PieChart` via `fl_chart`, switchable between sector / geography / asset class using tag metadata from a bundled JSON (ticker → sector mapping for 500 common tickers)
- `PerformanceScreen`: line chart showing portfolio value over time; overlay with SPY benchmark
- Riverpod providers for each screen; drift streams make charts update live after import

### Phase 3 — Claude chat integration (1 h)
- `ClaudeService`: wraps the Anthropic Dart SDK; builds system prompt describing the 4 available tools
- Tool-use loop: Claude returns `tool_use` blocks → `ToolDispatcher` calls the appropriate `PortfolioRepository` method → results returned in `tool_result` blocks → final answer extracted
- `ChatPanel` widget: message list with markdown rendering, tool-call badges (shows which tool Claude called), input field
- Lazy load: chat panel appears in a `SplitView` next to the holdings screen; no separate screen needed

### Phase 4 — Rebalancing suggestions + allocation analysis (1 h)
- New tool: `get_rebalancing_targets(target_allocation)` — takes a target dict (e.g. `{"US equity": 0.6, "International": 0.3, "Bonds": 0.1}`) and returns buy/sell amounts to rebalance
- `AllocationEditor` widget: sliders to set target %; chat command `/rebalance` passes current allocation + targets to Claude which explains the trades needed
- Sector exposure warnings: if any single sector > 40% of portfolio, Claude proactively flags it in the chat welcome message

### Phase 5 — Local encryption + Polish + README (45 min)
- `flutter_secure_storage` for the Claude API key (never stored in plain text)
- Optional password lock on app open using `local_auth` (biometric / passcode)
- Export: "Export portfolio as CSV" button for backup
- README: 3-step install (flutter build macos / flutter run -d chrome), supported broker list, example screenshots
- Include a `sample_portfolio.csv` with fake tickers for first-run testing

## Effort estimate

~5.75 hours complete · 1–2 Claude sessions (closer to 2 if new to `drift` migrations)  
Phases 1–3 give a working MVP in ~4 hours

## Blockers / risks

- **Broker CSV format diversity**: Interactive Brokers in particular has a complex multi-section CSV format. Invest 30 min writing a dedicated IBKR parser; it will cover the hardest case and most others are simpler.
- **No real-time prices in MVP**: Use the last imported price for current value. Add a Yahoo Finance refresh button in Phase 2 (one HTTP call per ticker on demand). Document this clearly so users don't mistake stale prices for live.
- **Multi-currency portfolios**: Currency conversion adds complexity. MVP: store everything in the transaction currency; add a `base_currency` setting in Phase 4 with ECB exchange rate fetch.
- **Positioning vs. prior finance projects**: PortfolioSage is strictly investment portfolios (stocks, ETFs, funds). It does NOT track expenses, budgets, or bank accounts — that's Claude Finance MCP (July 21) and LedgerBot (July 23). The three are complementary, not competitive.
- **`drift` learning curve**: If new to drift, the generated query system takes ~1 hour to internalize. The Claude Code session should open with "I'm using drift ORM with SQLite in Flutter" to get accurate help.

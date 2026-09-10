# Claude-Powered AI Financial Dashboard

**Source:** <https://github.com/mkash25/Claude-powered-AI-native-financial-dashboard>
**Discovered:** 2026-09-10
**Viability:** 4/4

> A self-hosted portfolio intelligence system: connects real brokerage accounts via Plaid, enriches positions with technical indicators and market data, then sends the full portfolio to Claude for a structured AI analysis — health score, per-ticker recommendations, and action items — displayed on a live Next.js dashboard.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

Plaid sandbox gives real-looking transaction data immediately. Claude structured output makes the analysis pipeline 1 prompt + Pydantic parsing. A barebones Next.js dashboard for the results is 2-3 hours. No existing tool in the toolkit bridges raw brokerage data → daily Claude-generated action items. Runs Mon/Wed/Fri on a cron job + Telegram notification closes the loop.

---

## Implementation Plan

## Overview

A cron-driven personal finance intelligence layer: Plaid pulls transactions and positions from real brokerage accounts, yfinance enriches each holding with RSI/MACD and fundamentals, Claude generates a structured portfolio health report, and a Next.js dashboard serves the latest analysis at `localhost:3000`. A Telegram notification delivers the health score after each run.

## Stack Recommendation

- **Backend**: Python 3.12 + `plaid-python` + `yfinance` + `anthropic` SDK
- **AI**: Claude claude-sonnet-4-6 — structured JSON output via tool_use
- **Storage**: SQLite (pure local, no infrastructure needed) or Supabase for multi-device access
- **Frontend**: Next.js 14 + Tailwind CSS + `recharts` for charts
- **Scheduler**: macOS launchd or systemd timer (Mon/Wed/Fri 7am)
- **Notifications**: Telegram Bot API (reuse the Ohmo bot if built)

## MVP Scope

Connect Plaid sandbox, fetch 30 days of transactions, send to Claude for spending analysis, show results on a single-page Next.js dashboard. No brokerage positions needed in Phase 1 — transactions alone are enough for Claude to generate useful insights.

## Implementation Phases

### Phase 1: Plaid Connection + Transaction Fetch
**Goal:** Pull real transaction data from a Plaid sandbox account into a JSON file
**Files to create/modify:**
- `backend/plaid_client.py` — Plaid SDK wrapper with `get_transactions(access_token, days=30)`
- `backend/link_flow.py` — CLI helper to run Plaid Link sandbox flow and capture access_token
- `backend/fetch.py` — main script: fetch transactions → save to `data/transactions_YYYY-MM-DD.json`
- `.env` — `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`
- `requirements.txt` — plaid-python, python-dotenv
**Key steps:**
1. Create free Plaid developer account at dashboard.plaid.com → copy Client ID + Secret to `.env`
2. `pip install plaid-python python-dotenv`
3. In `link_flow.py`: create Link token (`client.link_token_create`), open URL in browser, capture `public_token` from redirect, exchange for `access_token` (`client.item_public_token_exchange`)
4. Save access_token to `.env` as `PLAID_ACCESS_TOKEN`
5. In `plaid_client.py`: implement `get_transactions()` returning list of `{date, name, amount, category, account_id}`
6. In `fetch.py`: call `get_transactions()`, save JSON
**Verify:** `python backend/fetch.py` → `data/transactions_2026-09-10.json` contains 30+ sandbox transactions

### Phase 2: Claude Analysis Pipeline
**Goal:** Claude produces structured portfolio health report from transaction data
**Files to create/modify:**
- `backend/analyze.py` — loads latest transactions JSON, calls Claude, saves analysis JSON
- `backend/prompts/portfolio_analysis.md` — system prompt: role, output schema, analysis rubric
- `backend/schemas.py` — Pydantic: `TickerRec(ticker, action, reason)`, `PortfolioAnalysis(health_score, summary, recommendations, action_items, top_categories)`
**Key steps:**
1. Build user message: include full transaction list as JSON block + "Analyze my portfolio. Return valid JSON matching this schema: {schema}"
2. Use Claude tool_use to force structured output: define a `report_analysis` tool with the JSON schema, call with `tool_choice={"type": "tool", "name": "report_analysis"}`
3. Parse `content[0].input` as `PortfolioAnalysis` via Pydantic
4. Save to `data/analysis_YYYY-MM-DD.json`
5. Print formatted summary: `Health: {score}/100 | Top action: {action_items[0]}`
**Verify:** `python backend/analyze.py` → console shows health score 0-100, 3-5 action items; JSON file saved

### Phase 3: Next.js Dashboard
**Goal:** Live dashboard at localhost:3000 showing health score + AI recommendations
**Files to create/modify:**
- `frontend/app/page.tsx` — main page: HealthGauge, RecommendationGrid, ActionItemList, SpendingChart
- `frontend/app/api/analysis/route.ts` — GET handler reading latest `data/analysis_*.json`
- `frontend/components/HealthGauge.tsx` — circular progress gauge, color-coded (red <40, amber 40-70, green >70)
- `frontend/components/RecommendationCard.tsx` — ticker + action badge (BUY/HOLD/SELL) + reasoning text
- `frontend/components/SpendingChart.tsx` — recharts BarChart of spending by category
**Key steps:**
1. `npx create-next-app@latest frontend --typescript --tailwind --app`
2. `npm install recharts`
3. In API route: `fs.readdirSync('../data')`, filter `analysis_*.json`, sort descending, read latest
4. In HealthGauge: use SVG circle with `stroke-dasharray` and `stroke-dashoffset` for radial fill
5. In page.tsx: fetch `/api/analysis` on load, destructure into components
6. Add "Last updated: {date}" timestamp from analysis JSON
**Verify:** `npm run dev` → localhost:3000 shows health score gauge + recommendation cards from today's analysis

### Phase 4: Investment Positions + yfinance Enrichment
**Goal:** Add real brokerage positions enriched with technicals to the Claude prompt
**Files to create/modify:**
- `backend/plaid_investments.py` — `get_holdings(access_token)` using Plaid Investments product
- `backend/enrich.py` — for each ticker: `yf.Ticker(ticker).info` + `yf.download(ticker, period="3mo")` for RSI/MACD
- `backend/analyze.py` — extend prompt with `positions` section alongside transactions
**Key steps:**
1. Enable Investments product in Plaid dashboard for your sandbox item
2. `client.investments_holdings_get(access_token)` → list of `{ticker, quantity, cost_basis, market_value}`
3. In `enrich.py`: compute RSI-14 from closing prices (pandas rolling), MACD (12-26-9 EMA), get P/E from yfinance `.info`
4. Extend the Claude prompt: add `## Positions\n{enriched_positions_json}` section
5. Ask Claude to include per-ticker action (BUY/SELL/HOLD) with technical rationale in structured output
**Verify:** Run `python backend/analyze.py` — recommendations now include ticker-specific reasoning ("AAPL: RSI 72 → overbought, consider trimming")

### Phase 5: Scheduling + Telegram Notification
**Goal:** Dashboard updates automatically Mon/Wed/Fri, Telegram ping on completion
**Files to create/modify:**
- `run_analysis.sh` — `python backend/fetch.py && python backend/analyze.py && python backend/notify.py`
- `com.user.portfolio.plist` (macOS) or `portfolio.timer` + `portfolio.service` (systemd)
- `backend/notify.py` — sends Telegram message: "📊 Portfolio health: {score}/100 | Top action: {action_items[0]}"
**Key steps:**
1. Write `run_analysis.sh`, `chmod +x`, test manually
2. macOS: create plist at `~/Library/LaunchAgents/com.user.portfolio.plist` with `StartCalendarInterval` for Mon/Wed/Fri 7am; `launchctl load` it
3. Linux: write `portfolio.service` (ExecStart = run_analysis.sh) + `portfolio.timer` (OnCalendar=Mon,Wed,Fri 07:00); `systemctl enable --now portfolio.timer`
4. In `notify.py`: `requests.post(f"https://api.telegram.org/bot{TOKEN}/sendMessage", json={chat_id, text})`
5. Add cron-failure notification: wrap `run_analysis.sh` with `|| notify.py "❌ Analysis failed"`
**Verify:** Manually trigger `run_analysis.sh` → Telegram message arrives within 60s with health score

## Estimated Effort

3 Claude Code sessions:
- **Session 1** (~3-4h): Phases 1-2 — Plaid sandbox + Claude analysis pipeline
- **Session 2** (~2-3h): Phase 3 — Next.js dashboard
- **Session 3** (~2h): Phases 4-5 — positions + enrichment + scheduling + notifications

## Potential Blockers

- **Plaid development access** (real accounts): Plaid sandbox is instant; development (real bank connections) requires an application that takes 1-3 days to approve. Start with sandbox for Phases 1-3; apply for development access in parallel.
- **Investments product availability**: Not all Plaid-connected brokerages support the Investments product. Robinhood, Fidelity, and SoFi are confirmed supported. Schwab and TD Ameritrade may not be.
- **Claude context limits**: A full year of transactions + enriched positions can exceed 100K tokens. Filter to 90-day transactions + current positions only. Use `max_tokens=4096` for the structured response.
- **yfinance reliability**: Yahoo Finance's unofficial API breaks occasionally. Cache enrichment data daily to `data/enriched_YYYY-MM-DD.json`; fall back to cached data if yfinance raises an exception.

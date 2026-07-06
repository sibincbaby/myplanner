# Finance Agent — Personal AI Finance Assistant

**Inspired by:** [github.com/nirajdsouza/personal-finance-assistant-ai-agent](https://github.com/nirajdsouza/personal-finance-assistant-ai-agent)  
**Source:** GitHub topic `personal-finance-ai` — LLM-powered budget, categorisation, and forecasting  
**Interest score:** 3/4 (personal finance AI + Claude/LLM tooling + agent UIs)

## What It Is

A Python FastAPI + Streamlit personal finance assistant that connects to your exported bank/card data (CSV, OFX, or JSON), uses an LLM to categorise transactions automatically, answers natural-language questions about spending, generates budget recommendations, and forecasts month-end balance. The reference uses Groq LLM + FastAPI + Streamlit.

## Why Build Your Own

The reference is an early-stage demo without persistent storage or multi-account support. What fills a real gap is a version that: (1) accepts real exported data formats (standard bank CSV, Revolut/Monzo JSON, OFX), (2) stores everything locally in SQLite — no cloud, no bank API credentials ever leave your machine, (3) uses Claude for richer category reasoning and natural-language Q&A, and (4) has a clean Streamlit UI you actually want to open daily. Cleo and similar apps require connecting live credentials; this is purely offline, works on exports.

## Stack Recommendation

- **Python + `claude-sonnet-5` (claude-sonnet-5-20251001)** — categorisation, Q&A, budget advice (haiku for fast one-liners)
- **`pandas`** — parse CSV/OFX/JSON exports, normalise to internal schema
- **`SQLite` via `sqlite3`** — transaction store, category cache, monthly budgets (single `.db` file, no server)
- **`Streamlit`** — chat UI + charts + category editor; runs locally on `localhost:8501`
- **`ofxparse`** — parse OFX/QFX bank exports
- **`plotly`** — spending-by-category pie, monthly trend line, forecast bar

## MVP Scope

Import a bank CSV → normalise to `{date, description, amount, currency}` → Claude auto-categorises each transaction (grocery/transport/dining/subscription/income/other) → display in a Streamlit table with category badges → ask "how much did I spend on food in June?" in a chat box → Claude queries the SQLite DB and answers. Monthly total vs. prior month delta shown as KPI tiles.

---

## Implementation Phases

### Phase 1 — CSV Ingest + Schema Normalisation
**Goal:** Drop any bank CSV and get a clean unified transaction table.

**Files:**
- `finance_agent/ingest.py` — detect CSV dialect (Monzo, Revolut, generic bank), map columns to `{date, description, amount, currency, source}`
- `finance_agent/db.py` — SQLite schema: `transactions(id, date, description, amount, currency, category, source, imported_at)`
- `finance_agent/cli.py` — `python -m finance_agent import transactions.csv`

**Key steps:**
1. Support at least: generic `Date,Description,Amount` CSVs; Revolut JSON export; OFX via `ofxparse`
2. Deduplicate on `(date, description, amount)` — safe to re-import the same file
3. Amounts: always store as float with sign convention (negative = expense, positive = income)
4. `cli.py import` prints a summary: N new, M duplicates skipped

**Verify:** Import a 200-row Revolut CSV → `SELECT COUNT(*) FROM transactions` returns the correct count; re-import → 0 new rows.

---

### Phase 2 — AI Categorisation
**Goal:** Every transaction gets a category; categories are correctable and cached.

**Files:**
- `finance_agent/categorise.py` — batch transactions to Claude; update `category` column in DB

**Key steps:**
1. Send transactions in batches of 50: `"Categorise each transaction as one of: groceries, dining, transport, utilities, subscriptions, health, entertainment, travel, income, transfer, other. Return JSON array of {id, category}."`
2. Use `claude-haiku-4-5` (fast + cheap for classification); fall back to `claude-sonnet-5` for ambiguous items
3. Cache: only re-categorise rows where `category IS NULL`
4. Expose a `recategorise --id <id> --category <cat>` CLI to correct mistakes; store correction in a `corrections` table so future imports apply it automatically

**Verify:** 200 transactions categorised in under 30s; a Monzo "TESCO STORES" entry resolves to "groceries".

---

### Phase 3 — Streamlit Dashboard
**Goal:** Open `localhost:8501` and see spending at a glance.

**Files:**
- `app.py` — Streamlit entrypoint
- `finance_agent/charts.py` — Plotly helpers for category pie, monthly bar, running balance line

**Dashboard sections:**
- KPI row: month-to-date spend / income / net / savings rate vs. last month
- Category breakdown: donut chart, click a slice to filter the table below
- Transaction table: sortable, searchable, inline category badge (green = auto, amber = corrected)
- Month selector: dropdown to view any past month

**Key steps:**
1. All queries run against local SQLite; no network calls in the UI thread
2. Category colours consistent across all charts (assign by index, not random)
3. `st.cache_data(ttl=300)` on DB queries so page rerenders are fast

**Verify:** Dashboard loads in < 2s with 2,000 transactions; clicking "Dining" in the pie filters the table to dining rows only.

---

### Phase 4 — Natural-Language Q&A Chat
**Goal:** Ask questions about your finances in plain English and get accurate, grounded answers.

**Files:**
- `finance_agent/qa.py` — Claude call that generates a SQL query, executes it, formats the answer
- `app.py` — add a `st.chat_input` to the dashboard

**Key steps:**
1. System prompt: "You are a personal finance analyst. Given the schema below, generate a SQLite SELECT query that answers the user's question. Return only the SQL, no explanation." Then execute the SQL and send the result back to Claude for a human-friendly answer.
2. Never let Claude execute DDL or DML (validate that the generated statement starts with `SELECT`)
3. Show the raw SQL in an expander below the answer for transparency
4. Store Q&A history in `conversations` table for context across questions

**Example Q&A to verify:**
- "How much did I spend on subscriptions last quarter?" → correct sum
- "What's my biggest single expense category?" → correct category name
- "Am I spending more on food than last month?" → correct boolean + delta

---

### Phase 5 — Budget + Forecast
**Goal:** Set monthly budgets per category; get a month-end forecast and alert when approaching limits.

**Files:**
- `finance_agent/budget.py` — CRUD for `budgets(category, monthly_limit, currency)` table
- `finance_agent/forecast.py` — linear extrapolation of spend to month-end per category
- `app.py` — budget progress bars, forecast chart, over-budget alerts as `st.warning`

**Key steps:**
1. Forecast: `projected = (spent_so_far / days_elapsed) * days_in_month`
2. Alert threshold: warn at 80%, error at 100%
3. Claude writes a weekly "finance digest" when asked: "This week you spent £X, you're on track for Y in dining (budget £Z)…"
4. Export digest as markdown to `reports/YYYY-MM-DD.md`

**Verify:** Set dining budget to £200; spend £160 in first 20 days → forecast shows £240 projected, `st.warning` fires at 80%.

---

## Estimated Effort

**1.5 Claude sessions.** Phase 1+2 (ingest + categorisation) are ~2 hours and deliver immediate value. Phase 3 (dashboard) is ~1.5 hours. Phase 4 (Q&A) is the most satisfying — ~1 hour if you nail the SQL-generation prompt. Phase 5 (budgets) is ~1 hour.

## Potential Blockers

- **SQL injection in AI-generated queries**: always validate that generated SQL starts with `SELECT` and contains no `;` (multi-statement) or `--` (comment injection) before executing.
- **CSV format variance**: every bank exports slightly differently. Build format auto-detection early; a wrong column mapping silently produces garbage data.
- **Categorisation consistency**: Claude may categorise the same merchant differently across batches. Store a `merchant_rules` table: `{merchant_pattern, canonical_category}` built from corrections, and apply it pre-Claude to reduce API calls and improve consistency.
- **Currency handling**: if you have multi-currency accounts, always convert to a base currency using the transaction date's rate before any aggregation. Store `fx_rate` on each row.
- **LLM hallucination in Q&A**: always show the raw SQL that was executed so the user can spot wrong queries. Never answer a financial question without showing the query behind it.

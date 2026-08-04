# finance-assistant — Local-First Personal Finance Copilot

**Source:** [github.com/googlarz/finance-assistant](https://github.com/googlarz/finance-assistant)  
**Stars:** 112 commits · **Language:** Python · **Maintainer:** googlarz  
**Date discovered:** 2026-08-04

## What it is

A personal finance copilot that runs entirely on your machine and talks to Claude Code. The key differentiator is **law-accurate tax math** — not AI guesses. For six countries (Germany, UK, US, France, Netherlands, Poland), it runs Python that encodes the actual statutory brackets and deductions, validated against 33 official tax authority test cases.

Beyond tax: budget tracking, debt optimization (avalanche/snowball), Monte Carlo FIRE projections, and bank-statement import for 14+ CSV formats. All data stays local in SQLite with Fernet (AES-128-CBC) encryption.

You query it through Claude Code: "What did I spend on dining last quarter?" or "Run FIRE projection at 4% SWR" — Claude reads the local DB via skill, runs the math, and replies in plain language.

## Why it fits

- Core interest area: **personal finance AI** with real depth (not toy expense categoriser)
- Uses **Claude Code as the UI** — no separate app to maintain
- **Local-first, no cloud** — private financial data stays on device
- Weekend-buildable: it's a Python skill + SQLite schema, not a complex backend
- Fills a real gap: most finance tools either lack AI or fake the math

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Python + SQLite + Claude skill; simplified tax for 1 country is a weekend |
| fills_gap | 1 | No other Claude Code skill does local-first finance with real tax math |
| novel | 1 | Statute-backed calculations validated against official test cases |
| daily_utility | 1 | Track spending, run projections; replaces multiple fintech subscriptions |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Python 3.11+
SQLite (local, encrypted with Fernet)
Claude Code skill (SKILL.md) — conversational interface
pandas — CSV parsing for bank imports
python-dotenv — secure key management
```

No external API needed for core functionality; Claude calls Python directly via skill.

## MVP Scope (1 Claude session)

A minimal version that does just three things:
1. Imports one bank CSV format (UK Monzo or US Chase)
2. Categorises transactions (regex + Claude annotation)
3. Reports monthly spending by category + running total

Skip tax math and projections for MVP — those are Phase 3+.

## Phases

### Phase 1: Local DB + Import (3-4h)
- Design SQLite schema: `accounts`, `transactions`, `categories`
- Write import parser for one bank CSV format (e.g., Monzo export)
- Add Fernet encryption to the DB file at rest
- Test: import 3 months of statements, verify row count

### Phase 2: Claude Skill Integration (2-3h)
- Write `SKILL.md` that describes available functions and how to call them
- Expose: `query_spending(period, category)`, `summary(month)`, `top_merchants(n)`
- Test via Claude Code: "Show me my top 10 merchants in July 2026"
- Add natural language date parsing (last month, this quarter, YTD)

### Phase 3: Real Tax Math (4-6h)
- Implement one country (UK or US) income tax calculator in pure Python
- Validate against 5 official test vectors from the tax authority website
- Expose `tax_estimate(gross_income, year)` to Claude skill
- Guard with a clear disclaimer in SKILL.md: "statutory approximation, not advice"

### Phase 4: Projections + Debt (3-4h)
- Monte Carlo FIRE: randomise real return series from MSCI ACWI history
- Debt optimizer: avalanche vs snowball comparison table
- Expose both via skill functions

### Phase 5: Multi-bank + Backup (2h)
- Add 2-3 more bank CSV formats (Chase, Barclays, N26)
- Encrypted backup to a local file (not cloud); restore script
- Add `CLAUDE.md` rule: run finance summary every Monday

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Local DB + Import | 3-4h |
| Claude Skill | 2-3h |
| Tax Math | 4-6h |
| Projections | 3-4h |
| Multi-bank + Backup | 2h |
| **Total** | **14-19h (~2 weekends)** |

Phase 1-2 alone proves the concept: **5-7h (1 weekend session)**.

## Blockers / Risks

- Bank CSV formats differ per region and update without warning — test against real exports before coding
- Tax math for multiple countries is high-effort; scope to one country for MVP
- Fernet key management: losing the key = losing the DB; document recovery from day one
- Claude skill context limits: don't load raw transaction rows into context; expose aggregate functions only
- Multi-currency transactions (credit card in foreign currency) need a FX rate source — use a cached JSON file from ECB, not live API calls

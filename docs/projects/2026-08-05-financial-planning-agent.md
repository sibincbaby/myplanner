# financial-planning-agent — Personal Finance Agent Skill for Claude Code

**Source:** [github.com/aronszanto/financial-planning-agent](https://github.com/aronszanto/financial-planning-agent)  
**Language:** Python · **Platform:** Claude Code / Cursor agent skill  
**Date discovered:** 2026-08-05

## What it is

A Claude Code agent skill that handles personal finance end-to-end: import bank statements (PDF, CSV, or screenshot), auto-classify expenses, generate monthly budget vs. actuals reports, answer tax prep questions from your documents, and project savings goals — all running locally via Claude with your data never leaving your machine.

The skill integrates with the Claude Code skill framework: you install it, point it at a private data directory, and then ask natural language questions like "What did I spend on food in July?" or "Am I on track for my emergency fund goal?" Claude reasons over your documents directly.

## Why it fits

- Core interest: **personal finance AI** — tax prep, expense tracking, budget analysis
- Core interest: **Claude/LLM tooling** — native agent skill, runs entirely in Claude Code
- `weekend_buildable = 1`: the agent skill scaffold is the reference; extending it with your own categories and bank formats is 1-2 sessions
- No external service: private data stays local, no third-party sync required

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Skill template is established; adapting to your banks/categories is a weekend |
| fills_gap | 1 | Existing finance tools (Mint, YNAB) don't integrate with Claude Code's agent loop |
| novel | 1 | Agent skill approach — finance data as live context in your coding session — is meaningfully new |
| daily_utility | 0 | Weekly/monthly review cadence, not a daily-use tool |
| **Total** | **3/4** | **VIABLE** |

## Stack Recommendation

```
Python 3.12+            — skill runtime
Claude Code             — agent harness (claude skill install)
pdfplumber / pandas     — PDF/CSV bank statement parsing
SQLite                  — local expense store
Claude Sonnet           — reasoning, categorisation, advice
Markdown templates      — report output format
```

No external APIs needed beyond your LLM provider.

## MVP Scope (1 Claude session)

1. Install the skill and point it at a sample bank statement CSV
2. Confirm Claude can classify 20+ transactions into custom categories
3. Generate one monthly summary report (totals by category, biggest line items)
4. Ask one tax question: "Find all home office related expenses" — verify recall

That proves the core loop in a single session.

## Phases

### Phase 1: Install + First Statement (2-3h)
- Clone and `claude skills install financial-planning-agent`
- Create your private `~/finance-data/` directory
- Download one month of bank statement as CSV
- Run: "Classify last month's expenses" — verify categories make sense
- Customise category list in `config.yaml` for your spending patterns

### Phase 2: Multi-Bank Import (2-3h)
- Add PDF parsing for your bank's statement format (pdfplumber)
- Test with a credit card PDF and a bank account PDF simultaneously
- Handle deduplication (same charge on both bank and credit card)
- Store classified transactions in local SQLite for fast re-querying

### Phase 3: Monthly Budget Report (2h)
- Define monthly budget limits per category in `config.yaml`
- Build a report template: actual vs. budget, over/under, trend vs. last month
- Have Claude generate a 3-sentence narrative summary of the month
- Output to Markdown file in `~/finance-data/reports/`

### Phase 4: Tax Prep Q&A (2-3h)
- Ingest PDF receipts and statements into a local vector index (sqlite-vss)
- Expose a `/tax-question` command: "Show me all deductible home expenses"
- Test with common deduction categories (home office, professional development, equipment)
- Export a dedution summary CSV for your accountant

### Phase 5: Savings Goal Tracker (1-2h)
- Define goals in `config.yaml`: name, target amount, deadline
- Each month, compute progress and projected completion date
- Generate a one-line status per goal in the monthly report
- Alert via Claude Code if you're falling behind a goal by >10%

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Install + First Statement | 2-3h |
| Multi-Bank Import | 2-3h |
| Monthly Budget Report | 2h |
| Tax Prep Q&A | 2-3h |
| Savings Goal Tracker | 1-2h |
| **Total** | **9-13h (~2 weekends)** |

Phase 1-3 (working monthly reports): **6-8h (1 weekend)**.

## Blockers / Risks

- PDF statement formats vary by bank and change without notice — maintain a parser per institution and expect to fix one every few months
- Claude's transaction classification can mis-categorise edge cases (e.g., "Amazon" could be groceries, electronics, or cloud bills) — keep a `corrections.csv` override file
- Tax advice from an LLM is not a substitute for a qualified accountant; use for organisation, not compliance decisions
- The skill framework API may change between Claude Code releases — pin the skill version and test after each Claude Code update

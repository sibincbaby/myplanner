# FinScope — local-first open-source Claude finance tracker

**Source:** [Anthropic's Personal Finance in Claude](https://claude.com/resources/articles/introducing-personal-finance-in-claude) (Nov 5 2026, US Pro/Max/Ultra only, Plaid-backed, read-only)
**Discovered:** 2026-11-21
**Viability:** 4/4

> Anthropic launched Personal Finance on Nov 5 2026: connect your US bank via Plaid and ask Claude questions about your spending. It's read-only, US-only, and requires a paid subscription. FinScope is the open-source, local-first alternative: import any bank's CSV export, ask Claude questions in plain English, and keep all transaction data in a local SQLite file. No Plaid account, no paid tier, no US requirement.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

- **weekend_buildable=1:** CSV parser + SQLite + Claude API for NL-to-SQL queries + a Next.js UI. The core loop (import → ask → answer) is 3–4 files. Phase 1 is achievable in one session.
- **fills_gap=1:** Anthropic's version is US-only and subscription-locked. `aurelio-finance` (seen.json: LosaLosSantos) is a non-AI receipt photo tool. `cc_expense_tracker` (gilangsatria09) is narrow-country. The open-source, any-country, any-bank, fully-local angle is unoccupied.
- **novel=1:** No widely-known open-source "Claude + CSV bank import + NL queries" tool found. The main searches returned Anthropic's own product and two non-AI trackers.
- **daily_utility=1:** replaces weekly manual review sessions with a live "ask anything" interface. Daily morning check ("anything unusual yesterday?") fits the user's existing tracking habit.

---

## Implementation Plan

### Overview

A Next.js app that runs entirely locally. No server, no accounts.

```
npm run dev          # local Next.js at http://localhost:3000
```

User flow:
1. Drop a bank CSV → transactions parsed and stored in `~/.finscope/db.sqlite`
2. Ask questions: "How much on dining in October?" "What's my biggest recurring expense?"
3. Claude generates + runs SQL → returns a natural-language answer with the supporting rows
4. Category dashboard and monthly trend charts

### Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | SQLite via `better-sqlite3` |
| LLM | Claude claude-sonnet-4-6 via `@anthropic-ai/sdk` |
| CSV parsing | `papaparse` |
| Charts | Recharts |
| Styling | Tailwind CSS |

### MVP Scope (Phase 1–2, ~1 Claude session)

- CSV import: auto-detect column layout from the first row (date, amount, description)
- Transactions stored in SQLite: `id, date, amount_cents, description, category`
- One NL chat box → Claude generates SQL → runs it → returns answer
- Simple transaction list with search and date filter

**Done when:** dropping a Monzo/HSBC/Chase CSV, asking "How much did I spend on coffee last month?" and getting a correct answer.

### Phases

#### Phase 0: Schema + CSV parser (1h)
1. `better-sqlite3` setup + migration: `transactions(id INTEGER PRIMARY KEY, date TEXT, amount_cents INTEGER, description TEXT, category TEXT, raw_description TEXT)`
2. `lib/csv-import.ts`: auto-detect column layout from first row, normalize date + amount (handle both `£1.23` and `1.23`), insert rows
3. Test with 3 real bank CSV formats (Monzo, HSBC, generic US)

#### Phase 1: Claude NL query layer (2h)
1. `lib/ask-claude.ts`: system prompt includes the SQLite schema + current date; user message is the question
2. Claude returns SQL + a natural-language explanation in a structured JSON response
3. Run the SQL with `better-sqlite3`, return rows + Claude's explanation to the UI
4. Guard: only `SELECT` queries allowed (strip any mutating statement before execution)

#### Phase 2: Category auto-tagger (1h)
1. After import, batch-call Claude: `categorize([{ description, amount }])` → category per row
2. Categories: Dining · Groceries · Transport · Entertainment · Utilities · Shopping · Income · Other
3. UI: editable category chips on each row; re-categorize on edit

#### Phase 3: Dashboard (2h)
1. Recharts: monthly spending bar chart + category donut chart
2. Summary cards: monthly spend total, biggest category, biggest single transaction, net (income − spend)
3. Budget goals: set a monthly limit per category, show fill bar

#### Phase 4: Plaid integration (optional, 2h)
1. Add `plaid` NPM package
2. Link Account flow in a `/settings/bank` page (Plaid Link widget)
3. Nightly sync: pull new transactions into SQLite, skip duplicates by `transaction_id`

### Effort Estimate

~2 Claude sessions (10–14h). Phase 0+1 in one session, Phase 2+3 in the second. Phase 4 is optional and adds a full session.

### Blockers / Risks

| Risk | Mitigation |
|------|-----------|
| CSV format variation | Auto-detect covers 5 common formats; fallback manual column-mapping UI |
| Large transaction history | Never send raw data to Claude; pass only the schema + generate SQL |
| Plaid account approval | Skip entirely for MVP; CSV import covers the core use case |
| Data privacy | Default DB path `~/.finscope/db.sqlite`, outside repo; `.gitignore` entry added in Phase 0 |
| Amount sign conventions | Some banks use negative for spending, some positive; normalize on import |

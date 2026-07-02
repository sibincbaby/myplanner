# Expense Budget Tracker — Self-Hosted Finance with AI SQL Query API

**Inspired by:** [github.com/kirill-markin/expense-budget-tracker](https://github.com/kirill-markin/expense-budget-tracker)  
**Source:** GitHub Search / personal finance AI (v1.0.0 March 2026, 12 stars)  
**Interest score:** 4/4 (personal finance AI + budget tracking + daily utility + novel AI SQL API layer)

## What It Is

A self-hosted personal finance tracker (TypeScript + PostgreSQL) with a built-in AI SQL Query API. You get a web UI for logging expenses and budgets, plus an HTTP endpoint that generates API keys for LLM agents — so Claude can directly query, categorise, and analyse your financial data by writing SQL. The "AI-first" design philosophy: flat tables that are hard to misuse, minimal joins, and natural-language query support out of the box.

## Why Build Your Own

The reference project is minimal (12 stars, early days) and lacks a few things you'd want: multi-account support (checking, savings, credit cards), receipt photo parsing via Claude Vision, automatic categorisation with your own category taxonomy, and a Flutter mobile UI for quick expense entry. Building your own also means you choose the schema and never export your data to a third-party service. One solid session for MVP.

## Stack Recommendation

- **Next.js 15 (App Router)** — web UI + API routes in one project
- **PostgreSQL + Drizzle ORM** — relational data with migrations
- **Claude API** — Vision for receipt parsing, text for SQL generation and summaries
- **NextAuth.js** — simple email magic-link auth to secure the local instance
- **Docker Compose** — one-command local deployment (Postgres + Next.js)
- **Flutter** (Phase 5) — mobile quick-entry app

## MVP Scope

Web app to log expense (amount, merchant, category, account, date) and view a monthly summary table. Claude can query via `GET /api/ai-query?q=<natural language>` which converts the question to SQL, runs it against Postgres, and returns structured JSON. Secured by a long-lived API key.

---

## Implementation Phases

### Phase 1 — Database Schema + Next.js Skeleton
**Goal:** A Next.js app connected to Postgres with a basic expense log schema.

**Files:**
- `db/schema.ts` — Drizzle schema definitions
- `app/page.tsx` — dashboard placeholder
- `docker-compose.yml` — Postgres + app services

**Schema:**
```ts
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),       // "Chase Sapphire", "Savings"
  type: text('type').notNull(),        // checking | savings | credit | cash
  currency: text('currency').default('USD'),
});

export const expenses = pgTable('expenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  account_id: uuid('account_id').references(() => accounts.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  merchant: text('merchant'),
  category: text('category'),
  note: text('note'),
  date: date('date').notNull(),
  created_at: timestamp('created_at').defaultNow(),
});

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  month: text('month').notNull(),   // "2026-07"
  limit_amount: numeric('limit_amount', { precision: 12, scale: 2 }),
});
```

**Key steps:**
1. `npx create-next-app@latest finance-tracker --typescript --tailwind --app`
2. `bun add drizzle-orm pg drizzle-kit`
3. Create schema file, run `drizzle-kit push` against Docker Postgres
4. Seed 2 accounts and 5 sample expenses
5. `app/page.tsx` lists last 10 expenses from Drizzle query

**Verify:** `docker compose up`, visit `localhost:3000` — see 5 sample expenses listed.

---

### Phase 2 — Expense Entry UI
**Goal:** A form to add expenses quickly with keyboard-friendly UX.

**Files:**
- `app/add/page.tsx` — expense entry form
- `app/actions/expenses.ts` — Server Action to insert via Drizzle

**Key steps:**
1. Form fields: date (default today), amount, merchant, category (dropdown), account (dropdown), note
2. Category autocomplete from a predefined list (Food, Transport, Housing, Entertainment, Health, Shopping, Other)
3. Server Action validates with Zod and inserts into `expenses`
4. After submit: redirect to dashboard with success toast
5. Add a basic monthly summary: group expenses by category, show vs budget

**Verify:** Submit a $45.00 dinner at "Nobu", category "Food", account "Chase" → appears in dashboard under Food.

---

### Phase 3 — Claude AI SQL Query API
**Goal:** An HTTP endpoint that accepts natural-language questions and returns structured JSON from the database.

**Files:**
- `app/api/ai-query/route.ts` — `GET` handler
- `lib/claude-sql.ts` — Claude prompt → SQL → result pipeline
- `lib/api-keys.ts` — long-lived API key management

**Key steps:**
1. `GET /api/ai-query?q=<question>&key=<api-key>` — validate key, then:
2. `ClaudeSql.query(question)`:
   - System: "You are a personal finance SQL assistant. The Postgres schema is: [schema DDL]. Generate a read-only SQL SELECT query to answer the user's question. Return only valid SQL, no explanation."
   - User: the question
3. Execute the generated SQL via Drizzle's raw query with a read-only Postgres role
4. Return `{question, sql, rows, generated_at}` as JSON
5. Store a long-lived API key in `process.env.AI_QUERY_API_KEY` (no DB needed for single-user)

**Verify:** `curl "localhost:3000/api/ai-query?q=how+much+did+I+spend+on+food+in+June%3F&key=mykey"` → `{sql: "SELECT...", rows: [{sum: "342.50"}]}`

---

### Phase 4 — Receipt Photo Parsing
**Goal:** Snap a photo of a receipt and have Claude Vision extract and pre-fill the expense form.

**Files:**
- `app/add/receipt/page.tsx` — camera/upload UI
- `lib/receipt-parser.ts` — Claude Vision API call + structured extraction

**Key steps:**
1. Add image upload (file input) or camera capture (`<input type="file" accept="image/*" capture>` on mobile)
2. `ReceiptParser.parse(imageBase64)`:
   - Send to Claude with system: "Extract expense data from this receipt image. Return JSON: {merchant, amount, date, items: [{name, price}], category_suggestion}"
   - Use `claude-sonnet-5` for best vision accuracy
3. Pre-fill the expense entry form with extracted values; user confirms
4. Store the receipt image in a local `/uploads` directory (or S3 for production)

**Verify:** Upload a restaurant receipt photo → form pre-fills with merchant name, total amount, date. Confirm → expense saved.

---

### Phase 5 — Flutter Mobile Quick-Entry
**Goal:** A minimal Flutter app for sub-5-second expense logging while on the go.

**Files:**
- `flutter_app/lib/main.dart` — single-screen quick-add form
- `flutter_app/lib/services/api_service.dart` — POST to Next.js Server Action via HTTP

**Key steps:**
1. `flutter create finance_mobile && cd finance_mobile`
2. Single screen: large amount input (numpad), merchant field, category picker (scrollable chips), submit button
3. `ApiService.addExpense()` POSTs to `https://your-server/api/expenses` with Basic Auth
4. Success: haptic feedback + reset form for next entry
5. Add a "Today's total" widget at top fetching from `GET /api/expenses?date=today`

**Verify:** On phone, open app, enter "$12.50 / Coffee / Food", tap Add — expense appears in web dashboard instantly.

---

## Estimated Effort

**1.5 Claude sessions.** Phases 1–3 take ~2.5 hours and produce a fully functional finance tracker with AI query API. Phase 4 (receipts) adds 45 min. Phase 5 (Flutter) is 1 hour.

## Potential Blockers

- **SQL injection via Claude-generated queries**: always use a read-only Postgres role for the AI query endpoint; never allow `INSERT`/`UPDATE`/`DELETE` from the AI path
- **Claude SQL hallucination**: Claude may generate valid-looking but logically wrong SQL. Add a query timeout (5 seconds) and row-count cap (max 1000 rows) to prevent runaway queries
- **Receipt parsing accuracy**: low-contrast or crumpled receipts fail. Add a "manual override" button alongside the pre-filled form — never auto-submit without user confirmation
- **Self-hosting on a VPS**: Postgres needs regular backups. Use `pg_dump` via a daily cron and ship to a personal S3/B2 bucket. Add this to Phase 1 before you accumulate real data.

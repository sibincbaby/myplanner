# FinFlutter

> A mobile-first AI personal finance tracker built in Flutter: snap or type an expense, Claude auto-categorizes it, and a monthly AI-written insights report tells you exactly where your money went and what to change.

**Inspired by:** [dj2313/SmartBudget](https://github.com/dj2313/SmartBudget)  
**Date discovered:** 2026-07-31

---

## What gap it fills

SmartBudget (2 stars, early-stage) demonstrates the core concept: Flutter + Firebase + LLM = personal finance manager that actually understands context. But SmartBudget has no receipt scanning, no natural-language query, and no AI-generated insight narrative — it's a categorized ledger with an AI chat bolt-on.

FinFlutter goes further: the AI layer is the primary interface, not an afterthought. You log an expense by typing or dictating "coffee and croissant at the airport, $14.50" and Claude parses vendor, amount, category (Travel > Food), and trip context automatically. End of month, a single tap runs an AI-generated report: "You spent 23% more on restaurants this month vs last — 4 airport meals during the Berlin trip account for most of that. Your recurring subscriptions have held steady at $84." The ledger is just the data layer; Claude is the analyst.

Concrete daily value: replace the friction of opening a budget spreadsheet or tapping through a category picker. One sentence logs the expense; one tap gives you the monthly picture. Personal finance AI finally fast enough to use every single day.

Viability score: **4/4** (weekend_buildable ✅, fills_gap ✅, novel ✅, daily_utility ✅)

---

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| UI | Flutter 3 | Cross-platform (iOS/Android), fast widget composition |
| State | Riverpod | Predictable async state; works well with Firebase streams |
| Storage | Firebase Firestore | Real-time sync, offline-first, free tier covers personal use |
| Auth | Firebase Auth (Google sign-in) | One-tap, no password to manage |
| AI | Claude API (`claude-haiku-4-5-20251001`) | Fast + cheap for categorization; `claude-sonnet-5` for monthly report |
| Receipt OCR | Gemini Vision API or Flutter `google_mlkit_text_recognition` | On-device OCR for receipt images; free tier |
| Notifications | Firebase Cloud Messaging + local notifications | Daily spending nudge, monthly report ready alert |

---

## MVP scope (1-2 Claude sessions)

**Session 1 — Core expense logging + categorization:**
- `ExpenseEntry` Firestore model: `{id, raw_text, amount, vendor, category, subcategory, date, trip_context, ai_parsed: bool}`
- `ExpenseInput` widget: text field + voice button; on submit, call Claude with prompt: "Parse this expense into: amount (number), vendor (string), category (one of: Food, Transport, Accommodation, Shopping, Entertainment, Health, Subscriptions, Other), subcategory, trip_context if applicable. Raw: {input}"
- Store parsed result in Firestore; show parsed card with edit-before-save confirmation
- `ExpenseList` screen: scrollable list of this month's expenses, grouped by category with subtotals
- Test: 20 varied expense inputs, verify categorization accuracy

**Session 2 — Monthly report + budget view:**
- Month summary Firestore aggregation: total by category, vs prior month delta, subscription detection (recurring same vendor + amount)
- `MonthlyReport` screen: tap "Generate Report" → Claude API call with the month's aggregated data → streamed narrative report rendered as markdown
- Budget widget: set monthly limit per category; color-coded progress bar (green / amber / red)
- Home screen: current month total, top 3 categories, days remaining in month, quick-add button

---

## 3-Phase roadmap

### Phase 1 — Log + categorize (Session 1)
Flutter expense entry widget. Claude categorization on submit. Firestore storage. Expense list view grouped by category with totals.

### Phase 2 — Report + budget (Session 2)
Monthly AI-generated insight report. Per-category budget limits with progress tracking. Subscription auto-detection. Month-over-month comparison.

### Phase 3 — Receipt scan + recurring (Session 3)
Camera receipt scanning with on-device OCR → pre-populate the expense entry form. Recurring expense templates (auto-suggest when vendor matches a prior entry). Export to CSV for tax purposes. Optional: Firebase Cloud Function to push a weekly spending digest to phone notifications.

---

## Effort estimate

| Phase | Effort | Output |
|-------|--------|--------|
| Phase 1 | 1 Claude session (~90 min) | Working expense entry + categorization + list view |
| Phase 2 | 1 Claude session (~90 min) | Monthly report + budgets + subscription detection |
| Phase 3 | 1 Claude session (~90 min) | Receipt scan + recurring templates + CSV export |

Total: **3 sessions, ~4.5 hours elapsed**

---

## Blockers / watch-outs

- **Categorization drift**: Claude's category choices will vary across prompts unless the category list is enumerated explicitly in every call. Include the full category taxonomy in the system prompt and request structured JSON output.
- **Firestore costs**: Personal use stays well within the free tier (50k reads/day, 20k writes/day), but the monthly report aggregation query (read all transactions for the month) counts per document. Keep each month's summary in a single aggregation document, updated on each expense write.
- **Voice input latency**: Flutter `speech_to_text` can add 1–2s on first cold start on Android. Pre-warm the speech engine on app launch; show an "Initializing…" state clearly.
- **Claude API key security**: Never ship the key in the Flutter app binary. Route all Claude API calls through a Firebase Cloud Function that holds the key server-side. Takes ~30 min in Session 1 to set up but prevents key exposure.

---

## Why now

The user interest profile explicitly calls out personal finance AI and Flutter/web AI apps. SmartBudget shows the Flutter + Firebase + LLM combination is achievable in a small project, but its 2-star status means the space isn't saturated — building an opinionated, AI-first version (where the LLM is the interface, not the assistant) is genuinely novel. Claude Haiku's latency (~200ms) is now fast enough to categorize an expense inline before the user puts their phone down. The personal finance problem is also one where daily utility is unambiguous: if you track expenses, you use this every single day.

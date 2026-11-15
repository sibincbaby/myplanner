# Split Capture → one sentence becomes an expense, a work log and a diary line (extend PesaPilot)

**Source:** <https://github.com/8tdknpvgt2-prog/diary> (日迹 Riji, Node + `node:sqlite`, created 2026-11-14, 0★)
**Discovered:** 2026-11-16
**Viability:** 4/4

> Riji's core idea is a single input box. You type "午饭 32，另外 Kafka 那个坑解决了" ("lunch 32, and I finally fixed that Kafka bug") and the model splits it into three records: an expense of ¥32 under food, a work-log entry for the Kafka bug (resolved, 75 min), and a one-line diary entry. You confirm once and each record goes into its own module. The user's own Flutter expense app, PesaPilot, already parses messy text like "dosa 20, tea 25" with Gemini. But its prompt ends with *"If there is no expense, return an empty list"*, and `IngestService` then emits `IngestNoExpense`. Anything in a sentence that isn't an expense is thrown away. This plan adds Riji's split to the capture box the user already has, instead of building another journal app.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

- **weekend_buildable=1:** the work is one schema change in `expense_extractor.dart`, two Drift tables with a migration, a routing branch in `IngestService._process`, a confirm sheet and two list tabs. The Gemini client, the offline queue (`PendingInputs`), retry/backoff, voice and image input, and backup all exist and stay as they are. About one Claude session.
- **fills_gap=1:** the repo holds about 10 unbuilt journal/diary plans (Jotsy 11-10, Lumma 11-03, Journiv 10-30, my-diary-voice-ai 10-29, Echo 10-06, Diaryx 09-28 …) and more than 14 finance plans. Every one is a separate app, and none got built. The missing piece is a single place to type that accepts any kind of entry. PesaPilot already has the capture surface (text, voice note, screenshot, quick-capture tile). It just drops anything that isn't an expense.
- **novel=1:** Riji (0★, Chinese UI, desktop + LAN PWA, DeepSeek) is the only project with this exact shape. The prior-art sweep came back empty for the router itself. Six phrasings returned 0 hits ("one input expense diary", "quick capture classify expense journal llm", "natural language expense diary log", "life log llm categorize", "text to expense and journal llm", "capture inbox llm route notes expenses"). The broadened single-phrase queries found only apps that keep journal and expenses side by side with no AI split: `cherriy` (2★, Flutter), `NotariFlow` (2★, Flutter), `PlanDo` (9★, Windows), `ledger-diary` (1★). They also found AI capture tools that send input to tasks/notes but never to money: `ilramdhan/second-brain` (8★), `TaoSheng` (402★, all-day audio → todos and memories), `beayy` (94★, auto-journal). None of them split one sentence into money, work and diary records.
- **daily_utility=1:** expenses are logged every day. With this change, the same tap also captures the day's work and diary notes.

**Shape:** extend an existing app. No new repo. Work in `~/my-works/pesa-pilot`, which is **not a git repo yet**, so Phase 0 runs `git init` before touching anything.

---

## Implementation Plan

### Overview

```
input (text | voice note | image)
  → PendingInputs (unchanged offline queue)
  → CaptureExtractor (was ExpenseExtractor): Gemini JSON with three arrays
       { expenses: [...], work: [...], diary: [...] }
  → if work/diary are empty → old path (save expenses directly, same as today)
  → else → SplitConfirmSheet: one card per item, untick to drop, tap to edit
  → Expenses / WorkLogs / DiaryEntries tables
```

If the input contains only expenses, the app behaves exactly as it does today. The confirm sheet appears only when the model finds something besides an expense, so the "dosa 20, tea 25" fast path gets no extra tap.

### Stack Recommendation

Use only what is already in `pubspec.yaml`. No new dependencies.
- Flutter + `flutter_riverpod` ^3.3, `drift` ^2.33 (+ `drift_dev` codegen), `go_router` ^17.3.
- The existing `GeminiClient` with `responseSchema` (structured output) and the existing `profile.modelId`.
- Tests: the existing `test/expense_extractor_test.dart`, `ingest_service_test.dart` and `database_test.dart` patterns.

### MVP Scope

In:
1. Extend the extractor schema and prompt to return three arrays:
   - `expenses` (unchanged fields),
   - `work`: `{ title, project?, status: done|in_progress|blocked, minutes?, note? }`,
   - `diary`: `{ text, mood?: -2..2 }`. The text is rewritten as a first-person line in the user's `profile.language`, and the user's own words are kept in `rawInput`.
2. Add Drift tables `WorkLogs` and `DiaryEntries` (both with `occurredAt`, `source`, `rawInput`, `createdAt`), bump `kDbSchemaVersion` (3 → 4), and add a `m.createTable` migration.
3. Routing in `IngestService._process`: if only expenses came back, save them as today. If anything else came back, emit a new `IngestNeedsConfirm(item.id, CaptureResult)` and save nothing until the user confirms.
4. `SplitConfirmSheet`: grouped cards (₹ / Work / Diary), each with a checkbox and an edit button. "Save all" writes everything in one Drift `transaction`.
5. Two read-only list tabs in `HomeShell`: **Work** (grouped by day, showing total minutes) and **Diary** (grouped by day).
6. Update `IngestNoExpense`: fire it only when *all three* arrays are empty.

Out: AI weekly review of the work log, mood charts, search, export to `dev-diary`, and changes to the chat/GenUI screen.

### Implementation Phases

#### Phase 0: Put the project under git and get a green baseline (15 min)
1. `cd ~/my-works/pesa-pilot && git init && git add -A && git commit -m "baseline"`. Ask the user **personal or work** before adding any remote, per CLAUDE.md. Don't push.
2. `export PATH="$HOME/flutter/flutter/bin:$PATH"` (the SDK is not at `~/flutter/bin`), then run `flutter pub get && dart run build_runner build -d && flutter test`. Write down the baseline pass count.

**Done when:** the baseline commit exists and tests are green, or any pre-existing failures are listed so they aren't blamed on this work.

#### Phase 1: Extractor (TDD, about 1 h)
**Files:** `lib/services/gemini/expense_extractor.dart` → rename the class to `CaptureExtractor`, but keep `ExpenseExtractor` as a `typedef`-style wrapper so chat still compiles. Add `lib/services/gemini/parsed_capture.dart` (`ParsedWork`, `ParsedDiary`, `CaptureResult { expenses, work, diary; bool get isEmpty; bool get expensesOnly; }`).

1. Write tests first in `test/expense_extractor_test.dart`:
   - `parseResponse` for the old shape `{expenses:[…]}`. It must still parse, and `work`/`diary` must be empty.
   - The new shape with all three arrays.
   - Garbage, an empty string, and `work` items missing a `title` (dropped).
2. Schema: add `work` and `diary` arrays and keep `required: ['expenses']` so old-shape answers still validate.
3. Prompt: replace the last rule with:
   *"Also extract non-expense content. Work/progress statements ('fixed the Kafka bug', 'PR merged', 'stuck on login API') go to `work`. Personal events, feelings or observations go to `diary`. One sentence can produce items in several arrays. Never invent content. If a part fits nowhere, leave it out. Return empty arrays when nothing applies."*
4. Add prompt fixtures for the user's real mix: `"dosa 20, tea 25"` (expenses only), `"lunch 120, fixed lwdb setdb bug 40 min, felt good"` (all three), and a Malayalam-English mix: `"chaya 15, ഇന്ന് മഴ ആയിരുന്നു"` ("tea 15, it rained today"). These are documented examples for Phase 4's live check. Unit tests use canned JSON only and never call the network.

**Done when:** the extractor tests are green and the old tests still pass.

#### Phase 2: Tables and migration (about 45 min)
**Files:** `lib/data/db/tables.dart`, `lib/data/db/database.dart`, `lib/core/constants.dart` (`kDbSchemaVersion`).
1. Add `class WorkLogs extends Table` and `class DiaryEntries extends Table`, and add both to `@DriftDatabase(tables: [...])`.
2. Bump the schema version to 4. In `onUpgrade`, `if (from < 4) { await m.createTable(workLogs); await m.createTable(diaryEntries); }`.
3. DAO methods: `insertWork`, `insertDiary`, `watchWorkByDay`, `watchDiaryByDay`, and `saveCapture(CaptureResult)` inside one `transaction`.
4. Backup needs no change: `lib/services/backup/db_backup.dart` streams the whole SQLite file plus its sidecars, so the new tables are included automatically. Add one assertion to `db_backup_test.dart` that a restored DB has the `work_logs` table.
5. `database_test.dart`: a migration test from the previous version using an in-memory DB, plus a round-trip test of `saveCapture`.

#### Phase 3: Routing and confirm sheet (about 1.5 h)
**Files:** `lib/services/ingest/ingest_service.dart`, new `lib/features/capture/split_confirm_sheet.dart`, and `lib/features/chat/chat_controller.dart`, which handles `IngestNoExpense` today and is where `IngestNeedsConfirm` opens the sheet.
1. In `_process`: `final r = await CaptureExtractor(client).extract(...)`.
   - `r.isEmpty` → `IngestNoExpense` (unchanged).
   - `r.expensesOnly` → the existing save loop (unchanged behaviour, so the existing `ingest_service_test` must stay green).
   - Otherwise → `IngestNeedsConfirm(item.id, r)`, and keep the `PendingInputs` row until the user confirms or discards, so a crash doesn't lose the input.
2. The sheet groups items under ₹ / Work / Diary, each with a checkbox, tap-to-edit (reuse `edit_expense_sheet.dart` for expenses), **Save** (`saveCapture`, delete the pending row) and **Discard**.
3. Tests: `ingest_service_test.dart` gets a case for each of the three branches, using a fake client.

#### Phase 4: Work and Diary tabs, then a live check (about 1 h)
1. Add two `go_router` routes and two `HomeShell` destinations. Lists are grouped by day. The Work tab shows the day's total minutes and status chips.
2. On a real device, use the user's own Gemini key and type the three Phase 1 fixtures into quick capture. Expected results: fixture 1 saves directly with no sheet; fixture 2 shows a sheet with 1/1/1 items; fixture 3 shows one ₹15 expense and one diary line, and the Malayalam text is understood.
3. Run `flutter analyze` with zero new warnings and `flutter test` with everything green.

### Effort Estimate

About one Claude session (4–5 h): Phase 0 15 min, Phase 1 1 h, Phase 2 45 min, Phase 3 1.5 h, Phase 4 1 h.

### Blockers / Risks

- **Not a git repo, and last touched 2026-06-04.** Phase 0 is required. Confirm with the user that PesaPilot (not CutMyCost) is the expense app they actually use day to day. If it's CutMyCost (`~/my-works/Cashew`, Drift, last commit 2026-09-01), the same plan applies, but CutMyCost has no LLM client today, so add Phase 1b: port `GeminiClient` over (about +1 h).
- **Over-eager splitting.** The model may turn an expense note ("movie with Anu 250") into a diary line as well. That's fine, because the confirm sheet makes it a one-tap untick. Never auto-save anything that isn't an expense.
- **Prompt drift on the expenses-only path.** A bigger prompt can change expense extraction. Keep the existing `expense_extractor_test` fixtures and add a live smoke run of 10 old real inputs (from `Expenses.rawInput`) before and after, then compare the amounts.
- **Privacy:** diary text now goes to Gemini along with expenses. Add one line to the onboarding/settings copy saying so. The API key stays in `flutter_secure_storage` as it does today.

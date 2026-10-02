# PennyWise AI – Offline Flutter Expense Tracker with Local AI

**Source:** <https://f-droid.org/packages/com.pennywiseai.tracker>
**Discovered:** 2026-10-02
**Viability:** 4/4

> Offline-first, local-model SMS parsing is genuinely scarce in the personal finance Flutter space. The design satisfies a hard constraint — bank data never leaves the device — and solves the manual-entry friction that kills finance apps. The Qwen 2.5 local model handles the AI chat without an API key or subscription. Weekend-buildable because the SMS parsing logic is a well-scoped problem: a two-pass pipeline (regex fast path, local model fallback) that stores results in SQLite.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

A working Flutter app that reads SMS, parses transactions, and stores them locally is achievable in one Claude Code session. Plugging in a local model via Ollama REST is a second session. The offline constraint is both the novelty and the scope boundary — it rules out Firebase, cloud AI APIs, and server-side categorisation.

---

## Implementation Plan

**2 Claude Code sessions** to a fully local expense tracker with AI chat.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Framework | Flutter 3.27+ (Dart) | Single codebase for Android/iOS |
| State | Riverpod (hooks_riverpod) | Composable, testable |
| Local DB | SQLite via `drift` | Code-gen DAOs, type-safe queries |
| SMS reading | `telephony` package | Android; no equivalent on iOS |
| SMS parsing | Regex + Ollama REST | Regex handles 90 %; AI handles edge cases |
| Local AI | Ollama running on-device or local network | HTTP REST, no SDK needed |
| Charts | `fl_chart` | Lightweight, no web dependency |
| Notifications | `flutter_local_notifications` | Optional spending alerts |
| Platform | Android primary (iOS has no SMS read API) | Document iOS limitation upfront |

---

## MVP Scope

Android app that reads incoming and existing bank SMS messages, parses them into transactions (amount, merchant, direction), stores them in SQLite, shows a transaction list with categories, and answers plain-English questions about spending via Ollama REST. All data stays on-device.

Out of scope for MVP: iOS support, recurring expense detection, cloud backup, OCR receipts, bank API integrations.

---

## Implementation Phases

### Phase 1: Flutter Scaffold + SMS Reading
**Goal:** App reads SMS messages, filters to likely bank notifications, and displays raw message text.

**Files:**
- `pubspec.yaml` — Flutter 3.27+, deps: riverpod, telephony, drift, drift_flutter, build_runner
- `lib/main.dart` — app entry point, Riverpod `ProviderScope`
- `lib/sms/sms_reader.dart` — `SmsReader`: `readAll()` → `List<SmsMessage>`, `listenIncoming()` → `Stream<SmsMessage>`
- `lib/sms/bank_filter.dart` — `isBankSms(SmsMessage)`: checks sender against a curated allowlist of bank sender IDs (e.g. `HDFCBK`, `ICICIBK`, `SBIINB`)
- `lib/screens/raw_sms_screen.dart` — debug screen listing filtered SMS messages
- `AndroidManifest.xml` — `READ_SMS`, `RECEIVE_SMS` permissions

**Key steps:**
1. Use `Telephony.instance.getInboxSms(filter: SmsFilter.where(SmsColumn.ADDRESS).like("%BK%"))` as a starting point; complement with an explicit sender allowlist from a `assets/bank_senders.json` file.
2. `listenIncoming()` wraps `Telephony.instance.listenIncomingSms` in a `StreamController`; new messages automatically trigger parsing.
3. Request permissions at runtime using `permission_handler`; show a rational dialog explaining why SMS access is needed.
4. Raw SMS debug screen: list of `{sender, timestamp, body}` with a filter toggle (bank / all).

**Verify:** Install on Android device (or emulator with SMS injection). Raw SMS screen shows bank messages. Incoming SMS from a bank sender appears within 2 seconds.

---

### Phase 2: SMS Parsing Pipeline
**Goal:** Bank SMS messages are parsed into structured `Transaction` objects and stored in SQLite.

**Files:**
- `lib/parsing/regex_parser.dart` — `parseWithRegex(SmsMessage)` → `Transaction?`
- `lib/parsing/transaction.dart` — `Transaction` data class: `{id, amount, currency, merchant, direction (debit/credit), rawText, timestamp, category, source (regex/ai)}`
- `lib/db/database.dart` — Drift `AppDatabase` with `TransactionsTable`
- `lib/db/transactions_dao.dart` — `insertTransaction`, `getAllTransactions`, `getByDateRange`
- `lib/screens/transactions_screen.dart` — list of parsed transactions with amount, merchant, direction badge

**Key steps:**
1. `parseWithRegex`: use a set of regex patterns covering common Indian/international bank SMS formats:
   - Debit: `(?:debited|debit|withdrawn).{0,30}Rs\.?\s*([\d,]+\.?\d*)` and merchant from `(?:at|to)\s+([A-Z0-9 &]+?)(?:\s+on|\s+ref|\s+upi|$)`
   - Credit: `(?:credited|credit).{0,30}Rs\.?\s*([\d,]+\.?\d*)` and source from `(?:by|from)\s+([A-Z0-9 &]+?)(?:\s+on|\s+ref|$)`
   - UPI ref: `UPI[- ]?Ref[:\s]+(\d+)` for deduplication
2. Parse `timestamp` from SMS timestamp field (milliseconds since epoch).
3. On parse failure (returns null), queue the message for AI parsing (Phase 3). Store all results in Drift, with `source = 'regex'` or `source = 'ai'` for audit.
4. Deduplicate by UPI ref or `(amount, merchant, timestamp within 5 min)`.
5. `TransactionsScreen`: `ListView.builder` showing amount (coloured green/red for credit/debit), merchant, formatted date. Tap to expand raw SMS.

**Verify:** Inject 10 synthetic bank SMS messages (covering HDFC, ICICI, SBI formats). All 10 parse correctly. Duplicate injection produces no duplicate rows.

---

### Phase 3: Local AI Integration
**Goal:** SMS messages that fail regex parsing are sent to a local Ollama model for extraction; the same model answers natural-language spending questions.

**Files:**
- `lib/ai/ollama_client.dart` — `OllamaClient`: `parseTransaction(rawSms)`, `chat(question, context)`
- `lib/ai/ai_parser.dart` — `parseWithAI(SmsMessage)` → `Transaction?` (calls `OllamaClient.parseTransaction`)
- `lib/screens/chat_screen.dart` — text field + message list for spending Q&A
- `lib/settings/settings_screen.dart` — Ollama URL setting (default `http://localhost:11434`)

**Key steps:**
1. `OllamaClient` uses `http` package to POST to `http://<host>/api/chat` with model `qwen2.5:3b` (fast, ~2 GB RAM).
2. `parseTransaction(rawSms)`: system prompt explains the task; request JSON `{"amount": 450.0, "currency": "INR", "merchant": "Zomato", "direction": "debit"}`. Parse with `json.decode`; return null on failure.
3. In `parseWithAI`, call the model only if `parseWithRegex` returned null. Store result with `source = 'ai'`.
4. `chat(question, context)`: `context` = last 30 days of transactions serialised as a compact JSON array (one line per transaction). System prompt: "You are a personal finance assistant. Answer questions about the user's transactions. Be concise. No markdown."
5. `ChatScreen`: streaming response displayed word by word via `OllamaClient`'s streaming endpoint (`stream: true`).
6. Settings screen allows changing Ollama URL for when Ollama runs on a local server rather than the same device.

**Verify:** Inject an edge-case SMS that the regex misses. It appears in the transaction list with `source = 'ai'`. Ask "how much did I spend on food last week?" in the chat screen → correct answer from local model.

---

### Phase 4: Categories + Spending Charts
**Goal:** Transactions are auto-categorised; a monthly chart shows spending by category.

**Files:**
- `lib/categorisation/categoriser.dart` — `categorise(merchant)` → `Category` enum (Food, Transport, Shopping, Utilities, Entertainment, Healthcare, Other)
- `lib/screens/charts_screen.dart` — monthly bar chart + category pie chart using `fl_chart`
- `lib/db/transactions_dao.dart` — adds `getTotalsBy(period, groupBy: category)` query

**Key steps:**
1. Rule-based categoriser: a `Map<String, Category>` of merchant-name fragments to categories. Covers ~80 % of common merchants (Swiggy/Zomato → Food, Ola/Uber → Transport, etc.).
2. For uncategorised transactions: one-shot Ollama call `categorise("{merchant}")` → single-word category label.
3. Cache the category per unique merchant name in a `MerchantsTable` (drift) to avoid re-querying the model.
4. `ChartsScreen`: two tabs. "Monthly" shows a bar chart of daily spend for the current month. "Categories" shows a pie chart for the last 30 days. Both use `fl_chart`'s `BarChart` and `PieChart` widgets.
5. Allow tapping a category slice to drill into the transaction list filtered to that category.

**Verify:** After parsing 30+ transactions, the pie chart shows reasonable category distribution. Tapping "Food" shows only food transactions.

---

### Phase 5: Spending Alerts + Export
**Goal:** Optional spending alerts notify when a category exceeds a set threshold; export all transactions as CSV.

**Files:**
- `lib/alerts/alert_service.dart` — checks totals against thresholds daily via a background isolate
- `lib/settings/alerts_screen.dart` — set alert thresholds per category
- `lib/export/csv_exporter.dart` — `exportCsv()` → writes to Downloads folder via `path_provider`
- `lib/screens/settings_screen.dart` — adds Export button and Alerts link

**Key steps:**
1. Store thresholds in `SharedPreferences`: `alert_food_threshold = 3000` (INR/month).
2. `AlertService.checkThresholds()`: compute monthly totals from Drift, compare against stored thresholds, fire a `flutter_local_notifications` notification if exceeded.
3. Schedule `checkThresholds()` once per day using `workmanager` background task.
4. CSV export: `id,date,amount,currency,merchant,direction,category,source`. Write to `Downloads/pennywiseai_export_<date>.csv`. Show a snackbar with "Saved to Downloads".

**Verify:** Set a low threshold (e.g. INR 10 for Food). After a food transaction, notification fires within the day. CSV export produces a valid file with all columns.

---

## Estimated Effort

**2 Claude Code sessions** (1 session ≈ 3–4 hours of Claude work).

- **Session 1** — Phases 1 + 2 + basic Phase 4 (categoriser only): Flutter scaffold, SMS reading, regex parser, Drift schema, transactions screen, rule-based categoriser. Most time on regex coverage across bank SMS formats.
- **Session 2** — Phase 3 + charts + alerts + export: Ollama client, AI parser fallback, chat screen, fl_chart integration, spending alerts, CSV export.

---

## Potential Blockers

1. **Android SMS permission restrictions** — Android 12+ restricts SMS access to default SMS apps. The `telephony` package reads the SMS content provider (not the default app slot), which works but requires the `READ_SMS` permission, which Google Play reviewers flag for review. For sideloaded (F-Droid) distribution this is fine; document the Play restriction prominently.
2. **Ollama on-device performance** — `qwen2.5:3b` requires ~3 GB RAM and runs at ~5–10 tokens/s on a mid-range Android device via a local server. The realistic setup is Ollama running on a laptop on the same WiFi network; document this as the primary use case. For fully on-device AI, `qwen2.5:0.5b` (700 MB) is an alternative with lower quality.
3. **Bank SMS format diversity** — Regex patterns are tuned for Indian banks; international formats differ significantly. Provide the `bank_senders.json` and regex set as a community-maintained JSON file with PR-friendly structure.
4. **iOS limitation** — iOS blocks SMS reading by third-party apps entirely. Document iOS as unsupported; provide manual-entry as the only iOS path.

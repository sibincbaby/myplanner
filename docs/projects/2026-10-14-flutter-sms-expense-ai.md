# Flutter SMS Expense Tracker — Auto-Log + AI Finance Copilot

**Source:** GitHub — https://github.com/psuvraneel-cyber/Personal-Expense-Tracker  
**Tagline:** "Flutter expense tracker with automatic SMS-based transaction logging, an AI finance copilot and Firebase sync"  
**Discovered:** 2026-10-14

---

## Why it fits

Most expense trackers require manual entry. This project reads bank transaction SMS notifications automatically (ubiquitous in India and many other markets), extracts amount/merchant/date using an AI model (Groq llama-3.3-70b-versatile), stores them locally, and provides a natural-language copilot to query your spending. The stack (Flutter + Groq + Firebase) is familiar territory. The gap it fills is real: zero-effort expense capture, as opposed to the daily friction of typing transactions. This is a strong candidate for a custom build that swaps Groq for Claude 3.5 Haiku (cheaper, better at structured extraction).

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Flutter app + SMS plugin + LLM call + local Isar DB is a 2-session MVP; Firebase sync is optional Phase 2 |
| fills_gap | 1 | Zero manual-entry expense tracking doesn't exist in current toolkit |
| novel | 1 | SMS-based auto-categorisation with a local-first Flutter UI is not a polished mainstream app |
| daily_utility | 1 | Every bank transaction is automatically logged; copilot is used for weekly reviews |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Flutter 3.x (Dart)** — cross-platform mobile; target Android first (SMS API)
- **telephony** or **flutter_sms** plugin — read incoming SMS; requires `READ_SMS` permission (Android only, sideload or debug mode to bypass Play Store restriction)
- **Claude 3.5 Haiku** (Anthropic API) — structured extraction: `{amount, merchant, date, type}` from raw SMS text; faster and cheaper than Claude Sonnet for this task
- **Isar** — local-first NoSQL DB for Flutter; no server required for MVP
- **Riverpod** — state management
- Optional Phase 2: Firebase Firestore for sync, Recharts-equivalent (fl_chart) for dashboards

## MVP Scope

1. Read last 30 days of SMS from the telephony plugin
2. Send each SMS through Claude Haiku with a structured extraction prompt; parse the JSON response
3. Store parsed transactions in Isar
4. Show a simple list view: date, merchant, amount, category
5. Add a basic "ask your spending" text field backed by Claude (just summarize all transactions in context)

Not in MVP: Firebase sync, biometrics, receipt scanning, charts, budget alerts.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Scaffold Flutter project; add `telephony`, `isar`, `riverpod`, `http` deps; verify SMS read on a debug Android device or emulator with injected test SMS | 1 h |
| 2 | Write the SMS extraction pipeline: send batch of SMS strings to Claude Haiku with JSON schema; parse and store in Isar | 2 h |
| 3 | Basic list UI: grouped by date, color-coded by category (food/transport/shopping/etc.), swipe to delete | 1.5 h |
| 4 | AI copilot text field: "How much did I spend on food last week?" → all transactions in context → Claude summarises | 1 h |
| 5 | Firebase sync (optional): Firestore with email auth for cross-device access; only if MVP feels solid | 2 h |

**Total estimate:** ~5.5 h (2 Claude sessions for phases 1–4; Firebase is optional phase 5)

## Blockers

- `READ_SMS` permission is heavily restricted on Android 10+ for Play Store distribution; for personal use, sideload via `adb install` — this is the primary risk
- Indian bank SMS formats vary by bank; the extraction prompt must handle diverse formats (test with HDFC, SBI, ICICI, Axis patterns)
- Groq llama is used in the reference project; switching to Claude Haiku requires an Anthropic API key and minor prompt adjustment
- iOS does not allow SMS reading — this is Android-only unless you pivot to push notification parsing
- LLM call latency per SMS may be high if processing large SMS history in serial; consider batching 10 SMS per call

## References

- GitHub: https://github.com/psuvraneel-cyber/Personal-Expense-Tracker
- Related: github.com/kylesean/finvo (Finvo — previously discovered 2026-10-13, Flutter + FastAPI + LangGraph, more complex backend)
- Claude Haiku pricing reference: fastest/cheapest Claude model, ideal for high-volume structured extraction
- telephony Flutter plugin: https://pub.dev/packages/telephony

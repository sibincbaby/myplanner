# Trakli — AI-Native Flutter Mobile Finance Tracker

**Source:** GitHub topics: flutter-ai-assistant — https://github.com/trakli/mobile  
**Tagline:** "Open-source AI-native income and expense tracking for mobile"  
**Discovered:** 2026-10-10

---

## Why it fits

The personal finance space is full of either closed SaaS tools or plain Flutter trackers with no intelligence. Trakli is open-source, Flutter-based, and explicitly AI-native — meaning LLM-driven categorisation and insights are first-class features, not bolt-ons. It pairs a mobile app (iOS + Android), a REST backend, and a web UI as separate repos. As a fork base or build target, it gives a clean foundation for a personal finance companion that understands natural language: "How much did I spend on coffee last month?" without opening the app.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Basic Flutter expense tracker + Claude API categorisation is 1–2 sessions |
| fills_gap | 1 | No current daily-driver mobile finance tool in the user's toolkit |
| novel | 1 | Flutter + AI-native architecture (not a Gemini bolt-on to an existing app) |
| daily_utility | 1 | Expense tracking is a daily habit when the friction is low enough |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Flutter** (Dart) — cross-platform mobile; targets iOS and Android
- **Firebase** (Firestore + Auth) — backend for sync and multi-device access
- **Claude API (Haiku 5.5)** — low-cost transaction categorisation and monthly insight generation
- **fl_chart** — already used by Trakli for budget visualisation
- Fork `trakli/mobile` as the starting point to avoid building boilerplate from scratch

## MVP Scope

A Flutter app that lets you log transactions manually, auto-categorises them via Claude API on save, and shows a monthly pie chart breakdown. Cloud sync optional.

Not in MVP: receipt scanning, bank import, recurring transaction detection, web UI.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Fork trakli/mobile; run locally; understand data model (transactions, categories, budgets) | 2 h |
| 2 | Wire Claude Haiku API: on transaction save, call claude to assign category from description | 2 h |
| 3 | Category override UI + confidence display so user can correct AI picks | 2 h |
| 4 | Monthly summary screen: chart + "Claude insight" card (top category, vs last month) | 3 h |
| 5 | Firebase sync (optional): auth + Firestore write for multi-device | 2 h |

**Total estimate:** ~11 h (1–2 Claude sessions)

## Blockers

- Dart/Flutter knowledge required; Trakli codebase may have complex state management
- Claude API key needed; Haiku 5.5 at ~$0.001/transaction is very cheap but still requires a key
- Firebase setup adds 1–2 h if starting from scratch; can skip for local-only MVP
- Trakli backend is a separate repo (`trakli/webservice`) — not needed for local-only build

## References

- GitHub mobile: https://github.com/trakli/mobile
- Trakli org: https://github.com/trakli
- Flutter AI docs: https://docs.flutter.dev/ai/create-with-ai
- Claude API pricing: use `/claude-api` skill for current Haiku 5.5 rates

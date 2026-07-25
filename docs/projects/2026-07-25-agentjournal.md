# AgentJournal

> Flutter logbook with a persistent AI agent that has a "mission" and "soul" — it reads what you record daily and surfaces nudges, patterns, and next steps without you having to ask

**Inspired by:** [matthiasn/lotti](https://github.com/matthiasn/lotti) (GitHub trending July 25 2026, 1.2k★)  
**Date discovered:** 2026-07-25

---

## What gap it fills

Existing AI journal apps let you chat with your notes — but the conversation dies when you close the app. Lotti proves there's a better model: a long-lived agent with a declared *mission* (e.g. "track my focus and energy across tasks") and a *soul* (a persistent persona with memory of past entries). It reads your logbook autonomously, proposes a daily check-in, and builds a model of you over time. The user already has VoxDiary Flutter (a simple voice-to-text diary) and Memex — but neither has an autonomous agentic layer that *proactively* synthesises what it reads. AgentJournal fills that gap: Flutter app + SQLite entries + a background agent that wakes nightly, reads new entries, and generates nudges with `human-in-the-loop` approval before any side-effects.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| App | Flutter (Dart) | Cross-platform (iOS, Android, Linux desktop), matches user's Flutter interest |
| Local DB | Drift (SQLite) | Typed, migration-safe, reactive streams for the UI |
| AI provider | Anthropic SDK (Dart `anthropic_sdk_dart`) | Claude 3.5 Haiku for daily reads; Claude Sonnet for synthesis |
| Local model | Ollama (optional) | Offline mode via HTTP; same interface |
| Voice input | `speech_to_text` Flutter plugin | Capture daily voice memos |
| Encryption | `hive` with AES-256 or Flutter Secure Storage | Journal entries stay private |
| Agent schedule | Dart `WorkManager` plugin | Nightly background agent run on Android/iOS |

## MVP scope (1 Claude session)

A Flutter app that:

1. Lets you create text or voice journal entries stored in local SQLite
2. Has an **Agent card** at the top of the home screen showing the agent's current mission
3. On demand (button) — or on a schedule — the agent reads today's entries and returns a short nudge ("You wrote about fatigue twice today. Block tomorrow morning.")
4. Nudges require tap-to-approve before being saved into a `suggestions` table
5. Settings page: mission text, AI provider (Claude / Ollama endpoint), model choice

Out of scope for MVP: multi-agent, encrypted sync, image/audio transcription.

## Phases

### Phase 1 — Entry capture (1 h)
- Flutter app scaffold: bottom nav (Journal · Agent · Settings)
- Entry list screen: tap `+` to add text or tap mic for voice
- `speech_to_text` plugin records and transcribes inline; editable before save
- Drift schema: `entries(id, body, created_at, tags[])`, `suggestions(id, entry_ids[], body, approved, created_at)`

### Phase 2 — Agent runner (1.5 h)
- `AgentService` class: fetches all entries from the last N days, builds a system prompt embedding the agent's `mission` and `soul` from settings
- Sends to Claude Haiku via `anthropic_sdk_dart`; streams response token-by-token into a `StreamController`
- Parses JSON response: `{nudges: [...], patterns: [...], questions: [...]}`
- Inserts pending `suggestions` rows; notifies UI via Riverpod state

### Phase 3 — Agent card UI (45 min)
- Home screen agent card: mission headline, last-ran timestamp, pending suggestion count
- "Run agent now" button → loading shimmer → shows new suggestions inline
- Each suggestion: approve button (saves to `suggestions`) or dismiss; approved ones appear in a "Today's nudges" list

### Phase 4 — Approval + history (30 min)
- Suggestions history tab: approved vs. dismissed, grouped by date
- Long-press on any entry → "Ask agent about this entry" → one-shot single-entry analysis in a bottom sheet

### Phase 5 — Schedule + settings (45 min)
- Settings: mission textarea, soul textarea, model dropdown (Claude Haiku / Sonnet / Ollama), look-back window (1d / 3d / 7d)
- WorkManager job: nightly 22:00 run, creates a notification badge if new suggestions arrived
- Export: all entries as markdown file via share sheet

## Effort estimate

~4 hours for Phases 1–3 (working MVP) · 1 Claude session  
~5.5 hours complete with history + schedule

## Blockers / risks

- **Anthropic Dart SDK maturity**: `anthropic_sdk_dart` exists but is community-maintained. Mitigation: wrap it in an `AIProvider` interface so you can swap for an HTTP-direct implementation if needed.
- **WorkManager limitations on iOS**: Background fetch on iOS is throttled by the OS. Mitigation: fall back to on-demand "Run now" and show a reminder notification at 22:00 instead of a background task.
- **Context window for long journals**: A month of daily entries can exceed 10k tokens. Mitigation: summarise older entries at Phase 2 (keep last 3 days verbatim, send a rolling summary of prior weeks).
- **Overlap with VoxDiary / Memex**: Differentiator is the *agent-with-mission* model — make the mission/soul UI prominent so it's clear this is a personal AI colleague, not just a chatbot over notes.

# DiaryX — Private Flutter Diary with On-Device Gemma 3n LLM

**Source:** <https://github.com/xalanq/DiaryX>
**Discovered:** 2026-09-28
**Viability:** 4/4

> Most AI-powered diary apps send your entries to a cloud API. DiaryX runs an on-device LLM (Gemma 3n via Google's MediaPipe, or Ollama) to expand voice notes, summarise the week, and track mood — without any network call. The source repo proves the Flutter + MediaPipe integration compiles on Android API 24+ and iOS 12.0+; the build plan starts with Ollama for fast iteration and graduates to MediaPipe in the final phase.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

**Weekend-buildable (1):** Flutter + SQLite + Ollama HTTP API is a well-understood stack. The AI layer in Phase 2 is a single HTTP call to `localhost:11434/api/generate`. A diary entry screen, a week summary, and a mood log are 600–900 lines of Dart spread across two sessions.

**Fills a gap (1):** Bear, Day One, and Obsidian all offer AI features backed by cloud APIs. No widely-used open-source Flutter diary ships an LLM that runs fully on-device. The source repo (118 commits, 7★) is real but young; building from scratch with a cleaner Ollama-first path is the faster route to a working app.

**Novel (1):** On-device LLM for journaling is a concept that floats around in blog posts but has no established OSS implementation with a real daily-use UX. The MediaPipe Gemma 3n integration is genuinely new Flutter territory.

**Daily utility (1):** A diary app is used every day by definition. The AI layer reduces the friction of "I voice-noted 30 seconds about my day; now I have a three-paragraph entry and a mood score" — that loop runs on every recording.

---

## Implementation Plan

### Overview

The app has three tiers:
1. **Storage:** SQLite (Drift ORM) for diary entries, mood scores, and tags.
2. **Input:** Text editor + voice recording (speech-to-text via `speech_to_text` Flutter package).
3. **AI:** Ollama (Phases 1–4) → MediaPipe Gemma 3n (Phase 5) for expand / summarise / mood inference.

The on-device constraint means the AI model runs in a background isolate; the main thread never blocks on inference.

### Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Framework | Flutter 3.32+ (Dart 3.8+) | Cross-platform Android/iOS; upstream uses it |
| Database | SQLite via Drift 2.x | Type-safe ORM; migrations; reactive streams |
| State | Riverpod 2.x | Scales cleanly from single screen to multi-tab |
| Voice input | `speech_to_text` Flutter package | Android + iOS; real-time partial transcription |
| AI (Phase 1–4) | Ollama HTTP API (localhost) | Fast to integrate; model swappable |
| AI model (Phases 1–4) | Gemma 3n (1B-IT via Ollama) | Small enough to run on-device; same model as Phase 5 |
| AI (Phase 5) | MediaPipe Tasks GenAI (Flutter plugin) | Fully on-device; no Ollama process needed |
| UI | Material 3 + custom theming | Consistent with upstream; accessible |

### MVP Scope

**In:**

1. Home screen: reverse-chronological list of entries with mood emoji, date, and first two lines.
2. Entry screen: rich text editor (title + body), voice recording button (auto-appended to body on stop), mood selector (1–5).
3. AI expand: button that sends the current entry text to Ollama and replaces it with a 3-paragraph expansion; original text preserved in a collapsible "raw" section.
4. AI summarise: weekly summary screen that batches the last 7 entries and returns a bullet-point summary.
5. SQLite storage with search.

**Out of v1:** photo/video capture, MediaPipe on-device inference, analytics dashboard, cloud sync, tags/categories.

### Phases

**Phase 1 — Schema + entry CRUD (2 h).** Set up the Flutter project (Riverpod + Drift). Define the `Entry` table (id, title, body, raw_body, mood, created_at, tags). Build the home screen (list) and entry screen (create/edit). Local SQLite persistence. Test: create three entries, edit one, delete one; all survive app restart.

**Phase 2 — Ollama AI expand + summarise (1.5 h).** Add `OllamaClient` (plain `http` package, `POST /api/generate`, streaming responses). Wire "Expand with AI" button: POST current body, stream the result into the entry. Wire "Week in Review" screen: batch the last 7 entries into a single prompt, show the returned summary. Test: expand a 3-sentence voice note into a paragraph; confirm no network call leaves localhost.

**Phase 3 — Voice recording + speech-to-text (1.5 h).** Add `speech_to_text` Flutter plugin. Record button on entry screen: starts recording, shows live partial transcription in the body field, appends finalized text on stop. Add microphone permission in AndroidManifest and Info.plist. Test: record a 10-second note; text appears in entry without copy-paste.

**Phase 4 — Mood inference + analytics (1.5 h).** After each AI expand, fire a second Ollama call: `"Rate the mood of this entry 1–5 and return JSON: {mood: N}"`. Parse and store alongside the entry. Add a mood-trend chart (fl_chart, line chart, 30 days). Test: 5 entries with varying emotional tones → mood scores differ predictably.

**Phase 5 — Swap Ollama for MediaPipe Gemma 3n (2 h).** Add `google_generative_ai_edge` Flutter plugin (MediaPipe Tasks GenAI). Download `gemma-3n-it-int4.task` on first launch (guided setup screen with progress bar). Wrap behind a `LocalInferenceProvider` interface; keep `OllamaProvider` as the fallback. Test: disable network → expand and summarise still work.

**Total effort:** 8.5 hours across two sessions. Phase 1–3 alone gives a production-quality offline diary with AI text expansion; Phases 4–5 add the differentiated analytics and true on-device inference.

### Blockers and Known Ceilings

- **Model download size.** `gemma-3n-it-int4.task` is approximately 2 GB. The setup screen must show download progress and handle interrupted downloads gracefully (resume on restart). Do not bundle the model in the APK/IPA.
- **MediaPipe Flutter plugin stability.** The `google_generative_ai_edge` Flutter plugin is the upstream project's choice; it was experimental in early 2026. Pin to the version the upstream DiaryX uses and check the MediaPipe Flutter GitHub issues for known crash reports before Phase 5.
- **iOS background audio.** Voice recording in the background requires `UIBackgroundModes: audio` in `Info.plist`. Without it, the microphone silences when the user switches apps mid-dictation. Add the entitlement in Phase 3.
- **Concurrent AI calls.** If the user taps "Expand" twice before the first call returns, the second call will overwrite the first's result. Disable the button while a call is in-flight; show a loading indicator.
- **Ollama process management.** On mobile, Ollama is not a local process — the user runs it on their desktop and the phone connects over LAN. Document this clearly in the onboarding screen. The Phase 5 MediaPipe path removes the dependency.

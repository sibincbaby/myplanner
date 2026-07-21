# VoxDiary Flutter

> Cross-platform voice diary with LLM transcription and daily insights — iOS + Android + macOS

**Inspired by:** [DailyVox](https://github.com/intrepidkarthi/dailyvox) (Swift/iOS only, 11 ⭐)  
**Date discovered:** 2026-07-21

---

## What gap it fills

DailyVox is Swift-only and iOS-only. Memex (July 16 plan) focused on timeline cards and photo capture. VoxDiary Flutter is different in two ways: (1) truly cross-platform via Flutter, (2) AI analysis happens via the Claude API rather than on-device CoreML — making it accessible without an Apple Neural Engine and immediately more capable for insight generation.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Flutter 3.x | One codebase for iOS, Android, macOS |
| Voice recording | `flutter_sound` | Cross-platform audio record/playback |
| Transcription | OpenAI Whisper API | Best accuracy; free tier covers personal use |
| AI insights | Claude API (Haiku) | Cheap per-call, fast, excellent at structured analysis |
| Storage | Hive (local NoSQL) + `path_provider` | No backend, fully local, fast reads |
| State | Riverpod | Async-safe, testable |
| Backup | Optional iCloud / Google Drive sync |  |

## MVP scope (2 Claude sessions)

- Record a voice note (max 5 min)
- Transcribe via Whisper
- Claude Haiku analyses: mood (1–10), top 3 themes, 1 action item
- Save entry with transcript + analysis as a Hive object
- Timeline list: date, mood badge, first sentence of transcript
- Tap entry → full transcript + Claude analysis card

No search, no semantic memory, no digital twin for MVP.

## Phases

### Phase 1 — Recording + playback UI (2 h)
- Record button with waveform animation (`audio_waveforms` package)
- Playback with scrub bar
- Duration limit (5 min) with countdown
- Save raw audio to app documents directory

### Phase 2 — Whisper transcription (1.5 h)
- Upload audio file to OpenAI Whisper endpoint
- Show transcription in editable `TextField` (user can correct mistakes)
- Handle errors: no network, file too large, Whisper timeout

### Phase 3 — Claude analysis (1.5 h)
- Prompt: given transcript, return JSON `{mood_score, themes[], action_item, summary_sentence}`
- Display as a card below the transcript: mood chip, theme tags, action item
- Cache analysis in Hive so it doesn't re-call on reopen

### Phase 4 — Timeline + local storage (2 h)
- Hive box: `DiaryEntry(id, created_at, audio_path, transcript, analysis, mood_score)`
- Timeline list view: date header + entry cards sorted newest-first
- Swipe-to-delete with confirmation

### Phase 5 — Insights summary (2 h)
- Monthly summary: Claude call with all transcripts of the month → themes trend, mood arc, highlights
- Simple bar chart of mood score over time (`fl_chart`)
- Share as PDF (optional, using `printing` package)

## Effort estimate

~9 hours total · 2–3 Claude sessions

## Blockers / risks

- **Whisper API cost**: at $0.006/min, a 5-min note costs $0.03. Negligible for personal use. Mitigation: add a "transcribe on WiFi only" toggle.
- **flutter_sound on macOS**: macOS microphone permissions require `NSMicrophoneUsageDescription` in Info.plist; easy to overlook.
- **Large audio files on Android**: Android 10+ scoped storage may require `MANAGE_EXTERNAL_STORAGE`. Mitigation: store in app-private directory (`getApplicationDocumentsDirectory`).
- **Claude API key management**: store in Flutter Secure Storage, never in shared preferences.

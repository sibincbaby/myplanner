# my-diary — Voice AI Diary with Expo Mobile + FastAPI

**Source:** GitHub (PR #1 merged Oct 10, 2026)  
**Repo:** https://github.com/blockchaindexico-cmyk/my-diary  
**Discovered:** 2026-10-29  
**Viability:** 4/4 (WB ✅ · FG ✅ · N ✅ · DU ✅)

## What it is

A mobile-first AI-powered diary app built with Expo (React Native) and a FastAPI backend. You record a journal entry by voice or type it; the app transcribes, saves, and runs AI analysis on each entry — including emotion scoring, mood trend tracking, and weekly insights. Entries are stored locally with optional cloud sync. Built with AI-assisted development (Claude Code noted in the repo).

Key details:
- Expo (React Native) mobile client — iOS and Android
- FastAPI backend for AI analysis (emotion scoring, insights, mood tracking)
- Voice input via Expo's `expo-av` / speech API
- AI analysis: emotion detection, sentiment, weekly summary
- Local-first storage with optional sync
- MIT license

## Why it scores

- **Weekend-buildable:** An Expo + FastAPI AI diary is a well-scoped project. The mobile client handles voice recording and display; the backend runs a simple Claude API call for analysis. MVP is achievable in 1-2 Claude sessions.
- **Fills gap:** The user's interest in diary/logging tools and voice-first apps is explicitly noted in their profile. No existing tool in the seen list covers AI-analyzed voice journaling with a mobile app.
- **Novel:** Voice-first journaling with AI emotion scoring and mood trend tracking is a distinct combination — not just another markdown note app. The weekly AI insight summary is a differentiating feature.
- **Daily utility:** A daily diary habit with AI reflection (emotion trends, weekly summary) is a genuine high-retention daily-use case.

## Build angle

Build the full my-diary stack from scratch (or fork/extend the repo):

1. Expo app: voice recording screen, transcript display, entry history list.
2. FastAPI backend: `/analyze` endpoint that takes entry text and calls Claude to return `{emotions, sentiment, key_themes, reflection_prompt}`.
3. Local SQLite storage via `expo-sqlite` for offline-first operation.
4. Weekly summary endpoint: aggregate the week's entries and generate an AI reflection.

## MVP Scope (weekend build)

- [ ] Expo app: record voice → transcribe → text editor → save entry
- [ ] Entry history screen: list of past entries with date, mood icon, first line
- [ ] FastAPI `/analyze` endpoint: Claude API call → structured response (emotions, sentiment, themes)
- [ ] SQLite local storage for entries + analysis results
- [ ] Mood trend chart: simple line chart of emotion scores over time (using `victory-native`)
- [ ] Weekly summary: send last 7 entries to Claude, return 3-sentence reflection

## Phases

### Phase 1 — Expo app skeleton + voice input (Day 1, ~3h)
- Expo Router setup with three screens: Record, History, Summary
- `expo-av` for voice recording; `expo-speech` or `@react-native-voice/voice` for transcription
- Basic entry save/load with `expo-sqlite`

### Phase 2 — FastAPI backend + Claude analysis (Day 1, ~2h)
- FastAPI app with `/analyze` endpoint
- Claude API call with structured output prompt: return JSON `{emotions: [{name, score}], sentiment: -1..1, themes: [], reflection_prompt: ""}`
- Store analysis result alongside entry in SQLite

### Phase 3 — History + mood chart (Day 2, ~2h)
- History screen: list entries with date, dominant emotion badge, first line preview
- Mood trend chart: `victory-native` line chart of sentiment score over last 30 days
- Entry detail screen: full transcript + emotion breakdown + themes

### Phase 4 — Weekly AI summary (Day 2, ~1h)
- Summary screen: button to generate weekly reflection
- `/weekly-summary` endpoint: send week's entries to Claude, return 3-sentence insight
- Cache summary result so it doesn't re-generate on every open

## Effort estimate

| Phase | Hours |
|-------|-------|
| Expo skeleton + voice input | 3 |
| FastAPI + Claude analysis | 2 |
| History + mood chart | 2 |
| Weekly summary | 1 |
| **Total** | **~8h** |

## Blockers / risks

- `@react-native-voice/voice` requires native build (`expo prebuild`) — development build or EAS Build needed, not Expo Go. Plan for this in setup.
- Claude API latency for analysis (~1-3s per entry) is acceptable but should be shown as a loading state to avoid perceived freezes.
- Voice transcription quality varies by device and background noise — add a manual text edit field as a fallback.
- `expo-sqlite` is local-only; if the user wants cross-device sync, Supabase or similar would need to be added in a later phase.

## Reference

- my-diary repo: https://github.com/blockchaindexico-cmyk/my-diary
- Expo Router docs: https://expo.github.io/router/docs/
- expo-av (recording): https://docs.expo.dev/versions/latest/sdk/av/
- FastAPI quickstart: https://fastapi.tiangolo.com/
- Claude structured output: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
- victory-native charts: https://formidable.com/open-source/victory/docs/native/

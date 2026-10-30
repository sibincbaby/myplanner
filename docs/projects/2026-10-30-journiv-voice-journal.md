# Journiv — AI Voice Journal for Flutter (iOS/Android)

**Source:** GitHub journaling topics (last updated Sept–Oct 2026)  
**Repo:** https://github.com/journiv-app/journiv  
**Discovered:** 2026-10-30  
**Viability:** 4/4 (WB ✅ · FG ✅ · N ✅ · DU ✅)

## What it is

Journiv is described as an open-source, local-first AI journal app for iOS and Android. Its AI agents organize voice, text, and photo entries into timeline cards and surfaced insights. Unlike a plain voice memo app or a text diary, it uses an LLM to structure unstructured input — a voice note recorded on the go becomes a tagged, searchable timeline card with auto-generated links to related past entries. The app targets capture-first, organize-later workflows.

Key details:
- Flutter-based mobile app (iOS + Android, single codebase)
- Voice input via on-device STT (or AssemblyAI for quality); photos via camera/gallery
- LLM (local or API) organizes entries into timeline cards with tags, themes, and cross-links
- Local-first storage (SQLite/Isar), optional cloud sync
- Last updated Sept 2026 on GitHub topics index

## Why it scores

- **Weekend-buildable:** A Flutter app with voice recording, Whisper transcription, and an LLM tagging step is achievable in 1-2 Claude sessions. The core loop (record → transcribe → tag → store) is well-defined and the Flutter ecosystem has mature audio and LLM packages.
- **Fills gap:** There is no good AI-powered, privacy-respecting voice journal on iOS/Android that is also open-source. Apps like Day One are subscription-based and not AI-native; existing voice memo apps are search-only.
- **Novel:** The "AI agents that organize entries into cross-linked timeline cards" workflow is genuinely different from tagging-by-hand tools or plain Whisper transcribers. The cross-entry linking step is the novel angle.
- **Daily utility:** A morning voice journal recorded in 2 minutes, organized into searchable cards automatically, is a compelling daily habit tool.

## Build angle

Build a Flutter voice journal with Claude-powered organization:

1. Flutter app with a large mic button for voice recording; camera capture for photos.
2. Audio → text via `whisper_flutter` (on-device) or `speech_to_text` package.
3. Each transcription is sent to Claude with a system prompt that extracts: title, tags, mood, key people, referenced projects, and related past entries (via a RAG lookup).
4. Isar (embedded NoSQL) stores entries locally; each entry has a vector embedding for semantic search.
5. Timeline view: `SliverList` of cards grouped by day; tap a card to see full text, tags, and related entries.

## MVP Scope (weekend build)

- [ ] Voice recording screen with waveform visualization (`flutter_sound` or `record` package)
- [ ] Whisper transcription (on-device via `whisper_flutter` or API call)
- [ ] Claude API call to extract title, tags, mood, key references from transcription text
- [ ] Isar database: `Entry {id, ts, raw_text, title, tags, mood, audio_path, photo_paths}`
- [ ] Timeline view: cards grouped by date, filterable by tag
- [ ] Simple semantic search: cosine similarity on Claude `text-embedding-3-small` embeddings stored in Isar

## Phases

### Phase 1 — Record & transcribe (Day 1, ~2h)
- `record` package for cross-platform audio capture
- Whisper API transcription call (or `speech_to_text` fallback)
- Display transcript in a review screen before saving

### Phase 2 — AI organization (Day 1, ~2h)
- Claude API call with a structured extraction prompt
- Parse JSON response: `{title, tags: [], mood, references: [], summary}`
- Store structured entry in Isar

### Phase 3 — Timeline view (Day 2, ~2h)
- `SliverList` timeline with date headers and entry cards
- Card shows title, mood emoji, tags, audio duration
- Tap to expand: full transcript + related entries (via tag overlap)

### Phase 4 — Semantic search (Day 2, ~1.5h)
- Generate embeddings for each entry on save (Claude embeddings API)
- Store as `Float32List` in Isar
- Search screen: query → embedding → cosine sort → show top-5 cards

## Effort estimate

| Phase | Hours |
|-------|-------|
| Record & transcribe | 2 |
| AI organization | 2 |
| Timeline view | 2 |
| Semantic search | 1.5 |
| **Total** | **~7.5h** |

## Blockers / risks

- On-device Whisper (`whisper_flutter`) quality varies by device; have an API fallback for low-end devices.
- Claude API calls add 1-3s latency after each recording — show a loading state and let the user keep recording while it processes.
- Background audio recording on iOS requires `UIBackgroundModes` entitlement; test early to avoid App Store review issues.
- Embeddings storage in Isar using `Float32List` needs careful indexing for fast cosine search at scale (>1000 entries).

## Reference

- Journiv repo: https://github.com/journiv-app/journiv
- `record` Flutter package: https://pub.dev/packages/record
- `whisper_flutter`: https://pub.dev/packages/whisper_flutter_new
- Isar database: https://isar.dev/
- Claude Messages API: https://docs.anthropic.com/en/api/messages

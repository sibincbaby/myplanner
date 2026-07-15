# Memex — local-first AI journal app with BYO LLM

**Source:** <https://github.com/memex-lab/memex>
**Discovered:** 2026-07-16
**Viability:** 3/4

> Lands in two of the user's interest areas at once — diary/logging **and** Flutter/mobile AI. The build target is not a Memex clone but a minimal, personal, bring-your-own-Claude journal: capture a note, let the LLM tag and summarize it, browse a searchable timeline. Local-first, no accounts, no server.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

The full Memex (voice + photos + multi-agent organization + 12 LLM providers) is a large app, but a scoped MVP — text/voice capture → on-demand LLM enrichment → timeline + search, all in local SQLite + Markdown — fits 1–2 Flutter sessions, so weekend_buildable=1. It fills a real gap in the user's toolkit: the profile explicitly lists diary/logging and Flutter mobile AI, and there is no personal journal in the current kit. daily_utility=1 because journaling is a per-day act and the app is opened to log, not occasionally. novel=0 is the honest deduction: Memex is an already-polished GPL-3.0 OSS app and Moodiary sits in the seen list, so this is a personal, stripped-down build rather than a new idea. Total 3, viable.

---

## Implementation Plan

## Overview

A single-user, offline-first journaling app for Android (the user's Flutter stack) where every entry is a Markdown-backed note in a local SQLite store. The differentiator over generic note apps is a **thin LLM enrichment layer**: after an entry is saved, the app can (on tap or on a debounce) send it to the user's own Claude API key to produce a one-line summary, 2–5 tags, and a mood/topic label, which power a browsable timeline and fast search. Voice capture is on-device speech-to-text feeding the same text pipeline.

The MVP is the closed loop: **capture (text/voice) → local store → enrich with Claude → timeline + search**. Everything stays on device; the only network call is the user's own LLM endpoint. No accounts, no backend, no sync in MVP.

This deliberately is **not** a Memex re-implementation — it drops photos, multi-agent orchestration, and multi-provider abstraction in favor of one provider (Claude, with a pluggable base URL) and a workflow tuned to the user.

## Stack Recommendation

- **App: Flutter (Android-first).** Matches the user's mobile-first AI stack; one codebase, fast iteration. Riverpod for state.
- **Storage: `sqflite` + on-disk Markdown.** Entries live as rows in SQLite for query/search and are mirrored to `.md` files in app documents dir so the corpus is portable and greppable (the "local-first, own your data" property). FTS5 virtual table for full-text search.
- **LLM: direct Anthropic Messages API via `http`/`dio`,** key stored in `flutter_secure_storage`. Expose a configurable base URL so the same client can point at Ollama/OpenAI-compatible endpoints later without a provider-abstraction framework. Use a small, cheap model (Haiku) for enrichment to keep per-entry cost/latency low.
- **Voice: `speech_to_text` plugin** (on-device recognizer) for dictation into the entry field — no separate STT service in MVP.
- **No server, no auth, no cloud.** Single-user local app; the API key is the only secret.

## MVP Scope

In:
- New entry screen: multiline text + a mic button that dictates into the field.
- Save → write SQLite row + mirror Markdown file.
- Enrichment: call Claude to get `{summary, tags[], mood}`; store alongside the entry; show a subtle "enriching…" then the result. Manual re-run button.
- Timeline: reverse-chronological cards (date, summary, tags, mood chip); tap for full entry.
- Search: FTS over entry text + tags; filter by tag.
- Settings: API key, base URL, model, and an "auto-enrich on save" toggle.

Out (later): photos/attachments, background/scheduled agent passes over old entries, insights/analytics dashboards, iOS build, encryption-at-rest, cross-device sync, multi-provider UI.

## Implementation Phases

### Phase 1: Capture + local store
**Goal:** Type an entry, save it, and see it persist across app restarts as both a SQLite row and a Markdown file.
**Files to create/modify:**
- `app/` — scaffold via `flutter create` (or the `vgv-ai-flutter-plugin:create-project` flutter_app template).
- `app/pubspec.yaml` — `sqflite`, `path_provider`, `flutter_riverpod`, `intl`.
- `app/lib/models/entry.dart` — `Entry { id, createdAt, body, summary?, tags[], mood? }` + JSON/row mapping.
- `app/lib/data/entry_db.dart` — SQLite open/migrate, `insert`, `update`, `listRecent`, plus FTS5 table + triggers.
- `app/lib/data/markdown_mirror.dart` — write/update `YYYY/MM/DD-<id>.md` with front-matter (created, tags, mood) + body.
- `app/lib/providers/entries_provider.dart` — Riverpod notifier over the DB.
- `app/lib/screens/entry_edit_screen.dart` — text field + Save.
- `app/lib/main.dart` — app shell, nav (Timeline / New / Settings).
**Key steps:**
1. Define the schema (entries table + `entries_fts` FTS5 mirror kept in sync by triggers).
2. On save: insert row, then write the Markdown mirror; keep the file path on the row.
3. Load recent entries into the timeline provider on startup.
**Verify:** Create three entries, force-quit and relaunch; confirm all three load, and that the corresponding `.md` files exist in the app documents dir with correct front-matter.

### Phase 2: Claude enrichment
**Goal:** After saving an entry, Claude returns a summary, tags, and mood, which persist and display.
**Files to create/modify:**
- `app/pubspec.yaml` — add `dio` (or `http`), `flutter_secure_storage`.
- `app/lib/services/llm_client.dart` — Anthropic Messages call; input entry body, output strict JSON `{summary, tags, mood}` (use a system prompt + `response` parsing with a tolerant fallback).
- `app/lib/services/enrichment.dart` — orchestrates: build prompt, call client, validate JSON, update row + Markdown front-matter.
- `app/lib/data/entry_db.dart` — `updateEnrichment(id, summary, tags, mood)`.
- `app/lib/screens/entry_edit_screen.dart` — "Enrich" button + inline status; auto-trigger if the setting is on.
**Key steps:**
1. Prompt Claude for a compact JSON object (summary ≤ 140 chars, 2–5 lowercase tags, one mood word); request Haiku for cost/latency.
2. Parse defensively: strip code fences, `jsonDecode`, on failure keep the entry unenriched and surface a retry — never block saving on the LLM.
3. Persist enrichment to both SQLite and the Markdown front-matter.
**Verify:** Save an entry with a real key set; confirm a summary/tags/mood appear within a few seconds and survive restart; with the key blank or network off, confirm the entry still saves and shows a retry affordance (no crash, no data loss).

### Phase 3: Timeline + search
**Goal:** Browse entries as a reverse-chronological timeline and find any entry by text or tag.
**Files to create/modify:**
- `app/lib/screens/timeline_screen.dart` — grouped-by-day list of cards (summary or body preview, tag chips, mood).
- `app/lib/widgets/entry_card.dart` — the card; tap → detail/edit.
- `app/lib/screens/search_screen.dart` — search bar over FTS + tag-filter chips.
- `app/lib/data/entry_db.dart` — `search(query)` via FTS5, `entriesByTag(tag)`.
**Key steps:**
1. Timeline: query recent, group by calendar day (`intl`), render newest first; pull-to-refresh.
2. Search: debounce input, run FTS `MATCH`, highlight; tapping a tag chip filters the timeline.
3. Detail view reuses the edit screen; edits re-mirror Markdown and can re-enrich.
**Verify:** With ~15 varied entries, confirm the timeline groups correctly by day, a keyword search returns the expected entries ranked, and tapping a tag narrows the list.

### Phase 4: Settings + voice + hardening
**Goal:** Configure the LLM, dictate entries by voice, and make the loop robust.
**Files to create/modify:**
- `app/lib/screens/settings_screen.dart` — API key (secure storage), base URL, model, auto-enrich toggle.
- `app/lib/services/llm_client.dart` — read config from settings; honor base URL override.
- `app/pubspec.yaml` — add `speech_to_text`, `permission_handler`.
- `app/lib/screens/entry_edit_screen.dart` — mic button: request permission, stream partial transcript into the field.
- `app/lib/services/enrichment.dart` — simple retry/backoff; guard against oversized entries (truncate before send).
**Key steps:**
1. Settings persist to secure storage; client reads on each call so changes take effect immediately.
2. Voice: request mic permission, use on-device recognition, append/insert the transcript into the text field (user still reviews before save).
3. Hardening: truncate very long bodies for the LLM call, cap tag count, and handle 401/429 with a clear message.
**Verify:** Change the model in settings and confirm the next enrichment uses it; dictate an entry end-to-end and save it; set a bad key and confirm a clear 401 message rather than a silent failure.

## Estimated Effort

**2–3 Claude Code sessions.**
- **Session 1:** Phases 1–2 — scaffold, SQLite + Markdown store, capture/save, and the Claude enrichment call verified end-to-end (this is the core correctness work: strict JSON parsing and never blocking a save on the LLM).
- **Session 2:** Phase 3 — timeline, FTS search, tag filtering, detail/edit.
- **Session 3 (partial):** Phase 4 — settings, voice dictation, error hardening.

## Potential Blockers

- **LLM JSON reliability:** free-form entries can make the model return prose or malformed JSON. The enrichment path must parse defensively and degrade to "unenriched + retry" rather than corrupt or drop the entry. This is the single highest-risk detail.
- **Enrichment cost/latency on every save:** auto-enriching each entry hits the API constantly. Default to Haiku, make auto-enrich a toggle, and consider batching/debouncing; otherwise a chatty journaling session runs up cost and lag.
- **On-device STT quality/permissions:** `speech_to_text` accuracy and language support vary by device, and mic permission flows differ across Android versions. Keep voice as an assist into an editable field, never the sole capture path.
- **SQLite ↔ Markdown drift:** mirroring to files doubles the write surface; an interrupted save can desync the row and the `.md`. Make SQLite the source of truth and treat Markdown as a regenerable export to avoid reconciliation headaches.
- **Not-novel risk:** Memex already does all this and more, polished, under GPL-3.0. If the personal-fit differentiation is dropped, this becomes an inferior clone — keep the scope minimal and tuned to the user's own workflow, or just adopt Memex instead.
- **Secret handling:** the Anthropic key sits in `flutter_secure_storage`; make sure it is never written into the Markdown front-matter, logs, or exported files.

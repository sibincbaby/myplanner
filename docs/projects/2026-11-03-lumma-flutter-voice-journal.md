# Lumma — AI-Native Flutter Voice Journal (Voice → Markdown for Obsidian)

**Source:** [geosmart/lumma](https://github.com/geosmart/lumma) (GitHub ai-note-taking-app topic, active 2026; MIT, mobile-first Flutter)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** build-first. Lumma is a reference architecture and inspiration source — build your own version tailored to your Obsidian vault layout and review preferences rather than adopting the existing app as-is.

## Why this one

The journaling loop for a developer with AI tools should be: speak a thought → AI transcribes and structures it → it lands in your knowledge base, linked and dated, ready to search. The current reality is: voice memo gets recorded, sits in the audio library, is never reviewed, adds no value.

Lumma closes this loop: record voice on mobile → AI transcription → structured Markdown → writes directly to Obsidian vault (via iCloud or git sync). The vault integration is the key feature that makes captured thoughts useful, not just logged.

**Why FG=1:** No existing tool in the toolkit does voice-to-Obsidian natively. The closest is manual: record in voice memo, transcribe in Whisper, paste into Obsidian. Lumma (or an inspired build) automates all three steps.

**Why N=1:** AI-native from the start, not a voice recording app with AI bolted on. The Markdown output is structured (title, date, tags, body) rather than a raw transcript. The Obsidian integration angle is specific and gap-filling.

**Why WB=1:** Flutter + OpenAI Whisper API (or local Whisper) + file write to an Obsidian vault path is a well-defined, achievable build in 1–2 Claude sessions. The core is straightforward: record audio → send to Whisper → write structured Markdown to a file path.

**Why DU=1:** Daily journaling is the target. Once the workflow is set up, the friction of journaling drops to "tap record, speak for 2 minutes, stop."

## Stack recommendation

- **Flutter 3.x**: cross-platform (iOS + Android), single codebase
- **flutter_sound or record package**: audio recording
- **Whisper API (openai) or whisper.cpp (local)**: transcription
  - API: $0.006/minute, easiest to start
  - Local via whisper.cpp: zero cost, requires server/Mac with Metal
- **Claude API (Anthropic)**: structure the transcript into titled, tagged Markdown (title extraction, summary, #tags from content)
- **Obsidian vault sync**: write files to an iCloud Drive path (iOS) or a git-synced folder (Android via Termux or Working Copy)
- **SQLite (drift)**: local store of captured entries for offline access and search

## MVP scope

Build a minimal Flutter app that:
1. Records voice input (up to 5 minutes)
2. Sends audio to Whisper for transcription
3. Sends transcript to Claude for structuring (title, tags, formatted body)
4. Writes the result as a `.md` file to the Obsidian vault path
5. Shows a confirmation screen with the generated file content

Out of scope (MVP): search, categories, export to other formats, sync to non-Obsidian destinations.

## Phases

1. **Voice record + Whisper (1 session).** Scaffold Flutter app, add audio recording, call Whisper API on stop, display raw transcript. Get this working end-to-end with a real recording.
2. **Claude structuring (1 session).** Add a Claude API call that takes the raw transcript and returns structured Markdown: `## title`, `date:`, `tags:`, `\n---\n`, body. Test with 5 real voice recordings to tune the prompt.
3. **Obsidian write (1 session).** Identify the vault path (iCloud Drive on iOS, git-synced folder path on Android). Write the structured Markdown file. Verify it appears in Obsidian with correct formatting and metadata.
4. **Daily log mode (1 session, optional).** Add a "daily log" mode: instead of creating a new file per recording, append timestamped entries to `Journal/YYYY-MM-DD.md`. This matches the common Obsidian daily notes workflow.
5. **Local Whisper option (1 session, optional).** Replace the OpenAI Whisper API call with a local whisper.cpp endpoint (running on Mac via API bridge). Eliminates transcription cost for long-term use.

## Effort

Core app (record → transcribe → structure → write): 2–3 sessions. Daily log mode: 1 session. Local Whisper: 1 session.

## Blockers / risks

- **iOS microphone + file permissions:** requires runtime permission prompts. The vault write path (iCloud Drive) needs `Documents/` permission, which is handled differently in Flutter vs. native. Budget 30 minutes for permission plumbing.
- **Whisper accuracy on voice recordings:** background noise, fast speech, or heavy accent reduce accuracy. For personal use, Whisper is typically 90%+. The Claude structuring step handles minor transcription errors gracefully because it focuses on meaning, not exact words.
- **Obsidian path portability:** the vault path is machine-specific. If you journal from two phones or have the vault in different locations on iOS vs. Android, the path needs to be configurable. Add a setup screen that lets you enter the path.
- **API costs for heavy use:** 10 minutes/day of voice journaling at $0.006/minute = ~$1.80/month for transcription. Claude structuring adds ~$0.01 per entry. Total: under $3/month for daily use. Consider local Whisper for cost elimination if usage is higher.

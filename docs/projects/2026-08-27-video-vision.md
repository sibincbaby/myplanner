# Video Vision — Claude Code Plugin for Multimodal Video Analysis

**Source:** [Jordanrendric/claude-video-vision](https://github.com/Jordanrendric/claude-video-vision) · TypeScript · 1.3k★ · GitHub (Aug 2026)
**Date discovered:** 2026-08-27

## What it is

claude-video-vision is a Claude Code plugin that lets Claude analyse video files and YouTube URLs. It extracts frames at a configurable rate, optionally transcribes audio via Whisper or Gemini, and delivers both to Claude as multimodal input — making video content as queryable as a text document.

Key capabilities:
- **`/watch-video path/to/video.mp4`** — asks a question about the video; Claude decides how many frames to extract and at what rate based on the query
- **YouTube support** — pass a URL; `yt-dlp` downloads and caches locally
- **Adaptive frame rate** — Claude reasons about the content and adjusts extraction (action-dense → more frames; talking head → fewer)
- **Audio transcription backends** — Gemini API (no local install), OpenAI Whisper API, or local Whisper model
- **Timestamped transcripts** — audio is transcribed with timestamps so Claude can correlate what is said with what is seen

## Why it fits

- Core interest: **Claude/LLM tooling** — Claude Code plugin; zero extra API surface; installs with one command
- Core interest: **Dev productivity** — analyse tutorial videos, code walkthroughs, and recorded demos without manual note-taking
- `novel = 1`: no Claude Code video analysis plugin existed before; the adaptive frame-rate approach (Claude chooses) is novel
- `daily_utility = 0`: video analysis is episodic, not daily — but high-value when it is needed

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | `npx claude plugin install claude-video-vision` + ffmpeg; working in under 1h |
| fills_gap | 1 | No way to ask Claude about a video file exists in the current toolkit |
| novel | 1 | Adaptive frame-rate extraction driven by Claude's own reasoning is new |
| daily_utility | 0 | Episodic use; high-value for specific workflows but not every session |
| **Total** | **3/4** | **VIABLE** |

**Install first, extend second.** The existing plugin covers the core use case. The plan below focuses on (1) getting the plugin running with local Whisper (no cloud API dependency) and (2) adding a batch-analyse workflow for processing long tutorial playlists into searchable Markdown summaries.

## Stack Recommendation

```
Base plugin:    claude-video-vision v1.0.0 (install via Claude Code plugin manager)
Audio backend:  faster-whisper local model (tiny.en or base.en) — no Gemini API key needed
Frame tool:     ffmpeg (system install: brew install ffmpeg / apt install ffmpeg)
YouTube:        yt-dlp (pip install yt-dlp)
Batch layer:    Python script wrapping /watch-video for playlists → Markdown summaries
Storage:        wiki/ folder from llm-wiki plan — video summaries ingested as knowledge
```

## MVP Scope (1 Claude session)

Install the plugin and verify it works end-to-end with a local video and a YouTube URL, then wire up local Whisper as the transcription backend (no API key required):

1. Install: `claude plugin install claude-video-vision`
2. Configure: `claude /setup-video-vision` → choose local Whisper backend
3. Test local file: `/watch-video ~/Downloads/demo.mp4 What are the main steps shown in this demo?`
4. Test YouTube: `/watch-video https://youtube.com/watch?v=<id> Summarise the key concepts`
5. Verify timestamps: ask `At what time does X appear?` → confirm Claude references the correct frame

## Phases

### Phase 1: Install + Local Whisper Backend (1h)
- Install ffmpeg and yt-dlp via system package manager
- Install plugin: `claude plugin install claude-video-vision`
- Run `/setup-video-vision` and select local Whisper backend; choose `faster-whisper` with `base.en` model
- Test with a 10-min coding tutorial video: ask 3 questions at different levels of detail
- Verify: frame extraction visible in Claude Code output; transcription timestamps match video content

### Phase 2: Batch Playlist Analyser (1.5h)
- Write `video-batch.py`: given a list of YouTube URLs or local paths, calls `/watch-video` for each with a standard analysis prompt
- Standard prompt: "Summarise this video in 5 bullets. List tools, commands, and code snippets shown. Note the timestamp of each key step."
- Output: one Markdown file per video in `wiki/video-summaries/`
- Run automatically for a playlist of 10 tutorial videos → 10 searchable summaries
- Verify: `wiki ask "How do I configure MCP servers?"` → surfaces the correct video summary with timestamp

### Phase 3: Diff-Based Re-Analysis (1h)
- For YouTube videos that update (e.g. a tool's official tutorial), track the video ID and last-analysed timestamp in a SQLite table
- Weekly cron: check if the video duration has changed (via yt-dlp metadata) → if so, re-extract and re-summarise
- Mark updated summaries with a `[UPDATED: date]` header so the wiki diff shows what changed
- Verify: simulate an update by re-analysing with a different question; confirm the wiki file updates

### Phase 4: Screen Recording Analyser (1h)
- Add a `video-record.sh` helper: capture a 5-minute screen recording (ffmpeg -f avfoundation or x11grab)
- After recording: automatically call `/watch-video recording.mp4 What did I do in this session?`
- Output: a session log entry in `wiki/session-logs/YYYY-MM-DD-HHmm.md`
- Use case: capture a debugging session, let Claude describe what happened, add to the wiki
- Verify: record a 2-minute debugging session → Claude produces a legible narrative with timestamps

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Install + Local Whisper Backend | 1h |
| Batch Playlist Analyser | 1.5h |
| Diff-Based Re-Analysis | 1h |
| Screen Recording Analyser | 1h |
| **Total** | **4.5h (one day)** |

## Blockers / Risks

- **ffmpeg not in PATH inside Claude Code sandbox.** If Claude Code runs in a sandboxed environment, `ffmpeg` must be available on the system PATH before the plugin is installed. Verify with `/bash which ffmpeg` inside Claude Code before configuring the plugin.
- **YouTube rate limiting.** yt-dlp may hit rate limits when processing large playlists in rapid succession. Add a 5-second sleep between downloads in `video-batch.py` and use yt-dlp's `--sleep-interval 3` flag.
- **Local Whisper memory.** The `base.en` Whisper model uses ~500MB RAM. On a machine with <8GB RAM available for Claude Code, switch to `tiny.en` (~150MB). For long videos (>60min) on memory-constrained machines, split audio into 10-minute chunks before transcription.
- **Frame count and token cost.** A 60-minute video at 1 frame/minute = 60 images sent to Claude. At ~1k tokens per image, this is 60k tokens per analysis. Use Claude's adaptive frame rate feature (ask Claude to choose) and cap with `--max-frames 30` for long videos.
- **Screen recording privacy.** The Phase 4 screen recording captures everything on screen. Add a `.videoignore` file (list of window names to black out via ffmpeg overlay) before enabling this in a professional context.

# claude-video — let Claude process videos via frame extraction + transcription

**Source:** <https://github.com/bradautomates/claude-video>
**Discovered:** 2026-07-14
**Viability:** 3/4

> Direct Claude/LLM tooling + dev-productivity: a small, focused capability wrapper around Claude — exactly the kind of extension you author. Easy for Claude to build on or reimplement for your own workflows.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

The MVP is clearly weekend-buildable: ffmpeg frame extraction plus a whisper/transcription pass, wired into an MCP server or CLI wrapper, is a focused sprint well within Claude's autonomous reach and squarely in the user's Claude-tooling wheelhouse. It fills a genuine gap — the profile shows heavy Claude/LLM tooling and voice tools but no video-understanding pipeline, so this adds a capability they lack, and the concept is still fresh with no mature, polished open-source standard for feeding video into Claude. Daily utility is the weak point: video-watching is an occasional task, not a constant daily workflow driver like their diary/logging or finance tools, so this scores 0 there. Net total of 3 makes it viable — a strong fit the user would plausibly want to build, just not something they'd open every single day.

---

## Implementation Plan

I have enough grounding. Writing the plan now.

## Overview

`claude-video` gives Claude the ability to "watch" videos it otherwise can't ingest: a pipeline downloads a video (local file or URL via `yt-dlp`), extracts a token-budgeted set of representative frames with `ffmpeg`, deduplicates near-identical frames, and produces a timestamped transcript (native captions first, Whisper fallback). The output is a manifest of frame image paths + a transcript that Claude reads directly, so it can answer questions about visual and spoken content.

This reimplementation targets the user's own workflows: it ships primarily as a **Claude Code plugin skill** (self-contained CLI) rather than an MCP server, matching the reference repo's distribution model and the user's Claude-tooling wheelhouse. The MVP is a Python CLI that turns any video into a `frames/ + transcript.md + manifest.json` bundle Claude can consume in one Read pass.

## Stack Recommendation

- **Language:** Python 3.14 (already installed; reference repo is 95% Python, stdlib-heavy).
- **Download/captions:** `yt-dlp` (installed at `/usr/bin/yt-dlp`) — handles YouTube/TikTok/Vimeo/local, pulls native subtitle tracks.
- **Frame extraction/dedup:** `ffmpeg` (installed at `/usr/bin/ffmpeg`) for keyframe + scene-change extraction; Pillow (or stdlib + `ffmpeg` `mpdecimate`) for perceptual dedup. Prefer ffmpeg-native dedup to keep deps minimal, add Pillow only if hashing needed.
- **Transcription fallback:** `groq` Whisper (`whisper-large-v3-turbo`, fast + cheap) as primary API, `openai` client as secondary. Use the `gateway-endpoint` / devgate skill for a local dev key rather than a real API key during build.
- **Packaging:** single `video/` skill dir with `SKILL.md` + `scripts/process_video.py`, installable as a Claude Code marketplace plugin and as an Agent Skills CLI package. No web framework, no server.
- **No stack constraint conflicts:** pure CLI, no auth server, no frontend.

## MVP Scope

**In:** `process_video.py <source> [--detail efficient|balanced|token-burner] [--out DIR]` that (1) resolves a local path or downloads via yt-dlp, (2) extracts frames per detail mode with a duration-scaled budget, (3) dedups near-identical frames, (4) gets a timestamped transcript (native captions → Whisper fallback), (5) writes `manifest.json` + `transcript.md` + `frames/NNN_TIMESTAMP.jpg`, and (6) prints a short "how to read this" summary for Claude. Plus a `SKILL.md` so Claude Code invokes it automatically.

**Out (post-MVP):** MCP server wrapper, multi-language caption selection UI, OCR-on-frames, video-scene captioning models, streaming/live video, GUI.

## Implementation Phases

### Phase 1: CLI skeleton + source resolution & download
**Goal:** `process_video.py` accepts a local file or URL and produces a normalized local video file + metadata (duration, fps, resolution) in a work dir.
**Files to create/modify:**
- `pyproject.toml` — project metadata, deps (`yt-dlp` optional, `pillow`, `groq`, `openai`), console entry point `claude-video`.
- `scripts/process_video.py` — argparse CLI: `source`, `--detail`, `--out`, `--keep-video`.
- `scripts/media.py` — `resolve_source()` (local vs URL), `download(url)` via `yt-dlp` subprocess, `probe(path)` via `ffprobe` returning duration/fps/dims as JSON.
- `README.md` — usage + install.
**Key steps:**
1. Set up argparse in `process_video.py`; validate `--detail` choices; create `--out` dir (default `./claude-video-out/<slug>`).
2. In `media.py`, detect URL vs path with `urllib.parse`; for URLs shell out to `yt-dlp -f 'bv*+ba/b' --write-auto-subs --write-subs --sub-langs en.* -o '<workdir>/video.%(ext)s' <url>` and capture the resulting file + any `.vtt`.
3. Implement `probe()` calling `ffprobe -v quiet -print_format json -show_format -show_streams`; parse duration and fps (`r_frame_rate`).
4. Write `manifest.json` stub with `{source, duration, fps, width, height, detail}`.
**Verify:** `python3 scripts/process_video.py /path/to/local.mp4 --out /tmp/cv` writes `/tmp/cv/manifest.json` with correct duration; repeat with a short YouTube URL and confirm `video.*` + `.vtt` download.

### Phase 2: Frame extraction + budget + dedup
**Goal:** For any input video, produce a deduplicated, timestamped set of JPEG frames sized to a token budget scaled by duration and detail mode.
**Files to create/modify:**
- `scripts/frames.py` — `extract_frames(video, detail, duration, out_dir)` and `dedup(frame_paths)`.
- `scripts/process_video.py` — wire frame extraction into pipeline, write frame list to manifest.
**Key steps:**
1. Compute frame budget: `efficient`=cap 50, `balanced`=cap 100, `token-burner`=uncapped; scale down for long videos (e.g. `min(cap, max(12, duration/target_interval))`).
2. `efficient`: extract keyframes with `ffmpeg -skip_frame nokey -i video -vsync 0 -frame_pts 1 -q:v 3 frames/%05d.jpg`. `balanced`/`token-burner`: scene detection `-vf "select='gt(scene,0.3)',showinfo"` and parse `showinfo` pts_time from stderr for timestamps.
3. Temporal-spread trim: if extracted > budget, keep first + last and even-sample the middle so timestamps stay spread.
4. Dedup: run `ffmpeg -vf mpdecimate` pass, or compute average-hash (Pillow) per frame and drop frames within Hamming distance ≤ 4 of the previous kept frame.
5. Rename survivors to `NNN_<HH-MM-SS>.jpg`; record `[{index, path, timestamp_seconds}]` in manifest.
**Verify:** `python3 scripts/process_video.py sample.mp4 --detail balanced --out /tmp/cv` yields `/tmp/cv/frames/*.jpg` with count ≤ cap, filenames carry ascending timestamps, and a slide-heavy clip produces noticeably fewer frames after dedup (log before/after counts).

### Phase 3: Transcription (captions-first, Whisper fallback)
**Goal:** Produce `transcript.md` with timestamped text, using free native captions when present and Whisper only as fallback.
**Files to create/modify:**
- `scripts/transcribe.py` — `from_captions(vtt_path)`, `from_whisper(audio_path, provider)`, `transcribe(workdir, provider)`.
- `scripts/process_video.py` — call transcription, write `transcript.md`.
**Key steps:**
1. If a `.vtt`/`.srt` exists from Phase 1, parse cue timestamps + text (stdlib regex), normalize to `[HH:MM:SS] text` lines, dedup rolling-caption repeats.
2. Fallback: extract audio `ffmpeg -i video -vn -ac 1 -ar 16000 audio.wav`; if >25MB, segment with `ffmpeg -f segment -segment_time 600`.
3. Call Whisper: Groq client `client.audio.transcriptions.create(model="whisper-large-v3-turbo", file=..., response_format="verbose_json")` to get segment timestamps; OpenAI client as secondary. Read key from `GROQ_API_KEY`/`OPENAI_API_KEY`; during dev use a devgate endpoint (`gateway-endpoint` skill) instead of a real key.
4. Write `transcript.md`: header with source + duration, then timestamped lines; note in manifest which source (captions vs whisper) was used.
5. Gracefully degrade: if no captions and no API key, write transcript.md with a clear "no transcript available (frames only)" note and continue.
**Verify:** Run on a captioned YouTube URL → `transcript.md` populated from captions with `source: captions` in manifest; run on a caption-less local clip with a devgate key set → transcript populated with `source: whisper` and timestamps.

### Phase 4: Claude-facing output + SKILL.md packaging
**Goal:** Claude Code auto-invokes the tool on video requests and can read the bundle in one pass to answer questions about the video.
**Files to create/modify:**
- `SKILL.md` — name, description (trigger phrases: "watch this video", "what happens in this video", video URLs/paths), and instructions telling Claude to run `process_video.py` then Read `manifest.json` + `transcript.md` + frames.
- `scripts/process_video.py` — final summary printer: emit a concise stdout block ("Wrote N frames + transcript to DIR. Read manifest.json then the listed frames and transcript.md").
- `.claude-plugin/plugin.json` (or marketplace manifest) — register the skill as a Claude Code plugin.
- `README.md` — install-as-plugin + Agent Skills CLI instructions.
**Key steps:**
1. Write `SKILL.md` frontmatter (`name: claude-video`, description with concrete triggers) and a body instructing the run→read flow, including how to pass frame paths to Read.
2. Make `manifest.json` the single index: `{source, detail, duration, transcript_source, frames:[{index,path,timestamp_seconds}], transcript_path}`.
3. Add plugin manifest so `claude` picks up the skill; test local install via the Claude Code plugin/marketplace mechanism.
4. Final stdout summary must be terse and machine-friendly so Claude knows exactly what to Read next.
**Verify:** In a Claude Code session, ask "watch /tmp/sample.mp4 and tell me what happens" → skill triggers, script runs, Claude Reads the manifest + frames + transcript and answers with references to specific timestamps.

## Estimated Effort

**3 Claude Code sessions (~8-10 hours total).**
- **Session 1 (Phases 1-2):** CLI skeleton, yt-dlp download + ffprobe metadata, then frame extraction/budget/dedup — the ffmpeg scene-detection + timestamp parsing is the meatiest part.
- **Session 2 (Phase 3):** Caption parsing, audio extraction/segmentation, Groq/OpenAI Whisper integration with graceful degradation, wired end-to-end.
- **Session 3 (Phase 4 + hardening):** SKILL.md + plugin packaging, output manifest polish, real end-to-end test in a live Claude Code session, edge-case fixes (long videos, no-audio clips, private/blocked URLs).

## Potential Blockers

- **Whisper API key at dev time:** Groq/OpenAI both need a key. Use the `gateway-endpoint` (devgate) skill to create a local OpenAI-compatible endpoint so no real key is burned during build; swap to a real `GROQ_API_KEY` for production. Also verify Groq's 25MB file cap → segmentation path actually works.
- **yt-dlp fragility:** YouTube/TikTok frequently change extractors; downloads can fail or require cookies/age-gating. Mitigate by (a) making local-file the primary happy path, (b) surfacing yt-dlp stderr clearly, (c) pinning a recent yt-dlp and documenting `--cookies-from-browser` as an escape hatch.
- **Timestamp parsing from ffmpeg `showinfo`:** scene-detect timestamps come from stderr text, not a clean API — regex parsing is brittle across ffmpeg versions. Validate against the installed ffmpeg build early.
- **Token budget vs context:** `token-burner` mode can emit hundreds of frames and blow Claude's context/Read limits. Enforce a hard ceiling and warn; dedup quality directly determines usefulness.
- **Plugin/marketplace packaging specifics:** the exact Claude Code plugin manifest format may need checking against current docs (use Context7 or the plugin skill) before Phase 4 — don't assume the schema from memory.
- **No MCP in MVP:** if the user later wants MCP, that's an added wrapper session, not covered here.

Plan file location if you want it persisted: none written (returned inline per instructions). Reference implementation studied: https://github.com/bradautomates/claude-video.

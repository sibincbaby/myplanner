# video-vision — Video Understanding Plugin for Claude Code

**Source:** [jordanrendric/claude-video-vision](https://github.com/jordanrendric/claude-video-vision) · GitHub · TypeScript · ~1.1k★ · Plugin marketplace
**Date discovered:** 2026-08-24

## What it is

claude-video-vision is a Claude Code plugin that gives Claude the ability to understand video files — screen recordings, tutorials, bug reproductions, CI video artifacts. It uses **ffmpeg** to extract frames at configurable fps and a separate audio backend (Gemini API, local Whisper, or OpenAI) to transcribe the audio track, then passes both to Claude as a structured perception payload: images with timestamps + synchronized transcription.

The plugin handles YouTube URLs via `yt-dlp`, adaptive frame rate extraction, and integrates as a `/watch-video` slash command inside Claude Code.

## Why it fits

- Core interest: **Claude/LLM tooling** — extends Claude Code with a new perception modality (video)
- Core interest: **Dev productivity** — specific use cases: replaying a screen recording of a bug, understanding a tutorial without watching it manually, analyzing a CI video artifact
- `novel = 1`: no prior plan covers video as a Claude Code input modality. The toolkit has web search, file read, and tool calls — but no way to feed Claude a `.mp4` or `.mov` file
- `daily_utility = 0`: not every day, but high-value when it triggers (roughly: any time a colleague sends a Loom, any time a bug can't be reproduced but was screen-recorded)

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | ffmpeg + Claude vision API + a Claude Code skill is one session |
| fills_gap | 1 | No prior plan covers video perception for Claude Code |
| novel | 1 | Video input is a new modality for the coding-assistant context |
| daily_utility | 0 | Useful but not daily — triggered by screen recordings, tutorials, CI videos |
| **Total** | **3/4** | **VIABLE** |

**Note:** The plan below is for a minimal local tool rather than a plugin marketplace submission. The source repo already exists and can be installed directly (`/plugin marketplace add https://github.com/jordanrendric/claude-video-vision`). The plan exists if you want a private version with different defaults (no Gemini dependency, local Whisper only, tighter frame budget) or to extend it with dev-specific features (diff overlay, git blame at the timestamp).

## Stack Recommendation

```
Language:   TypeScript with tsx, or Python 3.11+
ffmpeg:     Required system dependency (brew install ffmpeg)
Whisper:    Local whisper.cpp or Python whisper for offline transcription
Claude:     Anthropic SDK — vision messages with base64 frames
Skill:      SKILL.md + Bash tool wrappers for the CLI
Config:     ~/.config/video-vision/config.json — max_frames, fps, whisper_model
```

No cloud audio dependency in the plan below. Whisper runs locally; all frames stay on device. The only network call is to the Claude API for vision understanding.

## MVP Scope (1-2 Claude sessions)

Three commands and one Claude Code skill:

1. `video-vision extract <path> [--fps 1] [--max-frames 30]` — extract frames as JPEG files to a temp dir
2. `video-vision transcribe <path>` — run whisper on the audio track, return timestamped transcript
3. `video-vision analyze <path> [--question "what is happening?"]` — extract frames + transcribe + call Claude vision, return a structured summary
4. **Skill** (`SKILL.md`) — trigger: `/watch-video <path> [question]` → calls `video-vision analyze`, pastes result into context

## Phases

### Phase 1: Frame Extraction (0.5h)
- `video-vision extract path/to/video.mp4 --fps 1 --max-frames 30`
- Runs `ffmpeg -i <input> -vf fps=1 -frames:v 30 /tmp/video-vision-<hash>/%04d.jpg`
- Returns: list of paths + timestamps (derived from frame number × fps)
- Verify: a 60s video at 1fps yields 30 frames, each ~100KB JPEG

### Phase 2: Local Transcription (0.5h)
- `video-vision transcribe path/to/video.mp4`
- Extracts audio: `ffmpeg -i input -vn -ar 16000 audio.wav`
- Runs `whisper audio.wav --model base --output-format json`
- Returns: `[{start: 0.0, end: 2.4, text: "..."}]` segments
- Verify: a 30s video with speech → transcript with timestamps within ±2s

### Phase 3: Claude Vision Integration (1h)
- `video-vision analyze path/to/video.mp4 --question "what bug is shown?"`
- Load frames (capped at 20 images to stay under the vision token limit)
- Build a vision message: interleave frame images with timestamp labels + append the transcript
- Call Claude API with `model: claude-opus-5` (best vision reasoning) and the structured payload
- Return: markdown summary with sections `## What happens`, `## Key moments`, `## Answer to your question`
- Verify: a screen recording of a React rendering bug → Claude identifies the component and timestamps the first bad render

### Phase 4: Claude Code Skill (0.5h)
- Write `.claude/skills/video-vision/SKILL.md` with:
  - Trigger: "watch", "analyze this video", "look at this recording", `.mp4`, `.mov`, `.webm`, YouTube URL
  - On-load: run `video-vision analyze <path> --question "<user question>"`
  - Paste the structured summary into context
  - Include the frame timestamps so Claude can refer to specific moments
- Verify: type `/watch-video ~/Desktop/bug-recording.mov "why does the button flicker?"` — summary appears inline

### Phase 5: Diff Overlay (0.5h)
- `video-vision diff <path> --before 5s --after 15s` — extract frames from two time windows, generate a visual diff of what changed on screen
- Uses imagemagick `compare` to highlight changed pixels between frame pairs
- Useful for: "show me exactly when the layout broke" without scrubbing manually
- Verify: a recording where a UI element appears at 8s → diff overlay highlights the new element

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Frame extraction | 0.5h |
| Local transcription | 0.5h |
| Claude vision integration | 1h |
| Claude Code skill | 0.5h |
| Diff overlay | 0.5h |
| **Total** | **3h (half-day)** |

## Blockers / Risks

- **Frame budget is tight.** Claude's vision API accepts up to 20 images per request at full quality, or more at reduced resolution. A 5-minute video at 1fps is 300 frames — far over budget. The extract phase must apply a budget: either downsample fps (1 frame per 10 seconds for long videos) or use keyframe detection (`ffmpeg -skip_frame noref`) to only extract scene changes. Set a hard cap of 20 frames in Phase 3 and add `--smart-sample` as a Phase 5 enhancement.
- **Whisper model size vs. quality trade-off.** `whisper-base` is fast (~5s for 1 minute of audio) but misses technical vocabulary. `whisper-small` or `whisper-medium` are more accurate but slower. Start with `base` for the MVP; add `--model` flag so the user can upgrade when needed.
- **Large videos create large temp dirs.** 30 JPEG frames at ~100KB each = 3MB, which is fine. A video with 300 frames = 30MB. Add `--cleanup` flag that deletes the temp dir after analysis completes. Default behavior should clean up automatically.
- **The source plugin (jordanrendric/claude-video-vision) already exists and may be sufficient.** Install it via `/plugin marketplace add https://github.com/jordanrendric/claude-video-vision` and test it before building from scratch. The main reason to build your own is: (1) you want offline-only (no Gemini for audio), (2) you want the diff overlay from Phase 5, or (3) you want the frame budget logic tuned differently.
- **YouTube support adds a yt-dlp dependency.** Omit this in Phase 1; the user can download videos locally first. Add yt-dlp support in a later iteration if YouTube URLs come up often.

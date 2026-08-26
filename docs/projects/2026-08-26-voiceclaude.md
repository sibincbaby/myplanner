# VoiceClaude — Sub-Second Voice Shell for Claude

**Source:** [Kevthetech143/claude-voice](https://github.com/Kevthetech143/claude-voice) · Python · 2★ · GitHub (Aug 2026)
**Date discovered:** 2026-08-26

## What it is

Claude-voice is a production-architecture voice assistant that pipes audio into Claude with sub-second latency. The pipeline: wake word → Whisper STT → Claude streaming → sentence chunker → TTS output. The key innovation is the **sentence chunker**: Claude's streaming response is split into sentences as they arrive, and TTS begins speaking sentence 1 while Claude is still generating sentence 2. This eliminates the "wait for full response, then speak" delay that makes most voice AI feel sluggish.

It is in active development (ALPHA complete, BETA in progress) but the core pipeline is functional.

## Why it fits

- Core interest: **Claude/LLM tooling** — native Claude API integration with streaming support
- Core interest: **Dev productivity** — hands-free queries while eyes are on the screen or hands are on keyboard
- `novel = 1`: sentence-chunking for low-latency voice response is not in any prior plan or toolkit entry
- `daily_utility = 0`: niche; most sessions are text-driven; voice is useful for specific workflows

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Whisper + Claude streaming + pyttsx3 TTS is one Python session |
| fills_gap | 1 | No voice interface for Claude exists in the current toolkit |
| novel | 1 | Sentence-chunking pipeline architecture is a fresh approach |
| daily_utility | 0 | Useful for specific hands-free workflows, not every session |
| **Total** | **3/4** | **VIABLE** |

**Note:** The plan below builds a personal version called `vclaude`. Try the source repo first — if `python main.py` works, use it directly and skip the build. The personal version targets a simpler no-daemon architecture without wake word for a first version.

## Stack Recommendation

```
Language:       Python 3.12 with uv
STT:            openai-whisper (local, whisper.cpp via pywhispercpp for speed)
LLM:            Claude claude-sonnet-5 via anthropic SDK (streaming)
TTS:            pyttsx3 (offline, no latency) or Chatterbox TTS (higher quality)
Wake word:      pvporcupine (Picovoice, free tier) — Phase 3
Audio I/O:      sounddevice + numpy
Chunker:        sentence splitting on `. `, `? `, `! ` with 2-sentence buffer
CLI:            vclaude listen | vclaude ask "text" | vclaude config
```

## MVP Scope (1-2 Claude sessions)

A single Python script `vclaude.py` with two modes:
1. **`vclaude ask "text"`** — text in, voice out (no microphone required; validates the pipeline)
2. **`vclaude listen`** — press Enter to start recording, Enter to stop, then speak → Claude → TTS

No wake word, no daemon in Phase 1. Just the core pipeline working end-to-end.

## Phases

### Phase 1: Text-In Voice-Out Pipeline (1h)
- `vclaude ask "What's a 3-line Python function to flatten a list?"`
- Claude streaming → chunker (split on sentence boundaries) → speak each chunk via pyttsx3 as it arrives
- Verify: first sentence is spoken within 1s of the first Claude token; total response heard before full text would be printed

### Phase 2: Microphone Input (1h)
- `vclaude listen`: press Enter → start recording (sounddevice); press Enter → stop
- Transcribe recording with local Whisper (base model, fast enough for < 10s clips)
- Pipe transcript into Phase 1 pipeline
- Verify: speak "What day is it?" → Claude responds with voice within 2s of audio stop

### Phase 3: Wake Word (1h)
- Integrate pvporcupine free tier: listen continuously; on "Hey Claude" → start capturing
- Auto-stop capture after 3s of silence (VAD via webrtcvad)
- Run full pipeline from wake word to TTS without any keypresses
- Verify: "Hey Claude, remind me what async/await does" → spoken response, no keyboard interaction

### Phase 4: Coding Workflow Mode (0.5h)
- `vclaude code` — a mode that prepends a system prompt focused on code: "Answer concisely. For code, describe what the snippet does verbally rather than reading it aloud. Offer to paste results to clipboard."
- Clipboard paste: if Claude's response contains a code block, silently copy to clipboard and say "Code copied to clipboard."
- Verify: ask a coding question → verbal explanation + code in clipboard

### Phase 5: Hotkey Trigger (0.5h)
- Background listener (pynput) on a configurable hotkey (default: Ctrl+Shift+V)
- Press hotkey → start 5s recording window → release or silence → pipeline
- Works system-wide, no terminal focus needed
- Verify: hotkey from inside VS Code → spoken Claude response without switching windows

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Text-in voice-out | 1h |
| Microphone input | 1h |
| Wake word | 1h |
| Coding workflow mode | 0.5h |
| Hotkey trigger | 0.5h |
| **Total** | **4h (one day)** |

## Blockers / Risks

- **Whisper latency.** The `base` model runs in ~0.5s on CPU for a 5s clip. The `small` model (~1s on CPU) gives better accuracy for coding terminology. Try `base` first; upgrade to `small` if transcription quality is poor. pywhispercpp (C++ binding) is faster than the Python reference.
- **TTS quality.** pyttsx3 is functional but robotic. Chatterbox TTS (open-source, local, Aug 2026) produces human-quality output but adds 200–400ms latency per sentence. For Phase 1, use pyttsx3 to validate the pipeline; swap for Chatterbox in Phase 4.
- **Sentence chunker edge cases.** Abbreviations ("e.g.", "i.e.", "Dr.", "Fig.") and code inline spans ("`.js`") contain periods that aren't sentence boundaries. The chunker needs a simple exclusion list and a minimum-chunk-length gate (don't speak fewer than 15 chars) to avoid speaking half-words.
- **Wake word accuracy.** Picovoice free tier works well in quiet environments; degrades in open offices. Add a PTT fallback (press-to-talk hotkey from Phase 5) as the primary mode, with wake word as opt-in.
- **System audio feedback loop.** If TTS output is captured by the microphone, it triggers another listen cycle. Use VAD to mute the microphone during TTS playback, or route TTS to headphone output only. Document this as a known issue in the README.
- **Coding mode code reading.** Claude may still try to read code aloud ("`for i in range ten`"). A post-processing filter that replaces code blocks with "[code block]" before TTS, and copies the block to clipboard silently, handles this more reliably than a system prompt alone.

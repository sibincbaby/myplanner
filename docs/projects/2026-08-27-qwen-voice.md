# Qwen Voice — Full-Duplex Voice Runtime for Running Coding Agents

**Source:** [QwenAudio/qwen-audio-agent](https://github.com/QwenAudio/qwen-audio-agent) · TypeScript · 2k★ · GitHub (Aug 2026)
**Date discovered:** 2026-08-27

## What it is

qwen-audio-agent is a realtime voice runtime that wraps around a running coding agent (Claude Code, Codex, OpenCode) and gives it a persistent voice channel. While the agent is executing a long task in the background, you can talk to it: ask status questions, redirect it, or accept/reject sub-decisions — without interrupting the coding task.

The key capabilities over a simple STT→API→TTS voice shell (cf. vclaude 2026-08-26):
- **Full-duplex:** barge-in while the agent is still speaking; voice and task proceed on parallel tracks
- **ACP backend:** the agent is a long-running Claude Code / Codex process, not a one-shot API call; sessions persist across voice turns
- **Parallel background tasks:** voice conversation continues while the agent runs tests, commits, or calls tools
- **Local wake word:** "Hello Qianwen" (or configurable); no push-to-talk required
- **Cross-agent:** one voice runtime connects to whatever ACP-compatible backend is running

The distinction from vclaude: vclaude is a voice interface to Claude API (one turn at a time). qwen-voice is a voice channel into a long-running agentic session where Claude Code is autonomously doing things — you can talk while it works.

## Why it fits

- Core interest: **Claude/LLM tooling** — wraps Claude Code as ACP backend; no separate API billing beyond what Claude Code already uses
- Core interest: **Agent UIs** — voice is the most natural interface for delegating long-running agentic tasks
- Core interest: **Dev productivity** — talk to a running coding task without touching the keyboard; accept/reject changes by voice
- `novel = 1`: full-duplex voice control of a long-running Claude Code session is not covered by vclaude or any prior plan
- `daily_utility = 1`: every long-running Claude Code task becomes a voice-interactive session

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Simplified version: pyaudio + Whisper + Claude Code subprocess + pyttsx3 TTS |
| fills_gap | 1 | vclaude handles one-turn voice; no plan covers voice control of running agent sessions |
| novel | 1 | Parallel voice + task execution with barge-in is a genuinely different architecture |
| daily_utility | 1 | Every long Claude Code task becomes voice-interactive; daily friction reduction |
| **Total** | **4/4** | **VIABLE** |

**Try qwen-audio-agent first.** If it installs cleanly (`npm install -g qwen-audio-agent`) and you have a DashScope API key, run the existing tool against Claude Code. The plan below builds a lighter personal version — `agentvoice` — using Whisper local STT and Claude Code's `--output-format stream-json` flag, for the case where you want zero DashScope dependency.

## Stack Recommendation

```
Language:       Python 3.12 with uv
STT:            openai-whisper (local, faster-whisper for speed) or whisper.cpp
TTS:            pyttsx3 (offline) — upgrade to Chatterbox TTS for higher quality
Agent backend:  Claude Code CLI via subprocess with --output-format stream-json
Voice I/O:      sounddevice + numpy; pyaudio fallback
Barge-in:       WebRTC VAD (webrtcvad) to detect speech and interrupt TTS
Wake word:      pvporcupine free tier OR push-to-talk key binding (Phase 1: push-to-talk)
Process bridge: asyncio subprocess wrapper watching Claude Code stdout stream
```

## MVP Scope (1-2 Claude sessions)

A Python daemon `agentvoice` that:
1. Starts a Claude Code process as a subprocess with `--output-format stream-json`
2. Watches Claude Code's stdout for task-update events (tool calls, results, errors)
3. Provides a voice channel: hold-to-talk → Whisper STT → send as user message to Claude Code stdin
4. Reads Claude Code assistant responses via TTS with sentence-chunking (inherited from vclaude architecture)
5. Displays a minimal terminal UI showing agent status alongside voice input/output

No barge-in in Phase 1 (push-to-talk only). No wake word in Phase 1.

## Phases

### Phase 1: Agent Subprocess + Text Bridge (1.5h)
- Wrap Claude Code CLI: `proc = subprocess.Popen(['claude', '--output-format', 'stream-json', ...])`
- Parse streaming JSON from stdout; extract `assistant` message events
- Accept input from a simple text prompt (no voice yet) — send via proc.stdin
- Verify: type "write a hello world function" → see Claude Code working, then see the completed function; type "what did you just write?" → context-aware reply
- This validates the two-way subprocess bridge before adding voice

### Phase 2: Voice Input (1h)
- Add hold-to-talk: press and hold Spacebar → sounddevice records → release → Whisper transcribes → send to Claude Code
- Sentence-chunk Claude Code response for TTS: speak each sentence as it arrives (reuse vclaude architecture)
- Terminal shows transcript of both voice input and Claude Code output in real time
- Verify: hold Spacebar, say "add a unit test for that function", release → Claude Code writes the test → TTS reads the plan aloud

### Phase 3: Barge-in (1h)
- Add webrtcvad voice-activity detector running on a background thread
- While TTS is speaking, VAD monitors microphone; speech detected → interrupt TTS → record and transcribe → send to Claude Code
- Verify: Claude Code is speaking a long plan → speak over it → it stops and processes the interruption
- Edge case: TTS pausing between sentences must not trigger false barge-in; tune VAD aggressiveness level

### Phase 4: Task Status Narration (1h)
- Parse Claude Code tool_use events from stream-json: when Claude Code calls a tool (bash, read_file, write_file), narrate it briefly
- `[Tool: bash]` → TTS says "Running a shell command" (don't read the full command — too verbose)
- `[Tool: write_file]` → "Writing a file"
- Configurable verbosity: `--quiet` suppresses narration; `--verbose` reads tool arguments
- Verify: run a task that calls 4 tools → TTS narrates each tool call without blocking; user can interrupt at any point

### Phase 5: Wake Word (0.5h)
- Integrate pvporcupine free wake word model with keyword "computer" (built-in, no training)
- Replace push-to-talk with always-on VAD + wake word: say "computer" → begin recording; silence for 1.5s → end recording
- Fallback: push Spacebar still works if wake word is unwanted in open-plan office
- Verify: say "computer, how many tests are passing?" → transcribed and sent without touching keyboard

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Agent Subprocess + Text Bridge | 1.5h |
| Voice Input | 1h |
| Barge-in | 1h |
| Task Status Narration | 1h |
| Wake Word | 0.5h |
| **Total** | **5h (one day)** |

## Blockers / Risks

- **Claude Code subprocess stdin/stdout protocol.** The `--output-format stream-json` flag is documented but the exact event schema for multi-turn sessions needs verification in the current Claude Code version. Read the schema by running `claude --help` and inspecting a few turns before building the bridge.
- **TTS blocking voice input.** In Phase 1, TTS and VAD run on the same thread. Barge-in (Phase 3) requires TTS on a background thread with a `stop_event`. Design for this from Phase 2: run TTS in a daemon thread from the start.
- **Whisper latency.** `openai-whisper` transcription on CPU takes 2-4s for a 5s clip. Use `faster-whisper` with `tiny.en` model for <1s transcription on CPU, or `base.en` for higher accuracy. Switch to the local whisper.cpp binary if latency is still too high.
- **Claude Code session isolation.** If multiple Claude Code sessions are running, `agentvoice` needs to attach to the correct one. In Phase 1, just start Claude Code as a child process (always the right instance). Multi-session support is a future phase.
- **Voice in a shared space.** The hold-to-talk Spacebar binding requires the terminal to have focus. If you switch to another window, the binding stops. Consider a global hotkey via `pynput` instead of `sounddevice` keyboard hook.
- **vclaude overlap.** If vclaude (from the 2026-08-26 plan) is already in use, share the Whisper model loading code (startup cost) by extracting it into a `whisper_pool.py` module both tools import. Don't run two Whisper instances simultaneously.

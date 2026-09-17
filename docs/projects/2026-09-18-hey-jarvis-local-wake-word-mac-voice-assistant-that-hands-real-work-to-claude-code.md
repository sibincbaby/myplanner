# hey-jarvis — Local Wake-Word Mac Voice Assistant That Hands Real Work to Claude Code

**Source:** <https://github.com/dijiclick/hey-jarvis>
**Discovered:** 2026-09-18
**Viability:** 3/4

> Voice-to-agent is a recurring build target for the user (voice-coder, dictation tooling), and this one is notable for splitting duties: cheap realtime model for conversation, Claude Code for the work, with a spoken approval gate in between. Claude tooling + dev productivity + voice UI. Linux port and a Flutter phone client are both natural Claude-executable follow-ons.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

A scoped MVP is realistic for Claude in 1-2 sessions if the exotic parts are dropped: local wake word (openWakeWord/Porcupine) → local or API STT → `claude -p` headless execution → TTS reply, with a spoken confirm step before writes; the upstream LiveKit + Gemini Live/Realtime stack is optional polish, though the macOS-only assumption means a Linux port is part of the work. It does fill a real gap — the user's existing voice tooling (voice-coder) is file-in/text-out transcription, not an always-listening hands-free path into Claude Code, and it sits squarely in their Claude-wrapper/agent-UI interest cluster. Novelty holds up: dictation tools and generic voice assistants are mature, but a wake-word layer that delegates actual execution to Claude Code with spoken risk gating has no polished OSS equivalent. Daily utility is the weak leg — the user's environment is Linux desktop/terminal work, and voice-driven coding is typically a burst-use novelty that gets abandoned for the keyboard, so it fails the "every single day" bar.

---

## Implementation Plan

## Overview

`hey-jarvis` upstream is a macOS-only, LiveKit + Gemini Live/OpenAI Realtime voice assistant that delegates execution to Claude Code. The interesting kernel — **wake word → speech → Claude Code headless execution → spoken confirmation before writes → spoken result** — does not need LiveKit or a realtime multimodal API. This plan builds that kernel from scratch as a Linux-first (macOS-compatible) Python daemon, since the user's machine is Linux desktop/terminal.

Architecture: a single always-on Python process with a small state machine (`IDLE → WAKE → LISTEN → TRANSCRIBE → PLAN → CONFIRM → EXECUTE → SPEAK`). Audio in via PulseAudio/PipeWire through `sounddevice`. Wake word via `openWakeWord` (Apache-2.0, ONNX, no API key; Porcupine needs an access key so it's a fallback, not the default). STT via `faster-whisper` locally (no key) with an OpenAI Whisper API fallback. Execution via the `claude` CLI in headless mode (`claude -p --output-format stream-json`), scoped to a configured project directory. TTS via `piper` locally with `espeak-ng` fallback.

The safety gate is the differentiator and must be structural, not prompt-based: run Claude in **plan/read-only mode first** (`--permission-mode plan` or a read-only `--allowedTools` set), speak the proposed change, require a spoken "yes"/"do it" match, and only then re-run with write tools enabled and `--resume` on the same session id.

## Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Language | Python 3.11 or 3.12 via `uv` | `openwakeword`, `onnxruntime`, `faster-whisper` wheels lag on 3.13/3.14; system python here is 3.14.3 so a pinned venv is mandatory |
| Env/deps | `uv` (`uv venv --python 3.12`, `uv pip install`) | fast, reproducible, no global pollution |
| Audio I/O | `sounddevice` (PortAudio) + `numpy` | cross-platform 16 kHz mono capture, works over PulseAudio/PipeWire |
| Wake word | `openwakeword` (pretrained `hey_jarvis_v0.1.onnx` ships with it) | no API key, ONNX CPU, and the upstream name literally matches a bundled model |
| VAD / endpointing | `webrtcvad` (or `silero-vad` ONNX) | detect end of utterance so we stop recording |
| STT | `faster-whisper` (`base.en`/`small.en`, int8 CPU) | offline, ~1-2 s for short commands; optional `openai` Whisper API path behind config |
| Execution | `claude` CLI headless: `claude -p --output-format stream-json --verbose` | the whole point of the project; uses the user's existing Claude Code auth |
| TTS | `piper` (`en_US-amy-medium.onnx`) → fallback `espeak-ng` → fallback `say` on macOS | offline, fast, decent quality |
| Config | `pydantic-settings` + `~/.config/hey-jarvis/config.toml` | typed, per-machine |
| CLI | `typer` | `hey-jarvis run / listen-once / say / doctor` |
| Tests | `pytest` + prerecorded WAV fixtures | audio pipeline testable without a mic |

Explicitly **dropped from upstream**: LiveKit, Gemini Live, OpenAI Realtime, macOS-only APIs. Keep them as a Phase 5 optional `providers/realtime.py` seam.

## MVP Scope

**In:**
1. Daemon that listens continuously on the default input device, wakes on "hey jarvis".
2. Records the following utterance until VAD silence (max 20 s), transcribes locally.
3. Sends the transcript to `claude -p` in read-only/plan mode against a configured project dir.
4. Speaks a short summary of the plan and asks "Should I do it?".
5. Listens for a spoken yes/no; on yes, resumes the same Claude session with write tools enabled and speaks the result summary.
6. Anything classified as risky (writes, `git push`, `rm`, network, package install) always goes through the gate; pure-read questions ("what does this file do") answer directly without a gate.
7. `hey-jarvis doctor` verifies mic, models, `claude` CLI, TTS.
8. Full transcript log to `~/.local/state/hey-jarvis/sessions/<ts>.jsonl`.

**Out (v1):** multi-turn conversation memory beyond one exchange, barge-in/interrupt, realtime API providers, phone client, multi-project routing, GUI.

## Implementation Phases

### Phase 1: Skeleton, config, and audio capture
**Goal:** A CLI that captures 16 kHz mono mic audio, detects "hey jarvis", and prints a timestamp on each detection.

**Files to create/modify:**
- `pyproject.toml` — project metadata, deps (`sounddevice`, `numpy`, `openwakeword`, `webrtcvad`, `typer`, `pydantic-settings`, `rich`), `requires-python = ">=3.11,<3.13"`
- `src/hey_jarvis/__init__.py` — version
- `src/hey_jarvis/config.py` — `Settings` model: `project_dir`, `wake_model`, `wake_threshold` (default 0.5), `stt_backend`, `tts_backend`, `claude_bin`, `max_utterance_s`, `silence_ms`, `risky_patterns`; loads `~/.config/hey-jarvis/config.toml` with env override `HEY_JARVIS_*`
- `src/hey_jarvis/audio.py` — `MicStream` context manager yielding 80 ms int16 frames; `record_until_silence(stream, vad, max_s, silence_ms) -> np.ndarray`; `save_wav(path, pcm)`
- `src/hey_jarvis/wake.py` — `WakeDetector` wrapping `openwakeword.Model`, `.feed(frame) -> float`, debounce so one utterance fires once
- `src/hey_jarvis/cli.py` — `typer` app with `run`, `doctor`, `listen-once`
- `src/hey_jarvis/__main__.py` — entry point
- `tests/fixtures/` — record 3 WAVs: wake word, a command, background noise
- `tests/test_wake.py` — asserts detector fires on the wake fixture, not on noise

**Key steps:**
1. `uv venv --python 3.12 .venv && uv pip install -e ".[dev]"`; add `.python-version`.
2. In `wake.py`, call `openwakeword.utils.download_models()` once on first run into `~/.cache/hey-jarvis/models/`; load `hey_jarvis_v0.1` (falls back to `alexa` if absent).
3. `audio.py`: open `sounddevice.RawInputStream(samplerate=16000, blocksize=1280, dtype='int16', channels=1)`; push frames to a `queue.Queue` from the callback — never do model inference inside the PortAudio callback.
4. Debounce: after a detection, suppress further detections for 1.5 s and drain the queue.
5. `doctor` command: list input devices, run 2 s capture and report RMS, check model files exist, `shutil.which(claude_bin)`.
6. `listen-once`: block until wake word, then `record_until_silence`, write `/tmp/hey-jarvis-utterance.wav`, print duration.

**Verify:** `.venv/bin/hey-jarvis doctor` reports a live input device with non-zero RMS, then `.venv/bin/hey-jarvis listen-once` — say "hey jarvis, list the python files" — writes `/tmp/hey-jarvis-utterance.wav`; `ffplay /tmp/hey-jarvis-utterance.wav` plays back the command without the wake word truncating it. `pytest tests/test_wake.py` passes.

---

### Phase 2: STT and TTS round trip
**Goal:** Saying "hey jarvis, what time is it" produces a printed transcript and a spoken canned reply — full audio-in/audio-out loop with no Claude yet.

**Files to create/modify:**
- `src/hey_jarvis/stt.py` — `Transcriber` protocol; `FasterWhisperSTT` (model size from config, `compute_type="int8"`, `language="en"`, `vad_filter=True`); `OpenAIWhisperSTT` fallback reading `OPENAI_API_KEY`
- `src/hey_jarvis/tts.py` — `Speaker` protocol; `PiperTTS` (subprocess `piper --model ... --output_file -` piped to `aplay`/`sounddevice`), `EspeakTTS`, `MacSayTTS`; auto-select in `Speaker.detect()`
- `src/hey_jarvis/cli.py` — add `say` and `transcribe <wav>` commands
- `scripts/install_models.sh` — downloads piper voice + whisper model, prints sizes
- `tests/test_stt.py` — transcribes the command fixture, asserts key tokens present

**Key steps:**
1. Install `faster-whisper`; first run downloads `small.en` (~450 MB) to `~/.cache/huggingface`. Warm the model at daemon start (one dummy 1 s transcribe) so the first real command isn't slow.
2. Install piper: `uv pip install piper-tts` or download the release binary to `~/.local/bin/piper`; fetch `en_US-amy-medium.onnx` + `.json` into `~/.cache/hey-jarvis/voices/`.
3. Implement `Speaker.say(text)` synchronously and `Speaker.say_async(text) -> handle` with a `stop()` — needed later for interrupts.
4. Mute the mic (set a `self.speaking` flag that drops wake frames) while TTS plays, so Jarvis doesn't hear itself.
5. Wire `run` to: wake → record → transcribe → print → speak `"You said: {transcript}"`.
6. Log every stage with timings to `~/.local/state/hey-jarvis/sessions/<ts>.jsonl`.

**Verify:** `.venv/bin/hey-jarvis run`, say "hey jarvis, open the readme file" — terminal prints the transcript within ~2 s and the speakers say it back. `.venv/bin/hey-jarvis transcribe tests/fixtures/command.wav` prints the expected text.

---

### Phase 3: Claude Code headless execution
**Goal:** A spoken command runs in Claude Code against the configured project and the spoken answer is Claude's actual result.

**Files to create/modify:**
- `src/hey_jarvis/claude_runner.py` — `ClaudeRunner.run(prompt, *, mode, session_id=None) -> RunResult`
- `src/hey_jarvis/prompts.py` — system-prompt-append text instructing Claude to end every response with a `SPOKEN: <one or two sentences>` line
- `src/hey_jarvis/session.py` — state machine orchestrating wake/record/stt/claude/tts
- `src/hey_jarvis/cli.py` — add `ask "<text>"` for keyboard-driven testing of the same path
- `tests/test_claude_runner.py` — parses a captured `stream-json` fixture, no live CLI call

**Key steps:**
1. `ClaudeRunner` shells out with `asyncio.create_subprocess_exec`:
   `claude -p <prompt> --output-format stream-json --verbose --permission-mode <plan|acceptEdits> --append-system-prompt <prompts.SPOKEN_CONTRACT> --add-dir <project_dir>` with `cwd=project_dir`.
2. Parse stream-json line by line; capture `session_id` from the `system`/`init` event and the final `result` event's `result` text. Enforce a hard timeout (config `claude_timeout_s`, default 180) and kill the process group on timeout.
3. Extract the `SPOKEN:` line for TTS; if absent, fall back to the first 2 sentences of the result, stripped of code fences, backticks, and paths longer than 40 chars (`speech.py` helper `to_speakable(text)` — collapse paths to basenames, spell out `->`, drop markdown).
4. Speak a filler ("Working on it") immediately on dispatch so the 10-60 s Claude latency isn't dead air; optionally play a soft tick every 15 s.
5. Handle non-zero exit and "not logged in" stderr by speaking "Claude Code isn't authenticated" and logging stderr.
6. Verify the `claude` binary path at startup — it is not on PATH in a plain non-login shell here, so `doctor` must resolve it explicitly (config `claude_bin`, default `shutil.which("claude") or ~/.local/bin/claude or ~/.claude/local/claude`).

**Verify:** `.venv/bin/hey-jarvis ask "how many python files are in this repo"` prints Claude's stream and speaks a one-sentence answer. Then `run` + spoken "hey jarvis, how many python files are in this project" gives the same spoken answer end to end.

---

### Phase 4: Spoken confirmation gate for risky actions
**Goal:** Any command that would write, delete, install, or push is first planned read-only, spoken aloud, and executed only after a spoken yes.

**Files to create/modify:**
- `src/hey_jarvis/gate.py` — `classify(transcript) -> Intent` (`READ_ONLY` | `MUTATING`); `confirm(speaker, recorder, stt) -> bool`
- `src/hey_jarvis/claude_runner.py` — add explicit tool allowlists: read mode `--allowedTools "Read,Grep,Glob,Bash(git status:*),Bash(git diff:*),Bash(ls:*)" --disallowedTools "Write,Edit,NotebookEdit"`; write mode resumes via `--resume <session_id> --permission-mode acceptEdits`
- `src/hey_jarvis/session.py` — insert PLAN → CONFIRM → EXECUTE branch
- `src/hey_jarvis/prompts.py` — `PLAN_CONTRACT`: "Do not modify anything. Describe the exact change in one sentence after `SPOKEN:` and list files you would touch after `FILES:`."
- `tests/test_gate.py` — table test of ~25 transcripts → expected classification, including adversarial ones ("just quickly delete the temp files")

**Key steps:**
1. `classify` is two-layer and **fails closed**: (a) regex/keyword layer on verbs (`write, edit, create, delete, remove, rm, commit, push, install, deploy, chmod, migrate, refactor, rename, fix, add`) and (b) the plan run's own reported `FILES:` list — if Claude names any file it would modify, treat as MUTATING regardless of the keyword verdict. Unknown/ambiguous → MUTATING.
2. Plan phase: run with read-only tools; speak `"{plan sentence}. Touching {n} files. Should I do it?"`.
3. `confirm()`: record up to 6 s without requiring the wake word, transcribe, match against `YES = {yes, yeah, yep, do it, go ahead, confirm, approved}` and `NO = {no, nope, cancel, stop, abort, never mind}`. No match → re-ask once, then default to **no** and say "Cancelled."
4. Execute phase: `--resume <session_id>` so Claude keeps the plan context, with `--permission-mode acceptEdits` and a write-capable allowlist that still excludes `Bash(rm:*)`, `Bash(git push:*)`, `Bash(sudo:*)`, and `WebFetch` unless `config.allow_dangerous = true`.
5. Log every gate decision (transcript, classification, plan text, yes/no audio transcript, final result) to the session jsonl — this is the audit trail.
6. Add `--dry-run` global flag that stops after the plan phase, and a config `require_confirmation_always = true` escape hatch.

**Verify:** In a scratch git repo set as `project_dir`: say "hey jarvis, add a hello function to utils.py" → Jarvis speaks the plan and asks; say "no" → `git status` is clean. Repeat and say "yes" → `git diff` shows the new function. Then say "hey jarvis, what does utils.py do" → answered directly with no confirmation prompt. `pytest tests/test_gate.py` passes, including the adversarial rows.

---

### Phase 5: Daemonize, harden, and document
**Goal:** `hey-jarvis` runs as a user service at login, recovers from device/model errors, and has a README a stranger can follow on Linux or macOS.

**Files to create/modify:**
- `packaging/hey-jarvis.service` — systemd user unit (`Restart=always`, `After=pipewire.service`)
- `packaging/com.hey-jarvis.plist` — launchd agent for macOS parity
- `src/hey_jarvis/cli.py` — `install-service` / `uninstall-service`
- `src/hey_jarvis/session.py` — error recovery: reopen mic stream on `PortAudioError`, backoff on repeated failures, `pause`/`resume` via SIGUSR1
- `README.md` — install, config example, wake-word retraining pointer, security model section
- `.github/workflows/ci.yml` — ruff + pytest on 3.11/3.12
- `config.example.toml`

**Key steps:**
1. Wrap the main loop in a supervisor that catches and logs exceptions, speaks nothing on failure (avoid a talking loop), and restarts the audio stream after 2 s backoff.
2. Add a `mute` hotkey path: a named pipe at `~/.local/state/hey-jarvis/ctl` accepting `pause`, `resume`, `stop` so the user can silence it without killing the service.
3. Add `providers/realtime.py` stub with a `ConversationProvider` protocol (`transcribe`, `respond`) documenting where Gemini Live / OpenAI Realtime would slot in — the upstream-parity seam, not implemented.
4. README security section: what the allowlist blocks, that `acceptEdits` auto-applies edits inside `project_dir` only, and that anyone in earshot can issue commands (recommend running only on a trusted machine; note speaker-verification as future work).
5. `ruff check --fix`, `ruff format`, ensure `pytest` green offline (all tests must use fixtures, no live mic or live `claude`).

**Verify:** `systemctl --user enable --now hey-jarvis && systemctl --user status hey-jarvis` shows active; speak a command with no terminal open and it executes. `journalctl --user -u hey-jarvis -f` shows the stage log. `systemctl --user restart hey-jarvis` recovers within 5 s. CI green.

## Estimated Effort

**3 Claude Code sessions.**

- **Session 1 (Phases 1-2):** project scaffold under a pinned 3.12 venv, mic capture, openWakeWord wiring, model downloads, faster-whisper + piper round trip. Most of the wall-clock is model downloads and mic-device debugging on PipeWire.
- **Session 2 (Phases 3-4):** the `claude -p` stream-json runner, spoken-output contract, the plan/confirm/execute state machine, tool allowlists, gate classifier and its test table. This is the highest-value session and the one carrying the real design decisions.
- **Session 3 (Phase 5):** systemd/launchd packaging, error recovery, control pipe, README, CI, cleanup pass.

A fourth session would be needed for genuine polish: barge-in (stop TTS when the user speaks), multi-turn follow-ups without re-waking, and multi-project routing ("hey jarvis, in the budget app...").

## Potential Blockers

1. **Python version mismatch — near-certain.** System python here is 3.14.3. `onnxruntime`, `openwakeword`, `webrtcvad`, and `ctranslate2` (faster-whisper) do not reliably ship 3.14 wheels; `webrtcvad` in particular often needs a C build. Mitigation: pin `>=3.11,<3.13` and create the venv with `uv venv --python 3.12` (uv will fetch the interpreter). Neither `uv` nor `pipx` is installed — Phase 1 step zero is `curl -LsSf https://astral.sh/uv/install.sh | sh`. If `webrtcvad` still fails to build, swap to `silero-vad` ONNX which is pure-ONNX.
2. **`claude` is not on PATH in non-interactive shells.** `which claude` returns nothing in this environment's `/bin/sh`; it is likely a shell alias or under `~/.claude/local/`. A systemd unit inherits an even barer environment. Resolve and hard-code the absolute path in config, and have `doctor` fail loudly if it can't exec `claude --version`.
3. **Headless Claude Code auth in a systemd service.** `claude -p` needs a valid credential; under `systemd --user` it may not find `~/.claude/.credentials.json` or the keyring if `DBUS_SESSION_BUS_ADDRESS` is missing. Test Phase 3 under `systemd-run --user` early, not just in a terminal. Fallback: `Environment=ANTHROPIC_API_KEY=` from a `systemd-creds`/EnvironmentFile — but that bills API credits instead of using the subscription.
4. **Stream-json schema drift.** The exact `--output-format stream-json` event shape and the `--permission-mode` / `--allowedTools` flag names change between Claude Code releases. Do not code against memory: run `claude --help` and capture one real `stream-json` transcript to `tests/fixtures/stream.jsonl` at the start of Phase 3, and parse defensively (`event.get("type")`, tolerate unknown events).
5. **Wake-word false positives/negatives.** The bundled `hey_jarvis_v0.1` model is decent but threshold-sensitive and degrades with an open-plan mic or music playing. Budget time for tuning `wake_threshold` and add a `--wake-debug` mode printing per-frame scores. Retraining a custom model is out of MVP scope.
6. **Latency makes it feel bad.** Wake (instant) + record (2-5 s) + whisper `small.en` on CPU (1-3 s) + Claude (10-60 s) + TTS (1 s) means a 20-70 s round trip. Mitigations: `base.en` instead of `small.en`, immediate filler speech, and a periodic "still working" tick. If Claude latency dominates, that's inherent, not fixable — set expectations in the README.
7. **The gate can be talked around.** A keyword classifier will misclassify ("clean up this file" reads as read-only to a naive regex). This is why the classifier fails closed and why the plan-phase `FILES:` list is authoritative — the security boundary must be the CLI tool allowlist, not the classifier. Never run the read phase with write tools available.
8. **Self-triggering and open-mic risk.** TTS output can re-trigger the wake word, and anyone within earshot can drive Claude Code against the user's repo. Mute during playback; document the trust model; keep `project_dir` scoped to one directory with `--add-dir` rather than `$HOME`.
9. **Piper install friction.** `piper-tts` on PyPI has had packaging gaps on some Python versions; `espeak-ng` is also not installed here (`apt install espeak-ng`). Ship both and pick at runtime so a missing piper doesn't block Phase 2.

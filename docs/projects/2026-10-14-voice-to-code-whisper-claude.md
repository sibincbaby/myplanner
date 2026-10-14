# voice-to-code — Voice-Drive Claude Code with Local Whisper

**Source:** GitHub — https://github.com/duongntbk/voice-to-code  
**Tagline:** "Control your AI Agents like a boss. Free local speech recognition powered by Whisper. Speak commands naturally, watch them appear in your AI coding assistant."  
**Discovered:** 2026-10-14

---

## Why it fits

Claude Code, Codex, and Amp are all CLI agents — your primary interface is the keyboard. Switching hands from keyboard to mouse, or stopping to type a long prompt mid-flow, breaks concentration. voice-to-code solves this with a local Whisper transcription loop: hold a hotkey, speak, release, and the transcribed text lands directly in the active CLI agent's input. Everything runs offline, so prompts containing IP or credentials never touch an external speech API. The project already supports Claude Code, Amp, and any CLI-based agent.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Python daemon + local Whisper model + xdotool/pyautogui for keystroke injection — straightforward 1-session install and extension |
| fills_gap | 1 | No voice input exists in the current toolkit; typing long prompts is the main friction point during coding sessions |
| novel | 1 | Voice-to-agent-CLI is a novel interaction pattern; not a clone of mainstream speech tools |
| daily_utility | 1 | Every Claude Code session benefits from hands-free prompt entry, especially for dictating multi-sentence context |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **faster-whisper** (Python, CTranslate2 backend) — lowest latency local transcription; `tiny.en` model is fast enough for real-time
- **sounddevice** — cross-platform audio capture without PulseAudio dependency
- **pynput** (global hotkey) — hold-to-record via configurable key combo
- **pyperclip + xdotool (Linux) / pbpaste (Mac)** — paste transcribed text at cursor
- Claude Code, Amp, or any CLI agent running in a terminal

No cloud services, no subscriptions; runs fully offline once Whisper model is downloaded (~75 MB for `tiny.en`).

## MVP Scope

1. Install faster-whisper and sounddevice
2. Daemon: hold `Ctrl+Shift+Space` → record audio → release → transcribe → paste into foreground terminal
3. Test with Claude Code: dictate a multi-sentence task description and verify it appears correctly

Not in MVP: wake-word activation, multi-language support, noise cancellation, GUI.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Clone voice-to-code; read README; install dependencies (`pip install faster-whisper sounddevice pynput pyperclip`) | 20 min |
| 2 | Extend or adapt the daemon: confirm hotkey binding, verify paste target is the correct terminal window | 30 min |
| 3 | Test with Claude Code on a real task: dictate a bug description, then a multi-step refactor request | 1 h |
| 4 | Test with Amp or OpenCode to confirm agent-agnostic behaviour | 30 min |
| 5 | Tune: switch to `base.en` model if accuracy insufficient; add configurable hotkey via `~/.voice-to-code/config.toml` | 30 min |

**Total estimate:** ~2.5 h (1 Claude session)

## Blockers

- Audio capture may need PulseAudio/ALSA device selection on Linux — test with a quick `sounddevice` snippet first
- `xdotool` (Linux) or `pyautogui` (Mac) must be installed for keystroke injection; Wayland may require alternatives
- First run downloads the Whisper model (~75–145 MB depending on size); needs outbound HTTPS once
- If the terminal emulator intercepts the hotkey before the daemon, rebind to a less-colliding combo

## References

- GitHub: https://github.com/duongntbk/voice-to-code
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- HN context: Claude Code official voice mode (push-to-hold spacebar) is in 5 % rollout as of March 2026; this project provides an offline, agent-agnostic alternative

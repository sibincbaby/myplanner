# speakoflow — Offline Voice Dictation + Claude Screen-Reply Tool

**Source:** [AbhishekBarali/SpeakoFlow](https://github.com/AbhishekBarali/SpeakoFlow) · Product Hunt Aug 6 2026 (105 votes, open-source launch)  
**Language:** Python 3.11+ (upstream) · Plan: same stack, personal build  
**License:** MIT  
**Date discovered:** 2026-08-08

## What it is

SpeakoFlow is a free, open-source voice dictation + AI assistant for Windows, macOS, and Linux. Press a global hotkey → speak → your words are typed into whatever app is focused, entirely offline via faster-whisper. Say "Hey Flow" and it turns your voice into a finished reply or email based on what's on your screen. A floating chat panel lets you voice-chat with any LLM and hear replies read back. Everything is on-device; the AI layer accepts your own API key or a local model server.

**Why it matters:** Wispr Flow ($17/mo, macOS only) and SuperWhisper ($99 lifetime, macOS only) fill this space commercially. SpeakoFlow brings the same feature set to Linux/Windows, fully offline and open-source. The screen-vision "Hey Flow" mode — grabbing screen context to generate contextual replies — is not present in any other OSS voice tool.

## Why it fits

- Core interest: **dev productivity / voice tools** — replace keyboard for dictating notes, commit messages, PR descriptions, diary entries
- Core interest: **Claude/LLM tooling** — plugs directly into the Claude API for AI replies; your own key, no middleman
- `daily_utility = 1`: replaces typing in any app — notes, Slack, email, terminal commands
- `novel = 1`: screen-aware + fully offline + cross-platform is a unique combination among OSS voice tools

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | faster-whisper + pynput hotkey + text injection = one focused Claude session |
| fills_gap | 1 | Voice diary and logging tools are in scope; nothing voice-first in the backlog |
| novel | 1 | Offline + screen-aware + open-source combination not present in any OSS tool seen so far |
| daily_utility | 1 | Dictation into any focused app replaces keyboard for notes, commits, code comments daily |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Speech-to-text:  faster-whisper (local, GPU optional) — Whisper large-v3-turbo for accuracy
Audio capture:   sounddevice + soundfile (cross-platform, no PortAudio wrapper needed)
Global hotkey:   pynput (Linux/macOS/Windows)
Text injection:  pyautogui (cross-platform) or xdotool (Linux, more reliable in Wayland)
Screen capture:  mss (fast cross-platform screengrab for "Hey Flow" mode)
AI reply:        anthropic SDK → claude-sonnet-5 (or local via ollama HTTP)
Status overlay:  tkinter floating topmost window (no extra dep, ships with Python)
Config:          TOML file at ~/.speakoflow/config.toml
```

## MVP Scope (1 Claude session)

1. `record.py` — press-and-hold hotkey (`Ctrl+Shift+V`) to record audio via sounddevice; release to stop; save to temp WAV
2. `transcribe.py` — load faster-whisper `small` model (250 MB); transcribe WAV; return text string
3. `inject.py` — type transcribed text into the currently focused window via pyautogui
4. `overlay.py` — small `tkinter` Toplevel window in bottom-right corner; shows "● Recording" / "⏳ Transcribing" / "✓ Done" states
5. `main.py` — orchestrate the above; config via `~/.speakoflow/config.toml` (model size, hotkey, inject method)

**"Hey Flow" mode (second session):** capture screen with `mss`, OCR visible text with pytesseract, prepend screen context to voice transcript, send to Claude API, type AI reply.

## Phases

### Phase 1: Core Dictation Engine (2-3h)
- Record audio on hotkey hold, release to stop (sounddevice `InputStream` in a thread)
- Transcribe with faster-whisper `small` (auto-download on first run)
- Inject text into active window via `pyautogui.typewrite(text, interval=0.01)`
- Minimal status: print to terminal (`● Recording…`, `⏳ Transcribing…`, `✓ Done`)
- Verify: hold hotkey, say "hello world", release — "hello world" appears in a text editor

### Phase 2: Status Overlay + Hotkey Config (1-2h)
- `tkinter` Toplevel with `wm_attributes('-topmost', True)` and no title bar
- States: idle (hidden), recording (red dot + timer), transcribing (spinner), done (green flash then hide)
- `config.toml`: `[audio] hotkey = "ctrl+shift+v"`, `[model] size = "small"`, `[inject] method = "pyautogui"`
- Linux path: detect Wayland vs X11, swap to `ydotool` or `xdotool` accordingly
- Verify: run on startup, overlay appears on hotkey press with correct state transitions

### Phase 3: Hey Flow — Screen-Aware AI Reply (2-3h)
- "Hey Flow" trigger phrase: detected by STT before typing; if transcript starts with "hey flow", enter AI reply mode instead of injection
- Capture screen with `mss.mss().grab(monitor=1)` → PIL Image → pytesseract OCR → 500-char context snippet
- Build Claude prompt: `system: "Reply in the context shown. Be concise."` + `user: screen_text + voice_query`
- Stream reply via `anthropic.Anthropic().messages.stream()`; type each chunk as it arrives
- Token cost logged to `~/.speakoflow/usage.jsonl`
- Verify: open a Gmail compose window, hold hotkey, say "hey flow reply professionally declining this meeting", release — Claude types a reply

### Phase 4: Floating Chat Panel (2h)
- Second hotkey (`Ctrl+Shift+C`) opens a `tkinter` Toplevel panel (400×600, always-on-top)
- Text input + voice input button; message history displayed; TTS reply via `pyttsx3` (offline)
- Claude conversation history maintained in-session (list of `{role, content}` dicts)
- Verify: ask three follow-up questions in the panel; context carries across turns

### Phase 5: Config UI + Startup (1h)
- `python -m speakoflow --setup` opens a `tkinter` settings dialog (hotkeys, model size, API key)
- System tray icon via `pystray` (macOS/Windows/Linux); right-click menu for quit, settings, usage stats
- Linux: `~/.config/autostart/speakoflow.desktop` written by setup; macOS: LaunchAgent plist
- Verify: add to startup, reboot, confirm tray icon appears without terminal

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Core Dictation Engine | 2-3h |
| Status Overlay + Config | 1-2h |
| Hey Flow Screen Reply | 2-3h |
| Floating Chat Panel | 2h |
| Config UI + Startup | 1h |
| **Total** | **8-11h (~1-2 weekends)** |

Phase 1 alone delivers working offline dictation in **2-3h (one session)**.

## Blockers / Risks

- Wayland (modern Linux desktops) blocks global keystroke listeners by default; need either `ydotool` (root daemon) or a portal-based alternative — test on target OS first, document the fallback
- faster-whisper `small` model is 250 MB and `large-v3-turbo` is ~1.6 GB; offer `small` as default with a CLI flag to upgrade
- `pyautogui.typewrite` is slow for long texts (character-by-character); use `pyperclip.copy()` + `Ctrl+V` for texts longer than 100 characters
- Screen OCR via pytesseract is CPU-heavy and adds ~2s latency; make "Hey Flow" mode opt-in, not the default path
- macOS Accessibility permissions are required for text injection — the setup script should open System Preferences → Accessibility and wait for the user to grant permission before continuing

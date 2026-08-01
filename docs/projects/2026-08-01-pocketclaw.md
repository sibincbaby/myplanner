# PocketClaw

> A mobile-first Progressive Web App that lets you connect to running Claude Code sessions remotely — push-to-talk, view agent output, and issue commands from your phone or tablet without touching a laptop.

**Inspired by:** [OpenClawAndroid/openclaw-android-assistant](https://github.com/OpenClawAndroid/openclaw-android-assistant)  
**Date discovered:** 2026-08-01

---

## What gap it fills

AnyClaw bundles an entire Linux userland into a 73MB Android APK — a remarkable feat but overkill for most users who already have Claude Code running on a dev machine. The real gap: there is no clean, installable mobile interface to *control* an existing Claude Code session from your phone. You pick up your phone, you can't easily see what the agent is doing or interrupt/redirect it without going back to the laptop.

PocketClaw is a lightweight PWA (installable on iOS + Android, no app store needed) that connects via WebSocket to a tiny local relay server running alongside Claude Code. You see the live output stream, can type or speak commands, and can approve/deny tool-use requests — all from a mobile browser. It mirrors what AnyClaw does with embedded Linux but achieves it in a single-evening build: a relay server + a clean mobile UI.

Viability score: **4/4** (weekend_buildable ✅, fills_gap ✅, novel ✅, daily_utility ✅)

---

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Relay server | Node.js + ws + `claude` CLI subprocess | Spawns/attaches to Claude Code, streams stdout over WebSocket |
| Auth | TOTP or a shared secret in localStorage | Simple enough for personal use; no OAuth overhead |
| PWA shell | Vite + vanilla JS + Service Worker | Installable, no framework overhead; target <50KB total |
| UI | TailwindCSS + terminal-style monospace view | Matches agent output naturally; easy to scroll |
| Voice input | Web Speech API (browser STT) | Zero deps; works on Chrome Android and Safari iOS |
| Push to approve | Native Web Notifications API | Relay pings phone when agent requests tool approval |

---

## MVP scope (1-2 Claude sessions)

**Session 1 — Relay + live output:**
- `relay.js`: Node.js script that spawns `claude` (or attaches to an existing tmux pane via `tmux pipe-pane`), reads stdout line by line, and broadcasts over WebSocket on port 7891
- Basic auth: relay checks a `?token=` query param against env var `POCKETCLAW_TOKEN`
- PWA: single HTML file with a terminal-style scrollable output pane and a text input
- Install prompt: valid `manifest.json` + service worker so iOS/Android "Add to Home Screen" works
- Test: open from phone browser, see Claude Code output in real time; type a message; see it arrive

**Session 2 — Voice + approval flow:**
- Add push-to-talk button: hold → browser STT → release sends recognized text to relay → relay pipes to Claude Code stdin
- Approval pings: relay detects `[tool:bash]` pattern in Claude Code output and sends a Web Notification; tap to approve/deny which relay translates to Enter/Ctrl+C
- `pocketclaw` CLI wrapper: `pocketclaw start` runs relay in background, prints QR code of LAN URL + token
- Auto-reconnect: PWA reconnects with exponential backoff on WebSocket drop

---

## 3-Phase roadmap

### Phase 1 — Live view + text input (Session 1)
WebSocket relay alongside Claude Code. PWA installable shell with real-time output and text command box. TOTP or shared-secret auth. QR-code URL generator so setup takes 10 seconds.

### Phase 2 — Voice + approval (Session 2)
Push-to-talk via Web Speech API. Tool-approval notification flow. Auto-reconnect. Session log that persists across connections so you can scroll up on your phone.

### Phase 3 — Multi-session + MCP
Support multiple named tmux sessions selectable from a session switcher. Optional MCP tool panel showing available tools and their last call time. Encrypted relay tunnel via ngrok/cloudflared for access outside LAN.

---

## Effort estimate

| Phase | Effort | Output |
|-------|--------|--------|
| Phase 1 | 1 Claude session (~75 min) | Working relay + installable PWA with live output + text input |
| Phase 2 | 1 Claude session (~90 min) | Voice input + approval flow + auto-reconnect |
| Phase 3 | 1 Claude session (~60 min) | Multi-session switcher + MCP tool panel |

Total: **3 sessions, ~4 hours elapsed**

---

## Blockers / watch-outs

- **stdin piping**: Claude Code reads stdin interactively; the relay must write to the correct pty, not just the process stdin, or keystrokes won't be seen. Use `node-pty` instead of `child_process.spawn` to create a proper pseudo-terminal.
- **iOS Web Speech**: Safari's Web Speech API requires a user gesture per recognition session — push-to-talk (hold button → start recognition → release → stop) is the right UX pattern for this.
- **LAN-only default**: Keep the relay on localhost:7891 by default; Phase 3 adds tunneling. Don't expose without auth.
- **tmux attach vs spawn**: Attaching to an existing tmux pane (`tmux pipe-pane`) is more robust than spawning a new Claude Code process — it lets you pre-configure the session and reconnect without losing context.

---

## Why now

AnyClaw's 483-star traction proves demand for mobile AI coding access is real, but its embedded-Linux complexity is unnecessary for users already running Claude Code on a machine. PWA technology in 2026 (reliable Web Speech API on iOS, Web Notifications, installable home screen apps) finally makes a lightweight relay + mobile shell competitive with a native app — and the relay pattern means PocketClaw works with Claude Code, Gemini CLI, or any other terminal-based agent without modification.

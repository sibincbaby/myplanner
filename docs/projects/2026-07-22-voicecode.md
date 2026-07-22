# VoiceCode

> Hands-free voice control for Claude Code: speak commands and prompts in a browser tab, hear optional spoken replies — no downloads, no API keys

**Inspired by:** [mcp-voice-hooks](https://github.com/johnmatthewtennant/mcp-voice-hooks) (119 ★)  
**Date discovered:** 2026-07-22

---

## What gap it fills

Claude Code is keyboard-only. When you're whiteboarding, cooking, or your hands are full you can't give it instructions or course-correct. VoiceCode runs a tiny local Node.js server, opens a browser tab with the Web Speech API, and pipes your spoken words into Claude Code's stdin — so you can say "add unit tests for the auth module" and Claude starts working. Optional TTS reads back the first sentence of Claude's response. Nothing leaves your machine.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Server | Node.js + Express | Tiny footprint; SSE for browser → server push |
| Protocol | Named pipe / Claude Code stdin injection via PTY | No Claude Code API needed |
| STT | Browser Web Speech API | Zero install; works in Chrome and Safari |
| TTS (optional) | macOS `say` via server endpoint | Instant; no model download |
| HTTPS | Self-signed cert via `mkcert` | Required for Web Speech API on non-localhost |

## MVP scope (1 Claude session)

Two components that combine into a working system:
1. **Server** (`voicecode.js`): Express + an SSE stream endpoint; receives POST of transcribed text, writes it to Claude Code via a named pipe or a spawned PTY session
2. **Browser page** (`index.html`): Web Speech continuous listening, sends final transcript segments to server, optional TTS for server-pushed replies

Total code: ~150 lines. Run `node voicecode.js` and open `http://localhost:3000`.

Out of scope for MVP: trigger-word filtering, multi-session routing, mobile UI.

## Phases

### Phase 1 — Server skeleton (1 h)
- Express server on port 3000
- `POST /speak` — receives `{text: "..."}`, writes to stdout (test mode first)
- `GET /events` — SSE stream for browser to receive replies
- Static `index.html` served at root

### Phase 2 — Browser STT (0.5 h)
- `SpeechRecognition` API with `continuous: true`, `interimResults: false`
- On `onresult`: POST final transcript to `/speak`
- Status indicator: Listening / Processing / Idle

### Phase 3 — Claude Code PTY injection (1 h)
- Spawn Claude Code in a PTY using `node-pty`
- Write transcribed text to PTY stdin followed by Enter
- Capture PTY stdout lines and push via SSE to browser

### Phase 4 — Trigger word mode (0.5 h)
- Config: `TRIGGER_WORD=hey` — only send text that starts with the trigger word (stripped before forwarding)
- Allows background listening without sending every utterance

### Phase 5 — TTS reply (0.5 h)
- Intercept first Claude response paragraph from PTY
- `exec("say -r 175 '" + escaped + "'")` on macOS
- Config: `TTS_ENABLED=true` in `.env`

## Effort estimate

~2.5 hours for Phases 1–3 (MVP) · 1 Claude session  
~3.5 hours complete

## Blockers / risks

- **Web Speech API**: Chrome requires HTTPS for non-localhost origins; accessing from phone/tablet needs a self-signed cert. Mitigation: `mkcert localhost` generates a trusted local cert in 30 seconds.
- **PTY control chars**: Claude Code's TUI uses ANSI sequences that pollute captured output. Mitigation: strip ANSI with a regex before forwarding to browser/TTS.
- **Latency**: Web Speech API final results have ~500ms delay. Mitigation: send interim results to show a "typing" indicator without acting on them.

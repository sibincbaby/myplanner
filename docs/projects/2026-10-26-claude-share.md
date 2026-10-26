# claude-share — Multiplayer Live Sessions for Claude Code

**Source:** [Paradigm-Study/claude-share](https://github.com/Paradigm-Study/claude-share) (MIT, TypeScript)  
**Tagline:** "Share a link. Another person joins your Claude Code session live."  
**Discovered:** 2026-10-26 (cloud backup)

---

## Why it fits

Claude Code runs in one terminal for one person. There's no built-in way to let a colleague see what the agent is doing in real time, or to hand off a live session. claude-share (and the related ccshare project) fix that: wrap your terminal session in a real PTY, generate a shareable code, and anyone with the code can watch or interact with the same Claude Code session.

The user profile calls out **Claude/LLM tooling** and **Agent UIs**. The ability to share a live Claude Code session is a direct enhancement to both: it enables pair-programming with an AI agent, async review of what an agent is doing, and handoffs without losing session context.

A GitHub issue on the official Anthropic/claude-code repo confirms there's no native real-time multi-user session — this is a genuine gap.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| Weekend-buildable | ✅ | A PTY wrapper with a WebSocket relay server is a realistic 1-2 session MVP. The simplest version (read-only viewer) is even smaller. |
| Fills gap | ✅ | No session-sharing tool for Claude Code in seen.json. |
| Novel | ✅ | Live shared CLI sessions specifically for AI agent sessions is a new concept in seen.json. |
| Daily utility | ❌ | Only useful during collaboration sessions — not an every-day tool for solo work. |

**Total: 3/4**

## Shape

**Two paths:**

**A — Adopt upstream:** Clone claude-share or ccshare, self-host the relay (a small Node WebSocket server), and use it whenever you want to share a session.

**B — Build a minimal version:** The core is ~200 lines: fork a PTY, pipe its stdout to a WebSocket, and serve a read-only terminal viewer in the browser. This is a fun weekend project that you'd understand completely.

## Stack

- Node.js / TypeScript
- `node-pty` (PTY forking)
- WebSocket (`ws` or Socket.io for the relay)
- `xterm.js` (browser terminal rendering for the viewer)
- Optional: session codes via nanoid, no auth needed for MVP

## MVP scope (Option B — build)

1. Fork a Claude Code process inside a PTY using `node-pty`.
2. Pipe PTY stdout to a WebSocket server (`ws`).
3. Generate a 6-char session code; anyone who connects with that code gets a read-only WebSocket feed.
4. Serve a one-page browser viewer using `xterm.js` that renders the feed.
5. Test: start Claude Code in the PTY, open the viewer URL in a second browser tab — both should show the same output.

## Phases

1. **PTY proof of concept (1 h).** Spawn any shell in `node-pty`, print its output to the console. Confirm the PTY survives Ctrl-C from the wrapped process.
2. **WebSocket relay (1 h).** Pipe PTY stdout to a WebSocket broadcast. Test with `wscat` or a raw browser WebSocket.
3. **xterm.js viewer (1 h).** Serve an HTML page that connects to the WebSocket and renders output in an xterm.js terminal. Confirm resize events propagate.
4. **Session codes (30 min).** Generate a code at start; reject connections with wrong codes.
5. **(Later) Bidirectional input.** Allow the viewer to send keystrokes back (turns read-only into collaborative).
6. **(Later) Replay.** Buffer the full PTY log and let new joiners replay from the start.

## Effort

~3.5 h to a working read-only session viewer. ~2 h more for bidirectional input.

## Blockers / risks

- **NAT/firewall:** If both parties are behind NAT, the relay server needs to be reachable by both (a free Fly.io deploy or Cloudflare Tunnel handles this).
- **Security:** The session code is the only auth. For sensitive work, add a short-lived token and HTTPS. Don't deploy the relay on a public IP without this.
- **PTY window size:** xterm.js will need to tell the PTY its terminal dimensions; if this is wrong, line-wrapping in Claude Code's output will be off. Wire up a `SIGWINCH` on resize.

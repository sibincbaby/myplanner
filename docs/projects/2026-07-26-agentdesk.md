# AgentDesk

> A pixel-art walkable office where each AI coding agent gets a desk — walk up, chat, watch the terminal, hire and fire — instead of juggling tabs

**Inspired by:** [ChristianFJung/AIOffice](https://github.com/ChristianFJung/AIOffice) (GitHub trending July 26 2026, 24★)  
**Date discovered:** 2026-07-26

---

## What gap it fills

Running more than two or three parallel Claude Code or Codex agents in terminals turns into tab soup: you lose track of which agent is working on what, and switching context kills focus. AIOffice proves the idea: give each agent a desk in a persistent visual space, so you can glance at the office and know the state at a glance, then walk up when you want to interact. The user already has Herdr (terminal multiplexer) in their collection, but Herdr is text-first. AgentDesk adds a *spatial* mental model — rooms, desks, status indicators, NPC-style chat — that Herdr's pane layout can't replicate. It's also directly inspectable: you can read the agent's live terminal output without switching to a separate window.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Game canvas | Phaser 3 (TypeScript) | Proven tile-map engine, runs in browser or Electron, good PTY-over-WebSocket examples |
| Backend | Node.js + Express + ws | Lightweight; node-pty works natively on macOS/Linux |
| PTY | node-pty | Spawns Claude Code (or any CLI agent) as a real TTY, captures live output |
| Agent process | Claude Code CLI | `claude` already handles auth, tools, and conversation |
| Tile art | Kenney.nl CC0 office tileset | Free, pixel-art office tiles ready to drop in |
| Packaging | Vite + Electron (optional) | Browser-first for MVP; Electron adds desktop launch later |

## MVP scope (1-2 Claude sessions)

A browser app that:

1. Displays a 20×15 tile office with 3 agent desks
2. Player character moves with arrow keys / WASD
3. Walking near a desk opens a chat panel for that agent
4. Each agent runs as a real `claude` (or `codex`) subprocess via node-pty
5. Chat panel shows the conversation + a scrollable terminal view of live PTY output
6. "Hire" button spawns a new agent on an empty desk; "Fire" kills the process
7. Agent status badge (idle / thinking / waiting for input) on each desk tile

Out of scope for MVP: multiple rooms, saving session state across restarts, drag-and-drop desk layout.

## Phases

### Phase 1 — Canvas + movement (1.5 h)
- Vite + TypeScript project; install Phaser 3
- Load a CC0 office tilemap (Tiled JSON format); render floor, walls, desks
- Player sprite (16×16) walks with arrow keys; collision on walls and desks
- Proximity detection: when player enters a 2-tile radius of a desk, emit a `desk:focus` event

### Phase 2 — Agent spawning (1.5 h)
- Express server at `localhost:3001` with a `ws` WebSocket server
- `POST /agents` — spawns `claude` (or configurable binary) via node-pty, stores `{id, pid, pty}`
- WebSocket channel per agent: streams PTY output to connected browser tabs
- `DELETE /agents/:id` — kills the pty process
- In-memory map: `deskId → agentId`

### Phase 3 — Chat UI (1 h)
- On `desk:focus`, open a right-side panel (HTML overlay, not canvas)
- Panel: conversation history (user / agent turns), text input, Send button
- Sending a message writes `\n<message>\n` to the agent's PTY stdin
- Terminal sub-panel below chat: scrollable ANSI-rendered PTY output (use `xterm.js`)

### Phase 4 — Status badges (45 min)
- Parse PTY output stream for known Claude Code prompts (`?`, `>`, `✓`) to infer state
- Overlay a coloured badge on each desk tile: green (idle), amber (thinking), blue (waiting input)
- Badge updates in real-time via WebSocket broadcast

### Phase 5 — Hire/Fire UI (30 min)
- Empty desks show a "+" tile; click spawns a new agent (`POST /agents` with deskId)
- Occupied desks show agent name + a context-menu "Fire" option that calls `DELETE /agents/:id`
- On fire, desk reverts to empty tile and badge disappears

## Effort estimate

~5 hours Phases 1–3 (playable MVP) · 1 Claude session  
~7 hours complete with status badges and hire/fire

## Blockers / risks

- **node-pty platform support**: Works on macOS and Linux out of the box; Windows requires Visual C++ Build Tools. Mitigation: document macOS/Linux as primary targets for MVP.
- **Claude Code auth inside PTY**: `claude` reads its credentials from `~/.claude`; make sure the spawned process inherits the parent env. Mitigation: pass `env: process.env` to node-pty.
- **ANSI rendering in browser**: Raw PTY output includes control codes. Mitigation: xterm.js handles this natively; attach the FitAddon so the terminal panel fills the container.
- **Overlap with Herdr**: AgentDesk is for *visual spatial management*, not deep pane layouts. Keep the scope distinctly gamified — Herdr can still be the power-user tool.

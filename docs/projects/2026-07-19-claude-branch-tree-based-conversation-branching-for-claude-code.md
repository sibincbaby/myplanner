# claude-branch — tree-based conversation branching for Claude Code

**Source:** <https://github.com/juggler-ai/juggler>
**Discovered:** 2026-07-19
**Viability:** 4/4

> Seeded by *Juggler* (Show HN, 486★, v0.4.2 July 18 2026) — a Go+Wails GUI coding agent where conversations form branching trees instead of linear transcripts, and you can navigate, edit, and fork any node. The build target here is a focused subset: a lightweight local web UI that reads Claude Code's existing session/conversation files, renders them as a navigable tree, and lets you fork at any message — creating parallel exploration paths without losing the original context thread. No new agent runtime, no collaboration, no sync — just the branching layer on top of what you already have.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

Claude Code sessions are linear: once you redirect the conversation you lose the previous thread. Branching from a specific message to explore an alternative approach — without clobbering the prior context — has no solution in the current toolkit. Juggler proves the concept is real demand (486★ in days, HN front page), and its AGPL license plus Go/Wails stack makes it impractical to adopt directly. A React + local-filesystem reader MVP is a clear 1–2 session build (the session file format is stable JSON, the tree renderer is a solved UI problem). The UI lives entirely in your browser against `localhost` — no server needed beyond a tiny file-watch proxy. Every session involving exploration (trying different refactor approaches, debugging with multiple theories, writing variations) directly benefits. 4/4, viable.

---

## Implementation Plan

## Overview

A local single-page application that parses Claude Code's conversation history from `~/.claude/` (or a project `.claude/` dir), renders it as a branching tree using a React force-directed graph, and writes new "fork" nodes by cloning the session file up to the chosen message and writing it as a new session. The user opens `http://localhost:3731` from the terminal, sees all active sessions as a forest, clicks any message node to fork, and Claude Code picks up the new session naturally.

The MVP is read + fork: **render sessions as tree → click to fork → new session file written → open in Claude Code**. No sync, no collaboration, no server, no native shell — just a file-watcher proxy and a React UI.

## Stack Recommendation

- **Backend: Node 20 + `@modelcontextprotocol/sdk` (or plain `express` + `chokidar`)** — a tiny file-watch server (single file) that watches `~/.claude/sessions/` and serves session JSON over WebSocket. No framework needed beyond what's standard; `chokidar` for watch, `ws` for WebSocket. Single binary, zero config.
- **Frontend: React 18 + `react-d3-tree` (or `elkjs` + custom SVG)** — renders the conversation forest. Each node is a message; edges are parent→child. `react-d3-tree` handles pan/zoom/click interactions and is a 1-import drop-in.
- **Fork operation: Node `fs.copyFileSync` + JSON splice** — reads the source session JSON, trims messages after the fork point, writes to a new UUID-named session file. Claude Code discovers it on next `--resume` or session browser open.
- **No Electron.** Pure browser + localhost. Keeps the install surface to `npx claude-branch` or a one-liner npm global install.

## MVP Scope

In:
- Parse Claude Code session JSON files from `~/.claude/sessions/` (or a configurable path).
- Render the conversation forest as a zoomable tree: each session is a root, each message is a node, children are follow-up messages in the same thread.
- Fork action: click a message node → "Fork here" button → new session file written with messages up to that point, opened in the browser's active session list.
- Auto-refresh via WebSocket when session files change on disk.
- Single-command start: `npx claude-branch` or `claude-branch` if installed globally.

Out (later): edit message content in the UI, sync across machines, multi-user collaboration, Claude Code MCP integration (auto-open forked session), visual diff between branches, session tagging and search.

## Implementation Phases

### Phase 1: File reader + session model
**Goal:** Parse Claude Code session files into a typed tree structure the frontend can consume.
**Files to create/modify:**
- `server/sessions.js` — scan `~/.claude/sessions/*.json`, parse each into `{ id, messages: [{id, role, content, ts, parentId}] }`. The parentId chain is implicit in message order; infer it from `conversationId` fields if present, else by position.
- `server/watcher.js` — `chokidar` watch on the sessions dir; emit `sessionChanged` events over WebSocket.
- `server/index.js` — express app: `GET /sessions` returns the parsed forest JSON; WebSocket server pushes updates.
**Key steps:**
1. Locate the sessions directory (`~/.claude/sessions/` default, `CLAUDE_BRANCH_DIR` env override).
2. Parse each `.json` file; skip malformed with a console warning (never crash on a corrupt file).
3. Serve the forest over HTTP and push delta updates over WS.
**Verify:** `curl http://localhost:3731/sessions` returns a JSON array with at least the current open session's messages.

### Phase 2: Tree UI
**Goal:** The browser renders sessions as interactive trees.
**Files to create/modify:**
- `client/App.jsx` — main component: fetches `/sessions`, subscribes to WS, renders a `<Forest>` list.
- `client/Forest.jsx` — one `<Tree>` per session root, side-by-side horizontally scrollable.
- `client/Tree.jsx` — wraps `react-d3-tree`; custom node renderer showing role icon + content preview.
- `client/useSessions.js` — hook: fetch on mount, update on WS push.
- `client/index.html` + `vite.config.js` — Vite SPA, dev proxy to port 3731.
**Key steps:**
1. Map the session model to `react-d3-tree`'s `{ name, children }` format: message content (first 40 chars) as name.
2. Colour-code nodes by role (user = blue, assistant = green, tool = amber).
3. Show a tooltip with full content on hover; keep the node label short.
**Verify:** Opening the browser shows the current Claude Code session as a tree; adding a message in Claude Code (while the watcher runs) causes the tree to update within 1 second.

### Phase 3: Fork action
**Goal:** Clicking a node and pressing "Fork" creates a new session branching from that point.
**Files to create/modify:**
- `server/fork.js` — `POST /fork { sessionId, messageIndex }`: read source session, slice messages to index, write new session file as `<uuid>.json` in the sessions dir, return new session ID.
- `client/NodeActions.jsx` — overlay on selected node: "Fork here" button calls `POST /fork`, then highlights the new session in the forest.
- `client/ForkLine.jsx` — draw a dashed edge from the fork point to the new session root (visual lineage).
**Key steps:**
1. New session file must have a fresh UUID and no `conversationId` collision.
2. Cloned messages get their original timestamps preserved; the fork node itself is not duplicated — the new session starts with messages `0..forkIndex` and the next user turn is unwritten.
3. After fork, the UI selects the new tree and scrolls it into view.
**Verify:** Fork a session at message 3; confirm a new session file appears containing exactly messages 0–3; Claude Code can open that session with `--resume <new-id>`; the fork edge appears in the UI.

### Phase 4: Polish + install UX
**Goal:** `npx claude-branch` works out of the box on a fresh machine, no config needed.
**Files to create/modify:**
- `bin/claude-branch.js` — CLI entry: start server on port 3731, open browser automatically (`open` npm package), print session dir path on start.
- `package.json` — `"bin": { "claude-branch": "./bin/claude-branch.js" }`, `"files"` to exclude dev sources from the npm pack.
- `README.md` — install one-liner, screenshot of the tree UI, one-sentence explanation of what fork does.
**Key steps:**
1. Auto-detect sessions dir: try `~/.claude/sessions/`, then `$(pwd)/.claude/sessions/`, then prompt for path.
2. Fail gracefully if no sessions found: show an empty-state message with the detected path so the user knows where to look.
3. Bundle the React SPA into `dist/` so the npm package is self-contained — no separate frontend install step.
**Verify:** `npm pack && npm install -g <tarball> && claude-branch` on a clean env opens the browser and shows sessions without any additional setup.

## Estimated Effort

**1–2 Claude Code sessions.**
- **Session 1:** Phases 1–2 — file reader, WebSocket watcher, React tree renderer (the core data pipeline and visual layer).
- **Session 2:** Phases 3–4 — fork operation, fork-edge visualization, npm packaging and zero-config startup (the interactivity and distribution layer).

## Potential Blockers

- **Session file format stability.** Claude Code's session JSON schema is not a public contract; a minor CC update could change field names. Read defensively: try `conversationId`, `messages`, `turns` as alternate keys; log a warning (not an error) if a field is missing. Keep the parser in one module so a format change is a single fix.
- **React-d3-tree performance on long sessions.** Very long sessions (500+ messages) can make force-directed layout sluggish. Cap the visible depth at 10 levels by default (with a "show more" toggle); render truncated node labels. The full content is always in the tooltip on hover.
- **Fork UUID collision.** Session files are identified by UUID; a collision would overwrite an existing session. Use `crypto.randomUUID()` (Node 20 built-in) and verify the file does not exist before writing.
- **Cross-platform session paths.** On Windows, `~` expansion and path separators differ. Use `os.homedir()` and `path.join` everywhere — never string-concatenate paths.
- **Read-only vs. writable sessions.** Some session files may be open and locked by Claude Code on Windows. The fork write can fail silently; always return a clear error from `POST /fork` and surface it in the UI rather than silently writing a partial file.

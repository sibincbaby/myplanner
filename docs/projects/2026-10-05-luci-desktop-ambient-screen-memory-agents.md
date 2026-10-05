# LUCI Desktop — Ambient Screen Memory MCP for AI Agents

**Source:** <https://luci.memories.ai/desktop>
**Discovered:** 2026-10-05
**Viability:** 4/4

> LUCI records your screen and meetings, stores the history locally, and exposes an MCP server so Claude Code, Codex, and Cursor can query what you were doing — across sessions and across tools — without the data leaving your device.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

LUCI Desktop (the commercial app) is polished and free. The personal build is still worth doing: full ownership of the SQLite schema, capture rate, which sessions are indexed, and the shape of the MCP tools. The core loop — periodic screenshot → Claude Haiku description → FTS5 index → MCP server — is roughly 200 lines of TypeScript and 2 Claude sessions. Existing memory MCPs (Dokoro, Vault, claude-mem) store what you *typed*; LUCI stores what you *saw*. No open-source equivalent does ambient screen → MCP.

---

## Implementation Plan

**2 Claude Code sessions** to an always-on screen-capture daemon with 3 MCP tools registered in `~/.claude/settings.json`.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (Node.js 22) | MCP SDK is TS-first; screenshot-desktop has TS types |
| Screen capture | `screenshot-desktop` | Cross-platform (macOS, Windows, Linux) npm package |
| Image description | Claude Haiku (`claude-haiku-4-5`) | Fast + cheap; 1 screenshot ≈ 100–200 tokens |
| Storage | SQLite + FTS5 | BM25 search, no extra infra |
| MCP server | `@modelcontextprotocol/sdk` | stdio transport, registered in settings.json |
| Diff detection | pixel-hash comparison | Skip capture when screen unchanged (>95% pixel similarity) |

---

## MVP Scope

MCP tools exposed:
- `search_memory(query, limit=5)` — FTS5 BM25 search over screen descriptions; returns `{timestamp, description, appName}[]`
- `recent_context(minutes=30)` — returns the last N minutes of screen activity as a timeline
- `session_timeline(date)` — returns the day's captured moments grouped by hour

Daemon:
- Captures every 30 s (configurable via `LUCI_INTERVAL_SECS`)
- Sends screenshot to Haiku with prompt "Describe what is on this screen in 1-3 sentences, noting app name, task, and any visible text."
- Skips frames where pixel hash is within 5% of previous capture (screen unchanged)
- Stores `{timestamp, description, app_name, pixel_hash, screenshot_path}` in SQLite

Out of scope for MVP: audio/meeting transcription, cross-device sync, retention policies, UI.

---

## Implementation Phases

### Phase 1: Capture daemon + SQLite store

**Goal:** A daemon process that captures the screen on interval, sends to Haiku, and writes to SQLite.

**Files:**
- `src/daemon.ts` — `captureLoop(intervalMs)`: screenshot → hash → diff-check → Haiku describe → DB insert
- `src/db.ts` — `openDb(path)`, `insert(row)`, `search(query, limit)`, `recent(minutes)`, `timeline(date)`
- `src/describe.ts` — `describeScreen(pngBase64)` → `{description, appName}` via Haiku

**Key steps:**
1. `screenshot()` from `screenshot-desktop` returns a PNG Buffer.
2. Compute a quick pixel hash: `crypto.createHash('md5').update(png).digest('hex').slice(0,8)`.
3. Skip if hash matches last captured hash (screen unchanged).
4. Base64-encode PNG and call Haiku with a single user message containing the image.
5. SQLite schema: `CREATE TABLE frames (id INTEGER PRIMARY KEY, ts INTEGER, description TEXT, app_name TEXT, pixel_hash TEXT, path TEXT)` + `CREATE VIRTUAL TABLE frames_fts USING fts5(description, content='frames', content_rowid='id')`.

**Verify:** Run daemon for 5 minutes across 3 different apps; query `search_memory("writing code")` and confirm results mention the editor.

---

### Phase 2: MCP server

**Goal:** Stdio MCP server with 3 tools, registered in `~/.claude/settings.json`.

**Files:**
- `src/mcp.ts` — MCP server using `@modelcontextprotocol/sdk`, wires the 3 tools to DB queries
- `src/index.ts` — entrypoint: either `daemon` or `mcp` subcommand based on `argv[2]`

**Key steps:**
1. `new Server({name: "luci", version: "0.1.0"})` with `ListToolsRequestSchema` and `CallToolRequestSchema` handlers.
2. `search_memory`: calls `db.search(query, limit)` → format as `{timestamp, description, appName}[]`.
3. `recent_context`: calls `db.recent(minutes)` → format as markdown timeline (one line per capture).
4. `session_timeline`: calls `db.timeline(date)` → group by hour, return hourly summaries.
5. `settings.json` snippet:
   ```json
   { "mcpServers": { "luci": { "command": "node", "args": ["/path/to/luci/dist/index.js", "mcp"] } } }
   ```

**Verify:** In Claude Code, ask "What was I doing 20 minutes ago?" — confirm `recent_context` is called and returns accurate screen activity.

---

### Phase 3: Stretch — audio transcription

**Goal:** Capture microphone audio during sessions, transcribe with Whisper, store alongside screen frames.

**Files:**
- `src/audio.ts` — records audio segments using `node-record-lpcm16`, chunks into 60 s WAV files
- `src/transcribe.ts` — sends WAV to Whisper API (`openai.audio.transcriptions.create`), stores transcript

**Key steps:**
1. Record 60 s chunks; on chunk complete, transcribe and store with timestamp + merge with nearby screen frames.
2. Add `meeting_search(query)` MCP tool that searches transcripts.
3. Keep audio recording as an opt-in flag: `LUCI_RECORD_AUDIO=1`.

---

## Estimated Effort

About 2 Claude Code sessions.
- **Session 1 (≈ 2.5 h):** Phase 1. Daemon + SQLite + Haiku integration + diff detection.
- **Session 2 (≈ 1.5 h):** Phase 2. MCP server + tool wiring + settings.json + verify end-to-end.

## Potential Blockers

- **macOS screen-recording permission:** `screenshot-desktop` requires `TCC` permission grant on first run. System Preferences → Privacy → Screen Recording → allow the terminal/Node process.
- **Haiku cost at 30 s intervals:** ~120 screenshots/hour × ~150 tokens = ~18k tokens/hour ≈ $0.01/hour at Haiku pricing. Mitigate by increasing interval to 60 s and relying on diff detection to skip unchanged screens.
- **SQLite FTS5 triggers:** On SQLite < 3.36 the `content=` + `content_rowid=` FTS5 pattern needs explicit `AFTER INSERT` triggers to populate the FTS index. Check `PRAGMA compile_options` for `ENABLE_FTS5`.
- **screenshot-desktop on Linux:** Requires `scrot` or `xdg-screensaver` in PATH. Install via apt/brew.
- **Privacy:** All data stays local (SQLite file at `~/.luci/memory.db`). Never index password manager windows — add an opt-out app list (`LUCI_SKIP_APPS=1Password,Keychain`).

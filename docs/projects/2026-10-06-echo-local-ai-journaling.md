# Echo — Local-First AI Journaling with Voice, Photos, and BYO LLM

**Source:** <https://github.com/29sayantanc/Echo>
**Discovered:** 2026-10-06
**Viability:** 4/4

> An open-source, fully on-device journaling platform that captures text, voice memos, and photos, then uses local AI (Whisper + Ollama/Claude) to organize entries into timeline cards, surface insights, and answer questions about your day. No cloud dependency. SQLite storage. MIT license.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

Most AI journaling apps send your entries to a cloud API. Echo keeps everything on-device: Whisper for transcription, Ollama (or Claude via API) for organization and insights, SQLite for storage. The gap it fills: a private, multi-modal daily log that your AI coding sessions can also query — "what was I working on Tuesday?" becomes a real question with a real answer. Weekend-buildable because it's a single-command install and the personal fork is light (swap Ollama for Claude API, add an MCP server). Daily utility because daily journaling becomes the habit.

---

## Implementation Plan

**1 Claude Code session** to deploy Echo locally, wire Claude API as the LLM backend, and add an MCP server so Claude Code can query your journal history.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Core | Echo (self-hosted) | Ready-made multi-modal capture + SQLite |
| LLM | Claude Haiku (via API) | Faster + cheaper than Ollama for text ops; private transcription stays local |
| Transcription | Whisper (local, bundled) | On-device, no data leaves the machine |
| Storage | SQLite FTS5 (bundled) | Full-text search across all entries |
| MCP | Custom MCP wrapper | Expose `search_journal`, `recent_entries`, `day_summary` to Claude Code |
| Deploy | Node.js local daemon | Starts on login, port 7820 |

---

## MVP Scope

1. Clone Echo, configure Claude Haiku as the LLM backend (replace Ollama endpoint)
2. Run the Echo daemon and verify a text entry is created and searchable
3. Record a 30-second voice memo and verify Whisper transcription works
4. Write an MCP server (3 tools: `search_journal`, `recent_entries`, `day_summary`) that reads from Echo's SQLite DB
5. Register the MCP server in `~/.claude/settings.json` so Claude Code can query journal history

Out of scope for MVP: photo capture, iOS/Android sync, custom timeline views, analytics dashboard.

---

## Implementation Phases

### Phase 1: Echo deployment + Claude API backend

**Goal:** Echo running locally with Claude Haiku as the AI backend.

**Steps:**
1. `git clone https://github.com/29sayantanc/Echo && cd Echo`
2. `npm install`
3. Copy `.env.example` to `.env`; set:
   - `LLM_PROVIDER=claude`
   - `CLAUDE_API_KEY=<your-key>`
   - `CLAUDE_MODEL=claude-haiku-4-5-20251001`
   - `DB_PATH=~/.echo/journal.db`
4. `npm start` — Echo daemon starts on port 7820
5. Open `http://localhost:7820`; create a test entry: "Testing Echo setup" → confirm it appears in the timeline

---

### Phase 2: Voice memo transcription

**Goal:** Voice memos transcribed on-device by Whisper.

**Steps:**
1. Verify Whisper model is downloaded (Echo's install script handles this; check `~/.echo/models/`)
2. Click the microphone icon in the Echo UI; record 20-30 seconds
3. Confirm the transcription appears within 5-10 seconds and is added as a journal entry
4. Test accuracy: record a sentence with a technical term ("I'm working on a FastAPI endpoint with Pydantic v2 validation") — check transcription fidelity
5. If accuracy is low: switch Whisper model size from `base` to `small` in `.env` (`WHISPER_MODEL=small`); re-test

---

### Phase 3: MCP server for Claude Code journal queries

**Goal:** Claude Code can query your journal history with natural language.

**Files:**
- `mcp/echo-mcp.js` — MCP server with 3 tools

**Key steps:**
1. Write `mcp/echo-mcp.js` using `@modelcontextprotocol/sdk`:
   - `search_journal(query, limit=10)` — FTS5 search over all entries
   - `recent_entries(n=5)` — last N entries with timestamps
   - `day_summary(date)` — all entries for a specific date, summarized by Claude
2. Register in `~/.claude/settings.json`:
   ```json
   {
     "mcpServers": {
       "echo": {
         "command": "node",
         "args": ["/path/to/Echo/mcp/echo-mcp.js"],
         "env": { "ECHO_DB": "~/.echo/journal.db" }
       }
     }
   }
   ```
3. Test in Claude Code: "What was I working on yesterday?" → confirm `recent_entries` is called and results are coherent
4. Test: "Find my notes about authentication setup" → confirm FTS5 search returns the right entry

---

### Phase 4: Autostart on login

**Goal:** Echo daemon starts automatically when the machine boots.

**Steps (macOS):**
1. Create `~/Library/LaunchAgents/echo.plist` with a launchd definition pointing to `npm start --prefix /path/to/Echo`
2. `launchctl load ~/Library/LaunchAgents/echo.plist`
3. Reboot and verify `http://localhost:7820` is accessible without manual startup

**Steps (Linux/systemd):**
1. Create `~/.config/systemd/user/echo.service`
2. `systemctl --user enable echo && systemctl --user start echo`

---

## Estimated Effort

About 1 Claude Code session (3 hours).

- **30 min:** Clone + Claude API config + smoke test
- **30 min:** Voice memo + Whisper verification
- **90 min:** MCP server (3 tools) + registration + test in Claude Code
- **30 min:** Autostart setup

## Potential Blockers

- **Whisper model size:** The `base` model (142 MB) is fast but struggles with accented speech or technical vocabulary. The `small` model (461 MB) is noticeably better; `medium` (1.5 GB) is overkill for journaling. Start with `small`.
- **SQLite path:** The MCP server needs the exact path to Echo's SQLite DB. Confirm the path by looking in `.env` after first run; `~` expansion may not work in the JSON config — use the absolute path.
- **Early-stage project:** Echo is a recent Show HN submission with limited stars. Expect rough edges in the voice capture UI on some browsers. Use the CLI interface (`http://localhost:7820/cli`) if the web UI has issues.
- **FTS5 tokenizer:** By default SQLite FTS5 uses porter stemming. If you journal in multiple languages, override the tokenizer to `unicode61` in the Echo schema migration to avoid missed searches.

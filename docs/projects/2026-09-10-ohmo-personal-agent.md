# Personal Ohmo-Style Agent (Telegram + Claude)

**Source:** <https://github.com/HKUDS/OpenHarness>
**Discovered:** 2026-09-10
**Viability:** 4/4

> OpenHarness shipped "Ohmo" — a personal AI agent that runs on your existing Claude Code or Codex subscription without a separate API bill, accessible from Feishu, Slack, Telegram, or Discord. The concept: a phone-reachable agent with persistent memory and real tool use, for your own projects.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

Telegram bot + Claude API + SQLite session memory is a tight, testable scope. No phone-accessible Claude agent exists in the current toolkit. Using the Claude API (not Claude Code subscription) avoids the "runs on subscription" complexity while still being cheap (~$0.30/day at normal usage). Novel framing: persistent memory across reboots, built-in tools (web search, file ops, shell), voice note support.

---

## Implementation Plan

## Overview

A personal Telegram bot backed by Claude claude-sonnet-4-6 that maintains persistent conversation history, runs real tools (web search, file read/write, shell commands), and transcribes voice notes. Acts as a phone-reachable AI assistant for daily task management and ad-hoc research.

## Stack Recommendation

- **Runtime**: Python 3.12
- **Bot**: `python-telegram-bot` v21+ (async, webhook-ready)
- **AI**: Claude claude-sonnet-4-6 via `anthropic` Python SDK
- **Memory**: SQLite via `aiosqlite` — conversations, tasks, notes tables
- **Tools**: DuckDuckGo search (`duckduckgo-search`), file ops, subprocess shell
- **Voice**: `openai-whisper` (local) or OpenAI Whisper API for voice note transcription
- **Deployment**: Docker + systemd on a Hetzner CX11 VPS (~€4/mo)

## MVP Scope

A Telegram bot that:
1. Accepts free-text messages and voice notes
2. Passes messages to Claude with persistent conversation history (last 20 turns)
3. Runs 4 built-in tools: web search, read file, write file, run shell command
4. Persists active tasks and notes across bot restarts (SQLite)
5. Returns formatted markdown responses

## Implementation Phases

### Phase 1: Bot Skeleton + Claude Connection
**Goal:** Send a message to the bot, receive a real Claude response
**Files to create/modify:**
- `bot.py` — python-telegram-bot Application, message handler wired to agent
- `agent.py` — Claude agent loop: send prompt → handle tool_use → return final text
- `config.py` — loads TELEGRAM_TOKEN, ANTHROPIC_API_KEY from `.env`
- `requirements.txt` — python-telegram-bot, anthropic, python-dotenv
**Key steps:**
1. `pip install python-telegram-bot anthropic python-dotenv`
2. Create bot via @BotFather → copy token to `.env`
3. Implement `message_handler(update, context)` in `bot.py` that calls `agent.chat(text)`
4. In `agent.py`, implement `chat(text)` → `client.messages.create(model="claude-sonnet-4-6", messages=[...])` → return `content[0].text`
5. Add `/start` command with welcome message
6. Run with `python bot.py` (polling mode)
**Verify:** Send "what is 2+2?" to the bot — Claude responds correctly in <5 seconds

### Phase 2: Core Tools
**Goal:** Agent can search the web, read/write files, run shell commands
**Files to create/modify:**
- `tools/web_search.py` — DuckDuckGo search returning top 5 results as text
- `tools/file_ops.py` — `read_file(path)`, `write_file(path, content)`, `list_dir(path)` — restricted to `~/agent-workspace/`
- `tools/shell.py` — `run_command(cmd, timeout=30)` — 4KB output cap, blocks network commands
- `tools/__init__.py` — `TOOLS` list: Anthropic tool dicts + callable dispatch map
- `agent.py` — extend to full tool-use loop: detect `stop_reason == "tool_use"`, call tool, append `tool_result`, continue
**Key steps:**
1. Define tool schemas per Anthropic API: `{"name": "web_search", "description": "...", "input_schema": {...}}`
2. Implement `run_tools(tool_use_blocks) -> list[tool_result]` dispatcher
3. Loop: `create() → if tool_use: run_tools → append results → create() again` until `end_turn`
4. Install `duckduckgo-search`: `pip install duckduckgo-search`
5. Add path sanitization in file_ops: `os.path.abspath(path).startswith(WORKSPACE)` guard
**Verify:** Ask "search for latest Claude news and write a 3-bullet summary to workspace/news.md" — verify file created with correct content

### Phase 3: Session Memory + Context Persistence
**Goal:** Agent remembers tasks and key facts across bot restarts
**Files to create/modify:**
- `memory.py` — SQLite schema: `conversations(id, user_id, role, content, ts)`, `tasks(id, title, status, ts)`, `notes(id, content, ts)`
- `context_manager.py` — `build_system_prompt()` appends active tasks + recent notes to base prompt
- `agent.py` — load last 20 turns from DB instead of in-memory list; add `remember` tool
**Key steps:**
1. Create `~/.ohmo/memory.db` on startup with schema migration (CREATE TABLE IF NOT EXISTS)
2. In `agent.py`, load conversation history from DB on each `chat()` call
3. Persist every turn (user + assistant) to conversations table after response
4. Add `remember(fact: str)` tool that inserts into notes table
5. In `build_system_prompt()`, include: `## Active Tasks\n{tasks}` + `## Notes\n{last 10 notes}`
6. Add `/tasks` Telegram command: queries tasks table, formats as numbered list
**Verify:** Tell bot "remember: standup is at 9am". Kill bot, restart. Ask "what time is standup?" — bot recalls 9am.

### Phase 4: Voice Support + Deployment
**Goal:** Bot runs 24/7, transcribes voice notes
**Files to create/modify:**
- `tools/voice.py` — download OGG from Telegram, convert to WAV (`ffmpeg`), transcribe via `openai.audio.transcriptions.create(model="whisper-1")`
- `Dockerfile` — `python:3.12-slim`, install ffmpeg + requirements, CMD `python bot.py`
- `docker-compose.yml` — single service, volume for `~/.ohmo/`
**Key steps:**
1. Add voice_handler in `bot.py`: `update.message.voice.get_file() → download → transcribe → pass text to agent`
2. Install ffmpeg in Dockerfile: `apt-get install -y ffmpeg`
3. Build and push image: `docker build -t ohmo . && docker push`
4. On Hetzner CX11: `docker-compose up -d`
5. Switch from polling to webhook: set `WEBHOOK_URL` env var, call `bot.set_webhook(url)`
**Verify:** Send a voice note saying "add task: review PRs tomorrow". Check `/tasks` — should show the task.

## Estimated Effort

2 Claude Code sessions:
- **Session 1** (~3-4h): Phases 1-2 — working bot with Claude + web search + file/shell tools
- **Session 2** (~3h): Phases 3-4 — SQLite memory, voice transcription, Docker deployment

## Potential Blockers

- **Shell execution safety**: Unrestricted shell access from a Telegram bot is risky. Keep a strict allowlist or restrict to the workspace directory only. Block `curl`, `wget`, `ssh`.
- **Voice transcription cost**: OpenAI Whisper API costs $0.006/min. At 10 voice messages/day = ~$0.01/day. Acceptable. Local whisper.cpp is free but adds 500MB to Docker image.
- **Plaid/webhook SSL**: Telegram webhooks require HTTPS. Use Caddy in docker-compose (`caddy:alpine`) with automatic Let's Encrypt — or use polling mode for local dev.
- **API rate limits**: claude-sonnet-4-6 at Tier 1: 50 req/min. A personal bot won't approach this. No concern.

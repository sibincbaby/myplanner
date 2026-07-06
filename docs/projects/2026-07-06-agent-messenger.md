# Agent Messenger CLI — Multi-Platform Notification CLI for AI Agents

**Inspired by:** [github.com/devxoul/agent-messenger](https://github.com/devxoul/agent-messenger)  
**Source:** GitHub search — messenger automation CLI for AI agents (Slack, Discord, Teams, Telegram, etc.)  
**Interest score:** 2/4 (Claude/LLM tooling + dev productivity)

## What It Is

Agent Messenger is a CLI that gives AI agents a unified interface to send and receive messages across Slack, Discord, Teams, Telegram, WhatsApp, LINE, Instagram, KakaoTalk, and Channel Talk. Agents can post status updates, ask for approvals, and receive responses back into the agent context.

## Why Build Your Own

The reference supports 10+ platforms but that breadth makes it complex to self-host. What fills a real gap for a solo developer is a **lean personal version focused on the platforms you actually use** (Slack + Telegram are enough for 95% of cases). The unique angle worth owning: a **Claude Code MCP tool** that lets any agent call `notify(message, channel?)` to push a status update or ask a question, and optionally wait for a reply before continuing. This turns Claude Code into a supervised agent that can escalate blockers and wait for human approval — without you watching the terminal.

## Stack Recommendation

- **TypeScript + `@modelcontextprotocol/sdk`** — MCP server exposing `notify`, `ask`, `poll_reply` tools to Claude Code
- **`@slack/web-api`** — post and read Slack messages in a dedicated `#agent-feed` channel
- **`node-telegram-bot-api`** — Telegram bot for mobile push on the go
- **`sqlite3`** — store pending questions and replies; the MCP server polls this DB rather than holding open websockets
- **Claude Code MCP integration** — add the server to `~/.claude/mcp.json` so all Claude Code sessions have `notify` available

## MVP Scope

A single `notify` MCP tool that posts a formatted message to Slack and/or Telegram. Run `agent-messenger init` to store tokens (encrypted in `~/.config/agent-messenger/config.enc`). Claude Code calls `notify("Build complete — 3 tests failed in auth module")` and a Slack message appears in `#agent-feed` with the agent's session ID and timestamp. No reply needed for the MVP — just reliable delivery.

---

## Implementation Phases

### Phase 1 — Config + Slack Notify
**Goal:** `agent-messenger send "hello"` → message appears in Slack.

**Files:**
- `src/config.ts` — read/write `~/.config/agent-messenger/config.json` (token, channel IDs); encrypt with `libsodium-wrappers`
- `src/platforms/slack.ts` — `sendSlack(text, channelId)` using `@slack/web-api`
- `src/cli.ts` — `agent-messenger init` (prompts for tokens), `agent-messenger send "<text>"`

**Key steps:**
1. `init` command: prompt for Slack Bot Token + channel ID, verify by sending a test message, store encrypted
2. Message format: block-kit attachment with `[agent-messenger]` header, timestamp, and body text
3. `send` command: load config → call `sendSlack` → print the Slack message permalink to stdout

**Verify:** `agent-messenger send "Phase 1 complete"` → message with timestamp appears in the configured Slack channel within 2s.

---

### Phase 2 — Telegram Support
**Goal:** Messages land on your phone as a Telegram push notification.

**Files:**
- `src/platforms/telegram.ts` — `sendTelegram(text, chatId)` using `node-telegram-bot-api`
- extend `config.ts` — add Telegram bot token + chat ID fields

**Key steps:**
1. `init` adds Telegram credentials after Slack
2. Both platforms are optional: `agent-messenger send` delivers to whichever platforms are configured
3. Telegram message format: plain text with a `🤖 Agent:` prefix and ISO timestamp

**Verify:** With both platforms configured, `agent-messenger send "test"` → message appears on Slack AND as a Telegram push notification.

---

### Phase 3 — MCP Server with `notify` and `ask` tools
**Goal:** Claude Code can call `notify` as a first-class MCP tool.

**Files:**
- `src/mcp-server.ts` — MCP server (stdio) exposing:
  - `notify(message: string, urgent?: boolean)` → posts to all configured platforms; returns `{delivered_to: string[]}`
  - `ask(question: string, options?: string[])` → posts question to Slack with reaction-button options; writes pending question to SQLite; returns a `question_id`
  - `poll_reply(question_id: string)` → checks SQLite for a human reply; returns `{answered: bool, answer?: string}`
- `src/db.ts` — SQLite schema: `questions(id, text, options, answer, created_at, answered_at)`

**Key steps:**
1. Register server in `~/.claude/mcp.json` as `"agent-messenger": {"command": "npx", "args": ["agent-messenger", "serve"]}`
2. `ask` posts to Slack with `:white_check_mark:` reaction buttons for each option; a Slack event handler (polling via `conversations.history`) detects the reaction and writes the answer to SQLite
3. Claude Code workflow: call `ask` → call `poll_reply` in a loop with 30s delay between polls; break on `answered: true`

**Verify:** Claude Code calls `ask("Should I proceed with the database migration?", ["yes", "no"])` → Slack shows the question; add `:white_check_mark:` reaction → `poll_reply` returns `{answered: true, answer: "yes"}`.

---

### Phase 4 — Structured Agent Status Messages
**Goal:** Rich status updates (task completion, error reports) formatted as Slack block-kit cards.

**Files:**
- `src/formatters.ts` — card templates: `taskComplete`, `taskFailed`, `blocker`, `checkpoint`

**Card types:**
- `taskComplete(task, duration, summary)` — green header, summary bullet points
- `taskFailed(task, error, next_steps)` — red header, error excerpt, suggested actions
- `blocker(description, options)` — yellow header, inline buttons for resolution options
- `checkpoint(progress, total, eta)` — progress bar emoji + ETA

**Key steps:**
1. Add a `notify_structured(type, payload)` MCP tool that picks the right card template
2. Telegram gets a plain-text fallback since it doesn't support block-kit
3. All cards include `[Session: <CLAUDE_SESSION_ID>]` so you can correlate notifications to a specific agent run

**Verify:** `notify_structured("taskComplete", {task: "Refactor auth module", duration: "12m", summary: ["Moved 3 files", "Updated 7 imports", "All tests pass"]})` → formatted Slack card appears with green header and bullet list.

---

### Phase 5 — Daily Agent Digest
**Goal:** At the end of each day, post a digest of all agent activity from that session.

**Files:**
- `src/digest.ts` — aggregate all `notify` and `ask` calls from SQLite for the day; format as a chronological summary
- extend `cli.ts` — `agent-messenger digest` command; can be run from a cron or end-of-session hook

**Key steps:**
1. Store every `notify` call in SQLite with timestamp and session ID
2. `digest` queries today's records, groups by session, sends a single Slack thread reply to the first message of each session
3. Optionally write digest to `~/.agent-messenger/digests/YYYY-MM-DD.md`

**Verify:** After a day of agent runs, `agent-messenger digest` → a single Slack message with a bulleted timeline of all agent notifications, grouped by session.

---

## Estimated Effort

**1 Claude session.** Phase 1+2 (Slack + Telegram delivery) are ~1.5 hours and immediately useful. Phase 3 (MCP server + ask/reply) is the key capability — ~1.5 hours. Phase 4 (structured cards) is ~45 min. Phase 5 (digest) is ~30 min.

## Potential Blockers

- **Slack token scopes**: the bot needs `chat:write`, `channels:history`, `reactions:read` — easy to get wrong; verify all scopes in the Slack app console before testing.
- **Polling vs. websockets for replies**: Slack Events API via websocket (Socket Mode) is more reliable than polling `conversations.history` but requires a static host or tunnelling. For local dev, polling with 10s interval is fine. Note the latency tradeoff.
- **Telegram bot setup**: you must message `@BotFather`, then message your bot to get your `chat_id` — this is undiscoverable without a setup script. Build `agent-messenger init telegram` to automate this.
- **`ask` loop in Claude Code**: `poll_reply` should not block the agent indefinitely. Set a max poll count (e.g., 20 attempts × 30s = 10 min timeout) and return `{answered: false, timed_out: true}` so the agent can decide to proceed or abort.
- **Token security**: never log tokens to stdout or store them unencrypted. Use `libsodium-wrappers` with a key derived from the machine's UUID — not perfect, but prevents casual exposure in shell history.

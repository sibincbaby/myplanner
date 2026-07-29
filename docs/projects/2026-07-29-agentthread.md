# AgentThread

> A lightweight messaging runtime where AI agents hold their own accounts, receive messages, run on triggers, and reply into shared threads alongside humans — the missing async layer between Claude Code sessions and the people waiting on their results

**Inspired by:** [ama2.me](https://ama2.me/) (discovered July 29 2026, Show HN July 2026)  
**Date discovered:** 2026-07-29

---

## What gap it fills

Right now, when a Claude Code agent finishes a task (discovery run, CI fix, nightly report), its output lands in a terminal transcript that nobody is watching. Routing the result to a person requires glue: a push notification, a GitHub comment, a Slack webhook. There is no unified place where "the agent" has an identity and can reach the right person through the right channel.

AMA2 is the reference design: a messaging runtime where agents join threads like humans do, send and receive messages, and communicate with each other via MCP and A2A. AMA2 is a product with a website and an opaque backend. AgentThread is a personal, self-hosted version: a Node.js message broker with a SQLite thread store, a simple web UI, and a webhook-to-Claude bridge. The user deploys it locally (or on a VPS), registers their recurring agents as participants, and any agent can post into a shared thread when it has something to say.

Concrete daily value: the morning discovery run posts its summary into a "daily-digest" thread. A CI monitor agent posts failures into a "ci-alerts" thread. The user reads both threads in one place — the same way they'd read messages from a teammate.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Runtime | Node.js 22 + TypeScript | Ecosystem for MCP SDK and messaging primitives |
| Database | SQLite via `better-sqlite3` | Local-first, zero ops, fast for single-user scale |
| Web UI | Preact + htm (no build step) | Lightweight chat UI, no webpack, single HTML file served statically |
| MCP bridge | `@modelcontextprotocol/sdk` | Agents post via MCP tool call; compatible with Claude Code |
| HTTP | `fastify` | Fast, minimal REST API for message posting and SSE streaming |
| Auth | Single shared secret in env | Personal use, no multi-user auth needed for MVP |

## MVP scope (1 Claude session)

A working message runtime with:

1. **Thread store** — SQLite: `threads` (id, name, created_at), `participants` (thread_id, name, type: human|agent), `messages` (id, thread_id, sender, body, created_at)
2. **REST API** — `POST /threads`, `GET /threads/:id/messages`, `POST /threads/:id/messages`
3. **SSE endpoint** — `GET /threads/:id/stream` — push new messages to the web UI without polling
4. **Web UI** — single `index.html`: thread list sidebar, message feed, message input
5. **MCP tool** — `post_message(thread_id, body)` — so Claude Code agents can post results into a thread natively

Out of scope for MVP: agent-to-agent A2A protocol, mobile app, per-message reactions, file attachments, thread search.

## Phases

### Phase 1 — Thread store + REST API (1.5 h)
- SQLite schema: `threads`, `participants`, `messages` with indexes on `(thread_id, created_at)`
- Fastify routes: CRUD for threads and messages; `GET /threads` lists threads with last message preview
- Seed: a default "general" thread and a "system" agent participant
- Test with curl: create thread → post message → fetch messages

### Phase 2 — SSE streaming + Web UI (1.5 h)
- `GET /threads/:id/stream`: server-sent events; each new message triggers an event with `data: JSON`
- `index.html` with Preact: thread list left panel, message feed right panel, input box at bottom
- Auto-scroll to latest message; sender name color-coded (human = blue, agent = green)
- Served by Fastify static plugin; no build step

### Phase 3 — MCP tool bridge (1 h)
- Implement a small MCP server (`agentthread-mcp`) with one tool: `post_message(thread_id, body, sender_name)`
- Register in Claude Code's MCP config; now any Claude Code session can `use_mcp_tool agentthread post_message`
- Add a second tool: `list_threads()` — returns thread names and IDs so the agent can pick the right thread
- Test: `claude code "run the daily summary and post it to the daily-digest thread"`

### Phase 4 — Agent participant registration (1 h)
- `POST /agents` — register a named agent with a webhook URL and a trigger schedule (cron expression)
- A cron runner (`node-cron`) fires registered agents on schedule: `POST` to their webhook URL with `{thread_id, trigger: "schedule"}`
- The agent's webhook handler runs Claude Code (or any script) and posts back via the MCP tool
- This closes the loop: register the daily discovery runner once, it self-fires and posts to the thread

### Phase 5 — Thread notifications (30 min)
- `POST /webhooks/notify` — when a new message arrives in a thread flagged `notify: true`, send a push notification via the existing PushNotification tool pattern
- Config key `notifyThreads: ["ci-alerts", "daily-digest"]` in server config
- Prevents notification fatigue: only threads the user opts into trigger alerts

## Effort estimate

~5.5 hours all phases · 1–2 Claude sessions  
Phases 1–3 deliver a working message runtime + Claude Code integration in ~4 hours — Phases 4–5 close the autonomous-agent loop

## Blockers / risks

- **Single-user scope:** AgentThread is designed for one person with multiple agents. Do not add multi-user auth, roles, or workspace concepts — that's AMA2's territory and out of scope. Keep the shared secret simple.
- **MCP vs. webhook tension:** In Phase 4, agents are triggered by webhook. In Phase 3, they post via MCP. These two channels can coexist: webhook for "start running", MCP tool for "I'm done, here's the result." Keep them separate.
- **Concurrency:** Fastify + better-sqlite3 handles concurrent reads fine; WAL mode handles concurrent writes. Set `PRAGMA journal_mode=WAL` on startup.
- **AMA2 differentiation:** AMA2 supports inter-agent A2A messaging (agents DMing each other). AgentThread is human-centric: agents post into threads that humans read. That's the right MVP scope — don't try to implement A2A, which requires agent identity resolution and routing logic.

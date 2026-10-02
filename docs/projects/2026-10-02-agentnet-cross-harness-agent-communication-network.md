# AgentNet – Cross-Harness Agent Communication Network

**Source:** <https://github.com/misunders2d/agentnet>
**Discovered:** 2026-10-02
**Viability:** 4/4

> The core insight is right: Claude Code, Codex, Pi, and other agents run as separate processes that can't talk to each other without explicit infrastructure. AgentNet provides that infrastructure — a self-hosted router that gives every agent a named inbox and lets them dispatch tasks to each other with no shared state or vendor lock-in. The design is agent-agnostic by intent: each harness speaks to the network via a thin adapter hook, not a bespoke SDK. Weekend-buildable because the routing core is a simple pub/sub server; the value is in the adapters that wire it into existing agents.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

The MVP — a local WebSocket router + one Claude Code adapter — is a 4-hour build. The daily utility is real as soon as you want Claude Code to delegate a slow subtask to a second agent and collect the result without polling.

---

## Implementation Plan

**2 Claude Code sessions** to a working two-agent Claude Code ↔ Codex communication link.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | asyncio WebSocket native |
| Transport | WebSocket (`websockets` 13+) | Low latency, bidirectional |
| Router | Custom asyncio server | ~60 lines, no external dependency |
| Message format | JSON-over-WebSocket | Human-readable, debuggable |
| Claude Code adapter | Claude Code hook (`.claude/hooks/`) | PreToolUse/Stop lifecycle points |
| Codex adapter | Codex hook (`.codex/hooks/`) | Same pattern |
| Shared context store | SQLite via `aiosqlite` | Durable, zero-config |
| Auth | HMAC-SHA256 token | Prevent accidental cross-session leaks |
| CLI | Typer | `agentnet start`, `agentnet status` |

---

## MVP Scope

A local WebSocket router that accepts connections from named agents. A Claude Code adapter hook that can `SEND` a message to another agent and `WAIT` for a reply. A minimal Codex adapter with the same interface. A shared SQLite context store for passing large payloads by reference. An `agentnet status` CLI command showing connected agents and message counts.

Out of scope for MVP: web UI, Pi/A2A adapters, TLS, multi-machine networking, message persistence beyond 24 hours.

---

## Implementation Phases

### Phase 1: WebSocket Router
**Goal:** A local server that accepts named-agent connections and routes messages by destination name.

**Files:**
- `pyproject.toml` — deps: websockets, aiosqlite, typer, rich
- `src/agentnet/router.py` — async WebSocket server
- `src/agentnet/message.py` — `Message` dataclass: `{id, from_agent, to_agent, type, payload, reply_to}`
- `src/agentnet/cli.py` — `agentnet start [--port 7432]` and `agentnet status`
- `src/agentnet/config.py` — `~/.config/agentnet/config.toml` (port, auth token)

**Key steps:**
1. Router maintains a `connections: dict[str, WebSocket]` mapping agent names to live connections.
2. On first connect, client sends `{"type": "REGISTER", "agent": "claude-code-1", "token": "..."}`. Router validates token (HMAC of agent name + shared secret from config); rejects on mismatch.
3. Route `{"type": "SEND", "to": "codex-1", "payload": "..."}` by looking up `connections["codex-1"]` and forwarding the full message with the `from` field set by the router.
4. Route `{"type": "REPLY", "reply_to": "<message_id>", "payload": "..."}` to the sender of the original message (router stores `pending: dict[str, str]` mapping message_id → originating agent name).
5. On disconnect, remove from `connections` and log.
6. `agentnet status`: HTTP GET `/status` endpoint (same process) returns JSON of connected agents + last-seen timestamps; `agentnet status` pretty-prints it.

**Verify:** Start router. Connect two Python WebSocket clients named `alpha` and `beta`. `alpha` sends to `beta`; `beta` replies. Both messages arrive correctly. `agentnet status` shows both agents connected.

---

### Phase 2: Claude Code Adapter
**Goal:** Claude Code gains `send_to_agent` and `wait_for_reply` as skills; the hook integration makes them available as tool calls within a Claude session.

**Files:**
- `.claude/hooks/agentnet_hook.py` — PreToolUse + Stop hooks
- `src/agentnet/sdk.py` — `AgentNetClient`: `connect(agent_name)`, `send(to, payload)`, `wait(timeout_s=120)`, `reply(msg_id, payload)`
- `prompts/agentnet_usage.txt` — skill-style instructions for Claude on when and how to call these functions

**Key steps:**
1. `AgentNetClient.connect(agent_name)`: opens a persistent WebSocket connection to `ws://localhost:7432`. Registers with the router. Stores the connection in a module-level global so hooks in the same process share it.
2. `send(to, payload)`: serialises and sends `{"type": "SEND", "to": to, "payload": payload, "id": uuid4()}`. Returns the message ID.
3. `wait(timeout_s)`: blocks asyncio with `asyncio.wait_for`, listening for a `REPLY` with a matching `reply_to`. Raises `TimeoutError` on expiry.
4. The hook script exposes a `dispatch_to_agent(agent_name: str, task: str) -> str` function that combines `send` + `wait`. Claude Code can call this via a `Bash` tool call: `python -c "from agentnet.sdk import dispatch_to_agent; print(dispatch_to_agent('codex-1', 'write tests for src/foo.py'))"`.
5. Include `prompts/agentnet_usage.txt` as an injected skill that tells Claude when dispatching is appropriate (long-running tasks, tasks that require a different model's capability).

**Verify:** Start router + two Claude Code sessions. Session A runs `dispatch_to_agent("claude-code-2", "summarise the file src/main.py")`. Session B (with agentnet's listener hook active) receives the task, completes it, and the reply is returned to Session A.

---

### Phase 3: Shared Context Store
**Goal:** Agents can store and retrieve named context blobs (too large for a WebSocket message) via a shared SQLite store.

**Files:**
- `src/agentnet/store.py` — `ContextStore`: `put(key, value, ttl_hours=24)`, `get(key)`, `list_keys()`, `evict_expired()`
- `src/agentnet/router.py` — updated to handle `{"type": "STORE_PUT"}` and `{"type": "STORE_GET"}` message types
- `src/agentnet/sdk.py` — `AgentNetClient.store_put(key, value)`, `store_get(key)`

**Key steps:**
1. SQLite DB at `~/.local/share/agentnet/context.db`. Table: `(key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER)`.
2. `put(key, value, ttl_hours)`: upsert. `get(key)`: return None if expired. Run `evict_expired()` on every router startup.
3. Agents use the store for payloads > 4 KB: sender calls `store_put("task-<uuid>", large_payload)`, passes the key in the SEND message. Receiver calls `store_get` with that key.
4. Add `agentnet store list` CLI command showing all live keys and their sizes.

**Verify:** Store a 50 KB JSON blob. Retrieve it from a second agent. `agentnet store list` shows the key. Wait for TTL expiry; key is gone after router restart.

---

### Phase 4: Codex Adapter + Status Dashboard
**Goal:** Codex hooks mirror the Claude Code adapter; a terminal status dashboard shows the live topology.

**Files:**
- `.codex/hooks/agentnet_hook.py` — same pattern as Claude Code adapter
- `src/agentnet/dashboard.py` — Rich Live panel showing: connected agents, message rate, pending replies, store usage

**Key steps:**
1. Codex adapter is structurally identical to Claude Code adapter; only the hook invocation path differs (Codex fires `.codex/hooks/` on tool calls).
2. `agentnet dashboard` starts a Rich `Live` display polling `/status` every 2 seconds. Shows a table of agents, a message-count sparkline, and pending reply timeouts.
3. Add `agentnet replay <session_id>` that prints the message log for a session from the router's in-memory ring buffer (last 500 messages, not persisted).

**Verify:** Run a two-agent workflow with both adapters active. Open `agentnet dashboard` in a third terminal; watch message counts increment in real time.

---

## Estimated Effort

**2 Claude Code sessions** (1 session ≈ 3–4 hours of Claude work).

- **Session 1** — Phases 1 + 2: WebSocket router, HMAC auth, message routing, reply tracking, Claude Code adapter SDK, hook integration, end-to-end test with two local sessions.
- **Session 2** — Phases 3 + 4: SQLite context store, store messages in router, Codex adapter, Rich dashboard, replay command.

---

## Potential Blockers

1. **Claude Code hook lifecycle** — Claude Code hooks run as subprocesses, not as a long-lived process that keeps the WebSocket open. Mitigate: the SDK uses a short-lived connection per call; the router queues messages for disconnected agents for up to 60 seconds (configurable).
2. **Blocking `wait()` in hooks** — `wait()` blocks the hook process, which can stall the Claude Code session if the remote agent is slow. Mitigate: always set a timeout (default 120 s) and document that `dispatch_to_agent` should only be called for tasks expected to complete within that window. For longer tasks, use a fire-and-forget `send` and a polling `wait` in a later hook invocation.
3. **Auth token distribution** — Both agents need the same shared secret. Document a one-time `agentnet init` command that generates the secret and writes it to `~/.config/agentnet/config.toml`; agents read it at startup.
4. **Port conflicts** — Default port 7432. Add `DBX_AGENTNET_PORT` env var override and document it in the README.

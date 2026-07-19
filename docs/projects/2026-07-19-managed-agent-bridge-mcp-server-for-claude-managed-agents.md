# managed-agent-bridge — MCP server to control Claude Managed Agents

**Source:** <https://github.com/modus-agendi/managed-agent-control-mcp>
**Discovered:** 2026-07-19
**Viability:** 3/4

> Seeded by *managed-agent-control-mcp* (modus-agendi, 1★, recent) — a community MCP server that exposes the Claude Managed Agents beta API to any MCP client. The build target is a leaner, more focused version: a minimal MCP server that lets Claude Code itself spawn Claude Managed Agent sessions, stream their output in real-time, inject tool approvals, and stop them — creating a meta-agent composition where Claude Code pilots cloud-hosted Managed Agents without leaving the terminal.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

Claude Managed Agents is a new Anthropic platform feature (agents defined in the cloud, run in a sandbox, accessible via API). There is no first-party MCP bridge to use them from Claude Code, and the only community attempt (the discovered project) has 1★ and a complex 20-tool surface area. A focused 5-tool version — spawn, stream, approve-tool, send-message, stop — is a well-scoped weekend build against a documented REST API. The novel composition (using Claude Code as the orchestrator of cloud-hosted Managed Agents) enables genuinely new workflows: long-running background agents, parallel agent teams, agents with persistent sandboxes. Daily utility is 0 only because Managed Agents aren't yet in every workflow — this scores 3/4, not 4/4. Viable.

---

## Implementation Plan

## Overview

A minimal MCP server (`managed-agent-bridge`) that exposes five tools to Claude Code: **spawn** a Managed Agent session, **stream** its activity (tool calls, messages, status), **approve** a pending tool call, **message** a running session, and **stop** it. The server talks to Anthropic's Managed Agents REST API using the user's existing `ANTHROPIC_API_KEY`. No auth server, no Docker, no lambda — just a local stdio MCP process.

The MVP is: **spawn a named agent → stream its progress → approve or reject tool calls → stop when done**. Agent definition management (creating/editing agents in the Anthropic console) is out of scope; the user already does that in the console.

## Stack Recommendation

- **Runtime: Node 20 + `@anthropic-ai/sdk` + `@modelcontextprotocol/sdk`.** The Anthropic SDK handles the Managed Agents REST calls; the MCP SDK handles the stdio transport. Both are the same ecosystem the user already uses in other MCP servers. TypeScript optional but not required — plain Node 20 with JSDoc is sufficient.
- **Streaming: Server-Sent Events (SSE) from the Managed Agents API**, polled and forwarded to Claude Code via MCP tool responses. The MCP protocol is synchronous (tool call → response), so streaming is simulated by a `stream_activity` tool that returns a batch of recent events rather than a true push channel.
- **State: in-memory `Map<sessionId, {agentId, status, eventBuffer}>`** — session state lives only in the process lifetime. A restart loses in-flight sessions (their actual execution continues server-side; the local bridge just loses its handle). This is fine for MVP.
- **Config: `ANTHROPIC_API_KEY` env var** (already set in most setups) + an optional `MANAGED_AGENTS_BASE_URL` override for enterprise deployments.

## MVP Scope

In:
- `spawn_agent(agent_id: string, initial_message: string)` → `{ session_id, status }`. Starts a new Managed Agent session.
- `stream_activity(session_id: string, since_event_id: string | null)` → `{ events: [...], latest_event_id }`. Returns batched activity since the last poll (tool calls, messages, status changes).
- `approve_tool(session_id: string, tool_call_id: string, approved: boolean, override_input?: object)` → `{ status }`. Approves or rejects a pending tool call.
- `send_message(session_id: string, message: string)` → `{ status }`. Injects a user message into a running session.
- `stop_agent(session_id: string)` → `{ status }`. Terminates the session.

Out (later): listing all managed agents, creating/editing agent definitions, multi-session dashboards, persistent session handles across bridge restarts, webhook-based push events, cost/token tracking per session.

## Implementation Phases

### Phase 1: MCP scaffold + spawn + stop
**Goal:** Claude Code can start a named Managed Agent and stop it.
**Files to create/modify:**
- `src/server.js` — MCP server using `@modelcontextprotocol/sdk` stdio transport; registers all 5 tools.
- `src/api.js` — thin wrapper around `@anthropic-ai/sdk` Managed Agents endpoints: `createSession(agentId, message)`, `stopSession(sessionId)`.
- `src/state.js` — in-memory `Map` of active sessions with a `SessionState` record.
- `package.json` — `"bin": { "managed-agent-bridge": "./src/server.js" }`, `"type": "module"`.
**Key steps:**
1. Read `ANTHROPIC_API_KEY` from env on startup; fail with a clear error if missing.
2. `spawn_agent` calls the Managed Agents API to create a session, stores `{ sessionId, agentId, status: "running" }` in the Map, returns the session ID.
3. `stop_agent` calls the stop endpoint, removes the session from the Map.
**Verify:** Add the MCP server to Claude Code settings; ask Claude "start the 'code-reviewer' agent with the message 'review this file'" — confirm a session ID is returned and the Managed Agents console shows a new session.

### Phase 2: Activity streaming
**Goal:** Claude can poll a session for new events and surface them in the conversation.
**Files to create/modify:**
- `src/api.js` — `getSessionEvents(sessionId, afterEventId)` polls the Managed Agents events endpoint.
- `src/server.js` — `stream_activity` tool: calls `getSessionEvents`, formats events as a human-readable block (each event: type, timestamp, summary), returns `latest_event_id` for the next poll.
- `src/format.js` — `formatEvent(event)` maps event types to readable strings: `tool_call` → "🔧 Called `bash`: `ls -la`", `message` → "💬 Agent: …", `status_change` → "⚡ Status: completed".
**Key steps:**
1. Return at most 20 events per call (configurable) to keep tool responses readable.
2. Include `latest_event_id` so Claude can poll incrementally without re-fetching old events.
3. For a `status_change` event with `status: "waiting_for_approval"`, include the `tool_call_id` prominently so Claude knows to call `approve_tool` next.
**Verify:** Start a session that invokes a tool; poll `stream_activity` repeatedly from Claude; confirm the tool call appears with its ID; confirm polling is incremental (second call returns only new events).

### Phase 3: Tool approval + send message
**Goal:** Claude Code can approve/reject tool calls and inject messages into running sessions.
**Files to create/modify:**
- `src/api.js` — `approveTool(sessionId, toolCallId, approved, overrideInput?)` and `sendMessage(sessionId, message)`.
- `src/server.js` — wire `approve_tool` and `send_message` tools; validate that the session exists in the Map before calling the API.
**Key steps:**
1. `approve_tool` with `approved: false` must send a rejection payload (not just skip the call).
2. `send_message` is fire-and-forget for MVP; the effect is visible on the next `stream_activity` poll.
3. If the session doesn't exist in the local Map (e.g., after a bridge restart), return a clear "session not found in local state — it may still be running on the server; check the Managed Agents console" error rather than a cryptic API failure.
**Verify:** Start an agent that requires tool approval; poll until a `waiting_for_approval` event appears; call `approve_tool` with the event's `tool_call_id`; poll again and confirm the agent proceeds; test `approved: false` and confirm the agent receives a rejection.

### Phase 4: Claude Code config + README
**Goal:** The bridge installs with one command and works from Claude Code out of the box.
**Files to create/modify:**
- `README.md` — what it does (one paragraph), install command, the `settings.json` snippet to add it to Claude Code, the 5 tool descriptions with example Claude prompts, a note on the `ANTHROPIC_API_KEY` requirement.
- `settings.json.example` — the exact block to paste into `~/.claude/settings.json`.
**Key steps:**
1. The README example prompts should show how to chain the tools naturally: "start agent X with message Y, then check its progress, then approve the tool call".
2. Note that agent IDs come from the Managed Agents console — include a link.
3. Document the restart limitation (session handles are lost on bridge restart) so the user knows to keep the bridge process running during a session.
**Verify:** Follow the README from scratch on a clean machine; confirm the bridge connects to Claude Code and the first `spawn_agent` call succeeds within 5 minutes of reading the README.

## Estimated Effort

**1 Claude Code session.**
- The Managed Agents API is documented and the MCP SDK pattern is well-established; the entire server is ~200 lines of JS across 4 files. Phases 1–3 can ship in a single focused session; Phase 4 (README polish) adds an hour at most.

## Potential Blockers

- **Managed Agents API is in beta.** The endpoint paths, authentication headers, and event schema could change without notice. Pin the `@anthropic-ai/sdk` version and add a `CHANGELOG.md` note about the beta status. If the API changes, it's a 1-file fix in `src/api.js`.
- **Session handle loss on restart.** If the bridge process restarts (shell exit, crash), the local `Map` is gone. The Managed Agent may still be running server-side but is no longer controllable from the bridge. Mitigation for MVP: persist the Map to a tiny `.sessions.json` file in the package dir so it survives restarts.
- **Rate limits on the events endpoint.** Polling `stream_activity` in a tight loop could hit API rate limits. Add a minimum 1-second delay between polls (configurable via `POLL_INTERVAL_MS` env var); document this so Claude doesn't call the tool in a tight loop.
- **Tool approval timeouts.** Managed Agent sessions may timeout waiting for approval if the user takes too long to respond. Surface the `waiting_since` timestamp in the `stream_activity` output so Claude can warn the user if approval is overdue.
- **MCP stdio transport and long-running calls.** MCP tool calls are expected to return quickly; a `stream_activity` call that waits for new events (long-poll style) can stall the MCP client. Use short-poll (return immediately with buffered events) rather than blocking wait. If no new events, return `{ events: [], latest_event_id }` — Claude will poll again on its next turn.

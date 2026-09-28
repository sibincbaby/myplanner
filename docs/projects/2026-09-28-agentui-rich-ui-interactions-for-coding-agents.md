# AgentUI — Rich Interactive UIs for Coding Agents

**Source:** <https://github.com/skulitom/AgentUI>
**Discovered:** 2026-09-28
**Viability:** 4/4

> Coding agents currently ask free-form questions and guess at parameter values. AgentUI gives them a second channel: a real UI — sliders, checkboxes, diff views, live previews — that opens while the agent is working. The user interacts with the form; the agent reads the result. No more "please enter the port number as an integer in your next message."

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

**Weekend-buildable (1):** An MCP server exposing three tools (`ui_ask`, `ui_create`, `ui_close`) and a local HTTP + WebSocket server serving a sandboxed React frontend is 400–600 lines of TypeScript. The upstream repo has 18 commits and 0 stars — it was published days ago. An independent MVP that covers 80% of the surface area is a one-session build.

**Fills a gap (1):** Every Claude Code, Cursor, and Gemini CLI session that involves parameters (port numbers, thresholds, feature flags, colour palettes, model choices) works around the problem with free-form Q&A today. A blocking `ui_ask` with typed widgets directly removes the workaround for the most common cases.

**Novel (1):** Bot UIs and chat-embedded forms exist; an MCP-native tool that blocks agent execution until the user fills out a sandboxed form does not have a widely-used OSS equivalent. The closest prior art is Claude's own artifact renderer — which the agent cannot read back from.

**Daily utility (1):** Fires on every parameter-collection moment in a session. Not a once-a-week tool; more useful the more agentic the workload.

---

## Implementation Plan

### Overview

AgentUI works as a locally-running MCP server. The agent calls `ui_ask` or `ui_create`; the server opens a browser tab (or WebSocket-connected panel) showing the form; the user interacts; the server unblocks the tool call and returns the collected values. The protocol is:

```
agent → MCP stdio → AgentUI server (HTTP + WS)
                         ↓
                    browser tab / panel
                         ↓ (user submits)
                    MCP tool result → agent
```

### Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (Node ≥22) | MCP SDK is first-class TS; upstream is TS |
| MCP transport | stdio | Standard; works in all agents |
| Frontend | React 18 (Vite, single ESM bundle) | Lightweight; sandboxed in iframe |
| Server | Hono on Node HTTP | Minimal; upstream uses Hono |
| WebSocket | `ws` npm package | Simple long-poll for `ui_wait` |
| Widgets | shadcn/ui (Tailwind) | Accessible; covers sliders, selects, diffs |
| Security | Loopback-only bind (127.0.0.1) | No LAN exposure by default |

### MVP Scope

**In:**

1. **`ui_ask` tool:** Takes a `question` string, optional `type` (`text` | `number` | `boolean` | `select`), and optional `choices`. Opens a minimal browser tab, blocks until the user submits, returns the value. Timeout after 120 s; returns an error string rather than hanging forever.

2. **`ui_create` tool:** Takes a JSON `schema` describing a form (field name → widget spec: slider with min/max/step, checkbox, text, select). Opens the form; returns the submitted object when the user clicks "Send to agent". Does not block on `ui_wait` — that is Phase 3.

3. **`ui_close` tool:** Closes the currently open panel. Called by the agent when it no longer needs input.

4. **Auto-detection + registration:** On `npx agentui init`, detect which agents are installed (check `~/.claude/`, `~/.cursor/`, Gemini CLI config) and write the MCP server entry into each one.

**Out of v1:** `ui_wait` long-polling, `ui_update` live mutation, `ui_save`/`ui_library` widget reuse, LAN mode with token auth.

### Phases

**Phase 1 — MCP server skeleton + `ui_ask` (2 h).** Scaffold a Node.js MCP server with the `@modelcontextprotocol/sdk` package. Implement `ui_ask` as a blocking tool call: start an HTTP server on a random free port, open the URL in the default browser, serve a minimal React form, wait for POST, return value, close server. Test: call `ui_ask` from `claude mcp call`.

**Phase 2 — `ui_create` with full widget types (2 h).** Implement the JSON schema → React form renderer. Cover six widget types: text, number, boolean (checkbox), slider (min/max/step), select (enum), and textarea. The form renders in a sandboxed iframe from an inline HTML string; no CDN fetches. Test: agent asks for a config object with port (number), log-level (select), and debug (boolean).

**Phase 3 — `ui_close` + timeout handling (1 h).** Add `ui_close`. Add a 120-second timeout to `ui_ask` and `ui_create` that returns `{ error: "timed_out" }` rather than blocking. Add a "skip" button to the form that also returns `{ skipped: true }`.

**Phase 4 — `npx agentui init` auto-registration (1 h).** Detect installed agents by probing known config paths. Write the MCP server entry (`command: "npx agentui"`) into each found config. Print a confirmation list.

**Phase 5 — `ui_wait` long-polling + `ui_update` live mutation (2 h).** Implement `ui_create` as non-blocking: the agent calls `ui_create`, gets back a session ID, continues working, calls `ui_wait` to block until the user changes a field, and calls `ui_get_state` to read current values without blocking. This enables agents to react in real-time to user parameter changes — e.g., re-rendering a live preview as the user drags a slider.

**Total effort:** 8 hours, comfortably two sessions. Phases 1–3 alone (5 h) give a production-quality MVP for the blocking-question use case.

### Blockers and Known Ceilings

- **Browser tab opening.** `open`/`xdg-open` launches a tab but the agent can't tell whether the user saw it. The server should print the URL to stderr as a fallback so the user can paste it.
- **Blocking tool calls.** MCP stdio transport allows a tool call to return after an arbitrary delay. Agents that impose per-tool timeouts (some Cursor versions) will fail if the user takes too long. The 120-second timeout (Phase 3) mitigates this; document the agent-specific timeout floor in the README.
- **Sandboxed iframe + CSP.** The form runs in an iframe with `sandbox="allow-scripts"` and a strict CSP. Widgets that require external fonts or icons need to inline them; no CDN references inside the iframe.
- **Parallel sessions.** An agent that spawns subagents may call `ui_create` from multiple agents simultaneously. The server should queue sessions and show them one at a time, or show a tabbed multi-session UI. Leave this for v2.

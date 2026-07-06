# claude-code-by-agents — desktop app for multi-agent Claude Code orchestration

**Source:** <https://github.com/baryhuang/claude-code-by-agents>
**Discovered:** 2026-07-07
**Viability:** 3/4

> Multi-agent orchestration + agent-UI + Claude tooling — matches the user's interest in custom agent interfaces and multi-agent systems, and the @mention routing pattern is directly reusable for their own agent-desk experiments.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

weekend_buildable: The MVP is a chat interface that parses @mentions and routes each subtask to the corresponding agent's Claude Code endpoint (local via SDK/CLI, remote via HTTP). The user already has claudecodeui and claw-desk as scaffolding for agent chat UIs, so the routing layer plus a config of named agents is achievable in 1-2 focused sessions. Score 1.

fills_gap: The user has many single-agent interfaces (claw-desk, gravity-claw, lwclaw, linclaw) and claudecodeui, but all are single-agent chat surfaces. None coordinate multiple independent Claude Code agents via @mention routing to fan subtasks across local/remote workers — that is a real missing capability. Score 1.

novel: claudecodeui renders Claude's native subagent tool calls, but that is Claude's own internal Task delegation, not user-defined multi-agent @mention orchestration across separate machines/repos. This is a fresh angle and no dominant polished OSS tool owns it. Score 1.

daily_utility: This is the weak point. Multi-agent fan-out is a power-user pattern the user would reach for on larger orchestration tasks, not something they'd open every single day the way they use a single coding assistant or chat gateway. Most daily coding still happens in one agent/repo context. Score 0.

Total 3, so viable. Strong fit on gap/novelty/buildability given his existing agent-UI scaffolding, but daily-driver stickiness is questionable since multi-agent routing is an occasional-heavy-task workflow rather than a constant one.

---

## Implementation Plan

I now have both the original TypeScript/web architecture (which is the Claude-buildable, reusable pattern matching the user's stack) and the current Swift rewrite. The plan should target a Node/web MVP that reuses the user's existing scaffolding. Here is the implementation plan.

---

## Overview

`claude-code-by-agents` (aka Agentrooms) is a desktop/web app that coordinates multiple Claude Code agents from one chat surface. You type `@frontend fix the login form, then @backend wire up the auth endpoint` and the app parses each `@mention`, resolves it to a named agent (local Claude Code SDK or a remote HTTP endpoint), and routes that subtask to it — running independent agents in parallel or in dependency order, streaming each result back inline.

The upstream repo has since been rewritten in Swift/macOS on top of a proprietary OpenAgents workspace backplane. That path is not Claude-buildable in the user's stack and depends on a third-party hosted service. **This plan instead rebuilds the original, self-contained TypeScript/web architecture** (`@anthropic-ai/claude-code` SDK for local agents + plain HTTP for remote agents), which directly reuses the user's existing `claudecodeui` / `claw-desk` agent-chat scaffolding and its `@mention` routing pattern. No external orchestration service required.

The goal is an MVP the user can run locally: a chat UI, a config of named agents, an `@mention` router, and per-agent streaming execution.

## Stack Recommendation

- **Runtime:** Node.js 20+ / TypeScript (matches the original repo and the user's `claudecodeui`/`claw-desk` work; lets us reuse chat-UI components).
- **Backend:** [Hono](https://hono.dev/) (lightweight, first-class streaming via `streamSSE`) running on Node. A single `POST /api/chat` SSE endpoint plus `GET /api/agents`.
- **Local agent execution:** `@anthropic-ai/claude-code` (the official Claude Code SDK — exposes a `query()` async generator that streams `SDKMessage` objects). Falls back to spawning the `claude` CLI with `--output-format stream-json` if the SDK is unavailable.
- **Remote agent execution:** `fetch` to each remote agent's `POST /api/chat` (same contract), so a remote agent is just another instance of this same server running on another machine/repo.
- **Frontend:** Vite + React + TypeScript. Reuse the user's existing chat components from `claudecodeui`/`claw-desk` where possible. SSE consumed via a `useClaudeStreaming` hook.
- **Config:** a single `agents.json` (git-ignored) defining agent name, type (`local` | `remote`), working directory (local) or base URL (remote).
- **Desktop shell (optional, last phase):** Tauri wrapper so it's a real "desktop app" without shipping Electron.

Rationale: this is the smallest stack that reproduces the load-bearing feature (`@mention` fan-out to heterogeneous Claude Code workers) while staying entirely local and reusing existing scaffolding. Anthropic auth is handled by the Claude Code SDK/CLI's own login — no API key wiring needed for local agents.

## MVP Scope

**In scope:**
- `agents.json` config of named local + remote agents.
- Chat UI: message input, agent list/sidebar, streaming message rendering.
- `@mention` parser that extracts targeted agents and their per-agent subtask text.
- Router: single-mention → direct execution; multi-mention → sequential execution with results from step N passed into step N+1's context (the file-based `/tmp/stepN_results.txt` pattern from the original).
- Local agent execution via Claude Code SDK, streamed as SSE.
- Remote agent execution via HTTP to a peer server.
- Streaming protocol with `claude_json` / `error` / `done` / `aborted` message types.

**Out of scope for MVP:** the OpenAgents workspace backplane, generative UI specs, adaptive polling, iMessage-style multi-pane native UI, multi-user workspaces, persistent thread history DB (in-memory + localStorage is fine).

## Implementation Phases

### Phase 1: Backend skeleton + agent config + local Claude Code execution
**Goal:** A running Hono server that, given a single agent name and a prompt, streams that agent's Claude Code output over SSE.
**Files to create/modify:**
- `package.json` — deps: `hono`, `@hono/node-server`, `@anthropic-ai/claude-code`, `zod`, `typescript`, `tsx`.
- `backend/app.ts` — Hono app, `@hono/node-server` bootstrap on port 8787.
- `backend/config/agents.ts` — loads and validates `agents.json` with a zod schema.
- `agents.example.json` — sample config; real `agents.json` git-ignored.
- `backend/runtime/local.ts` — wraps `@anthropic-ai/claude-code`'s `query()`; yields normalized `StreamResponse` chunks.
- `shared/types.ts` — `AgentConfig`, `StreamResponse` (`{type: 'claude_json'|'error'|'done'|'aborted', data?}`), `ChatRequest`.
- `.gitignore` — add `agents.json`, `node_modules`, `dist`.

**Key steps:**
1. `npm init`, install deps, add `tsconfig.json` (`"module": "ESNext"`, `"moduleResolution": "bundler"`).
2. Define the zod schema: each agent has `name`, `type: 'local'|'remote'`, and either `cwd` (local) or `baseUrl` (remote); optional `model`.
3. In `runtime/local.ts`, call `query({ prompt, options: { cwd, permissionMode: 'bypassPermissions', model } })` and `for await` over messages, mapping each `SDKMessage` to `{type:'claude_json', data: msg}`; emit `{type:'done'}` at the end, `{type:'error'}` on throw.
4. In `app.ts`, add `GET /api/agents` (returns config minus secrets) and a `POST /api/chat` that, for now, accepts `{agentId, message}`, looks up the agent, and if local streams `runtime/local.ts` via Hono's `streamSSE`.
5. Add npm scripts: `"dev:server": "tsx watch backend/app.ts"`.

**Verify:** `npm run dev:server`, then `curl -N -X POST localhost:8787/api/chat -H 'content-type: application/json' -d '{"agentId":"local-main","message":"list files in this repo"}'` streams `data: {"type":"claude_json",...}` lines ending in `{"type":"done"}`. `curl localhost:8787/api/agents` returns the agent list.

### Phase 2: @mention parser + routing (single and multi-agent)
**Goal:** `POST /api/chat` accepts a raw message, extracts `@mentions`, and routes each subtask to the right agent — single mention runs directly, multiple mentions run sequentially with prior results injected.
**Files to create/modify:**
- `backend/routing/mentions.ts` — parser: given message text + known agent names, returns ordered `[{agentId, task}]` segments.
- `backend/handlers/chat.ts` — orchestration: single-agent fast path vs. multi-agent sequential loop.
- `backend/runtime/remote.ts` — stub (real impl in Phase 3): `fetch(baseUrl + '/api/chat')` and re-yield its SSE stream.
- `backend/app.ts` — wire `POST /api/chat` to `handlers/chat.ts`.

**Key steps:**
1. Parser: regex `/@([a-zA-Z0-9_-]+)/g`; match only against configured agent names; split the message so each agent gets the text following its mention up to the next mention (e.g. `@frontend do X, then @backend do Y` → `[{frontend, "do X, then"}, {backend, "do Y"}]`).
2. Single mention (or none → default agent): call the agent's runtime directly and stream through (Phase 1 behavior).
3. Multi mention: loop agents in order. Before agent N runs, read `/tmp/step{N-1}_results.txt` (if present) and prepend it as context to agent N's prompt; after each agent completes, write its concatenated text output to `/tmp/step{N}_results.txt`.
4. Tag each SSE chunk with `agentId` so the frontend can attribute output to the right agent.
5. Emit a synthetic `{type:'claude_json', data:{role:'system', text:'Routing to @backend...'}}` marker between agents for UI clarity.

**Verify:** `curl -N -X POST localhost:8787/api/chat -d '{"message":"@local-main say hello then @local-main count to 3"}'` streams two attributed agent turns in order; confirm `/tmp/step1_results.txt` is created between turns.

### Phase 3: Remote agent execution
**Goal:** An `@mention` targeting a `type:'remote'` agent forwards the subtask over HTTP to a peer server and streams its output back inline, indistinguishable from a local agent in the UI.
**Files to create/modify:**
- `backend/runtime/remote.ts` — full implementation.
- `backend/config/agents.ts` — validate `baseUrl` + optional `authToken` for remote agents.
- `docs/remote-setup.md` — how to run a second instance as a remote worker.

**Key steps:**
1. In `remote.ts`, `POST ${baseUrl}/api/chat` with `{agentId: <remote's local id>, message: task}` and header `Authorization: Bearer ${authToken}` if set.
2. Read the response body as a stream, parse SSE lines back into `StreamResponse` objects, and re-yield them (re-tagging `agentId` to the local mention name).
3. Handle remote failures: on non-2xx or network error, emit `{type:'error', data:{agentId, message}}` and continue to the next agent rather than aborting the whole run.
4. Add a lightweight shared-secret check middleware on `/api/chat` (skip if no token configured) so a remote worker can require auth.
5. Document running instance B with `PORT=8788` and its own `agents.json`, then registering it in instance A's config as `{name:'remote-b', type:'remote', baseUrl:'http://host:8788'}`.

**Verify:** Start two servers (ports 8787/8788). Against 8787: `curl -N -X POST localhost:8787/api/chat -d '{"message":"@remote-b list files"}'` streams the second instance's Claude Code output through the first server.

### Phase 4: Frontend chat UI with streaming + agent attribution
**Goal:** A browser chat interface where you type `@mention` messages, see an agent sidebar, and watch each agent's streamed response render inline attributed to that agent.
**Files to create/modify:**
- `frontend/` (Vite React scaffold) — `index.html`, `src/main.tsx`, `vite.config.ts` (proxy `/api` → `localhost:8787`).
- `frontend/src/App.tsx` — layout: agent sidebar + thread + input.
- `frontend/src/hooks/useClaudeStreaming.ts` — `fetch('/api/chat')` reading the SSE body stream, dispatching parsed `StreamResponse` chunks.
- `frontend/src/hooks/useMessageProcessor.ts` — accumulates `claude_json` chunks into rendered messages grouped by `agentId`.
- `frontend/src/components/AgentSidebar.tsx`, `MessageList.tsx`, `MentionInput.tsx` — reuse `claudecodeui`/`claw-desk` components where available.

**Key steps:**
1. Scaffold Vite React TS; set the dev proxy so the frontend calls the backend without CORS config.
2. `MentionInput`: on `@`, show an autocomplete popover of agents from `GET /api/agents`; insert `@name`.
3. `useClaudeStreaming`: POST the message, read `response.body.getReader()`, split on `\n\n`, `JSON.parse` each `data:` line, and push chunks to a callback.
4. `useMessageProcessor`: map incoming chunks to message bubbles keyed by `agentId`; render assistant text, tool_use blocks (name + collapsed input), and errors distinctly.
5. Render the system routing markers ("Routing to @backend…") as thin dividers between agent turns.

**Verify:** `npm run dev` (frontend) + backend running; open the browser, type `@local-main summarize the README then @local-main list 3 improvements`, and watch two attributed streaming turns appear. Confirm the mention autocomplete lists configured agents.

### Phase 5 (optional): Tauri desktop shell + parallel fan-out
**Goal:** Ship it as a real desktop app and let independent (non-dependent) mentions run in parallel instead of strictly sequentially.
**Files to create/modify:**
- `src-tauri/` — Tauri config wrapping the Vite frontend; sidecar-spawn the Node backend.
- `backend/handlers/chat.ts` — parallel execution mode.
- `backend/routing/mentions.ts` — detect dependency keywords ("then", "after") vs. independent mentions.

**Key steps:**
1. `npm create tauri-app`, point `build.frontendDist` at the Vite build, add the Node server as a Tauri sidecar binary (bundled via `pkg` or run as a spawned process).
2. In routing, if mentions are joined by "then"/"after" keep sequential + file-passing; otherwise run agents concurrently with `Promise` fan-out, interleaving their SSE chunks (each already tagged by `agentId`).
3. Merge concurrent streams into the single SSE response, flushing chunks as they arrive from any agent.

**Verify:** `npm run tauri dev` opens a native window running the full app; `@local-main task A and @remote-b task B` (no "then") shows both agents streaming simultaneously with interleaved, correctly-attributed output.

## Estimated Effort

**3–4 Claude Code sessions** (1 session ≈ 2–4 hours).

- **Session 1 — Phases 1 & 2:** Backend skeleton, `agents.json`, local Claude Code SDK streaming, and the `@mention` parser + sequential router with file-based result passing. This is the core and the highest-value slice.
- **Session 2 — Phases 3 & start of 4:** Remote HTTP agent execution + auth, then scaffold the frontend and the streaming hooks.
- **Session 3 — Finish Phase 4:** Full chat UI, mention autocomplete, per-agent attribution, tool-call rendering; wire everything end-to-end.
- **Session 4 (optional) — Phase 5:** Tauri packaging and parallel fan-out. Skippable if a browser-based tool is acceptable.

A usable MVP exists after Session 1 (curl-driven) and is genuinely usable after Session 3.

## Potential Blockers

- **Claude Code SDK API surface:** `@anthropic-ai/claude-code`'s `query()` signature and `SDKMessage` shape change across versions. Pin a known version and verify the streaming generator contract before building routing on top of it; keep the CLI-spawn (`claude -p --output-format stream-json`) fallback ready if the SDK path misbehaves.
- **Auth for local agents:** The SDK/CLI uses whatever `claude` login is on the machine. If the environment isn't logged in (or only has an API key), local execution fails silently. Verify `claude` runs interactively first; surface a clear "agent not authenticated" error in the UI.
- **`permissionMode`:** Running Claude Code non-interactively requires bypassing permission prompts (`bypassPermissions` / `--dangerously-skip-permissions`). This means agents can execute tools against real repos — scope each agent's `cwd` carefully and note the risk in `docs/`.
- **SSE proxying for remote agents:** Re-streaming a remote SSE body through the local server needs correct chunk buffering (split on `\n\n`, handle partial frames across reads). Naive line-splitting will corrupt multi-line JSON payloads.
- **The `/tmp/stepN_results.txt` hand-off** is machine-local — it does **not** work across remote agents on different machines. For MVP, dependency chaining that spans a remote agent must pass prior results in the prompt body instead of via the shared file. Handle this explicitly in the multi-agent loop.
- **Concurrent-stream interleaving (Phase 5):** Merging multiple agents' SSE into one response can race; every chunk must carry `agentId` and the frontend must not assume ordering. This is the main complexity spike if parallel mode is attempted.
- **No external blocker otherwise:** unlike the upstream Swift rewrite, this plan avoids the OpenAgents workspace backplane and `agent-connector` dependency entirely, so there is no third-party hosted service or token provisioning to gate the build.

# Hindsight – Agent Memory That Learns

**Source:** <https://github.com/vectorize-io/hindsight>
**Discovered:** 2026-09-30
**Viability:** 3/4

> Every agent UI project the user builds runs into the stateless-agent problem. Hindsight's MCP server means Claude can call into it directly — add persistent cross-session memory to any claude-based tool by pointing to this server. The opinion-network (subjective beliefs + confidence) is a novel pattern worth borrowing architecturally.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

Hindsight ships a ready-made MCP server targeting Claude integration, so the user's work is integration rather than building from scratch — that's squarely weekend-buildable. The user builds multiple custom agent interfaces (openclaw, claw-desk variants) and Claude wrappers, none of which appear to have persistent cross-session memory; this fills a real architectural gap. The four-network belief system with confidence scoring is meaningfully different from simple vector-search memory stores like mem0 — the LongMemEval result backs that up. Daily utility is the weak point: Hindsight is infrastructure middleware, not something actively opened each day. Once embedded in an agent UI, it silently improves sessions, but the user doesn't "use" it the way they'd use a coding assistant or finance tracker. Still, three strong criteria make this a genuine fit given how much of the user's work centers on building better Claude agent experiences.

---

## Implementation Plan

## Overview

Hindsight is an open-source agent memory middleware that gives Claude four logical memory networks (world knowledge, experience, observation, opinion) with confidence-scored belief updates. It ships a ready-made MCP server, so the integration work is pointing your existing Claude-based tools at the server and wiring the memory read/write calls into agent sessions. The result: any agent UI you build (openclaw variants, claw-desk, etc.) gains cross-session persistent memory with no custom vector-store work.

This plan builds a local Hindsight MCP service, wraps it with a thin management CLI, and integrates it into a new "memory-aware" agent session harness that your other Claude tools can import.

---

## Stack Recommendation

- **Hindsight server**: Python (ships as `pip install hindsight-mcp` or clone + `uv run`)
- **Storage backend**: SQLite (zero-ops, file-local) for MVP; swap to PostgreSQL later
- **MCP client harness**: Node.js (matches your existing claude-wrapper patterns) using `@anthropic-ai/sdk` with MCP tool injection
- **Management CLI**: Node.js / TypeScript with `commander` — lists, inspects, and prunes memory networks
- **Config layer**: a single `hindsight.config.json` per agent project that names the agent identity and the Hindsight server socket/port

---

## MVP Scope

1. Hindsight MCP server running locally, persisting to SQLite
2. A reusable `HindsightClient` class (TypeScript) that wraps the MCP transport and exposes `recall()`, `remember()`, `believe()`, and `observe()` typed helpers
3. A standalone demo agent (Node.js CLI chat loop) that uses `HindsightClient` to carry memory across restarts
4. A `hindsight-admin` CLI to inspect and prune each of the four memory networks
5. A documented drop-in pattern for wiring `HindsightClient` into an existing Claude agent session

Out of scope for MVP: multi-agent shared memory, web UI, cloud sync, auth/ACL.

---

## Implementation Phases

### Phase 1: Hindsight Server Setup and Smoke-Test

**Goal:** The Hindsight MCP server is running locally, storing to SQLite, and responding to a raw MCP `tools/list` call.

**Files to create/modify:**
- `hindsight/server/install.sh` — idempotent setup script (pyenv/uv + pip install)
- `hindsight/server/start.sh` — launches the server on a fixed port (default 9337) with the SQLite path set
- `hindsight/server/hindsight.db` — created on first run (do not commit)
- `.gitignore` — add `hindsight/server/hindsight.db`

**Key steps:**
1. Clone the upstream repo: `git clone https://github.com/vectorize-io/hindsight /tmp/hindsight-src` and read `README.md` plus `pyproject.toml` to confirm the install command and environment variables.
2. In `hindsight/server/install.sh`, write: `pip install hindsight-mcp` (or `uv pip install hindsight-mcp` if the project uses uv). Pin the version found in pyproject.toml.
3. In `hindsight/server/start.sh`, export `HINDSIGHT_DB_PATH=$(pwd)/hindsight/server/hindsight.db` and `HINDSIGHT_PORT=9337`, then call the server entry point (e.g. `python -m hindsight.server` or `hindsight-mcp serve --port $HINDSIGHT_PORT`).
4. Run `bash hindsight/server/start.sh &` and issue `curl -s -X POST http://localhost:9337/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | jq .result.tools[].name` to list available tools.
5. Confirm the four memory-network tool groups appear (world, experience, observation, opinion).

**Verify:** `curl` command above returns a JSON array that includes at least one tool name containing `world`, `experience`, `observation`, and `opinion`.

---

### Phase 2: TypeScript HindsightClient

**Goal:** A typed `HindsightClient` class importable by any Node.js agent project, with tested `recall`, `remember`, `observe`, and `believe` methods that round-trip through the live server.

**Files to create/modify:**
- `hindsight/client/package.json` — `name: @local/hindsight-client`, deps: `zod`, `node-fetch` or native `fetch`
- `hindsight/client/tsconfig.json` — `module: commonjs`, `target: ES2022`, `strict: true`
- `hindsight/client/src/HindsightClient.ts` — main class
- `hindsight/client/src/types.ts` — Zod schemas for Memory, BeliefUpdate, RecallResult
- `hindsight/client/src/index.ts` — barrel export
- `hindsight/client/tests/integration.test.ts` — Jest integration test against running server

**Key steps:**
1. In `types.ts`, define Zod schemas mirroring the Hindsight MCP tool input/output shapes found in Phase 1's `tools/list` response (read the `inputSchema` of each tool).
2. In `HindsightClient.ts`, implement the constructor: `new HindsightClient({ agentId: string, serverUrl: string })`. `agentId` namespaces all memory entries so multiple agents share one server without collision.
3. Implement `recall(query: string, network?: 'world'|'experience'|'observation'|'opinion'): Promise<RecallResult[]>` — calls the MCP `tools/call` endpoint with method name matching the upstream tool name, injects `agentId` into params.
4. Implement `remember(content: string, network: 'world'|'experience', confidence?: number): Promise<void>` for factual/episodic writes.
5. Implement `observe(content: string): Promise<void>` and `believe(claim: string, confidence: number): Promise<void>` for the observation and opinion networks.
6. In `integration.test.ts`, assert: store a belief with confidence 0.9, recall it, confirm it appears with confidence >= 0.9.
7. Run `pnpm --filter @local/hindsight-client test` and confirm all assertions pass.

**Verify:** `pnpm --filter @local/hindsight-client test` exits 0 with all integration tests green.

---

### Phase 3: Memory-Aware Demo Agent

**Goal:** A CLI chat agent that uses `HindsightClient` to remember facts across restarts — kill it, restart it, and it recalls what was said in the previous session.

**Files to create/modify:**
- `hindsight/demo-agent/package.json` — deps: `@anthropic-ai/sdk`, `@local/hindsight-client`, `readline`, `chalk`
- `hindsight/demo-agent/src/agent.ts` — main chat loop
- `hindsight/demo-agent/src/memoryHooks.ts` — pre/post-turn memory injection logic
- `hindsight/demo-agent/hindsight.config.json` — `{ "agentId": "demo", "serverUrl": "http://localhost:9337" }`

**Key steps:**
1. In `agent.ts`, open a `readline` loop. Before sending each user turn to Claude, call `client.recall(userInput)` and prepend the top-3 results as a `<memory>` XML block in the system prompt.
2. After Claude replies, extract any named facts (simple heuristic: sentences containing "my name is", "I am", "I work at", "I prefer") and call `client.remember(sentence, 'experience', 0.85)`.
3. For subjective statements ("I think", "I believe", "I feel"), call `client.believe(sentence, 0.75)`.
4. Persist the full conversation turn to the observation network: `client.observe(JSON.stringify({user, assistant}))`.
5. On startup, call `client.recall("session start context")` and print retrieved memories to confirm prior context loaded.
6. Add a `!memory` slash command that prints the last 10 recalled items for debugging.

**Verify:** Start agent, say "My name is Alex and I work at Acme Corp". Kill with Ctrl-C. Restart. Type "What do you know about me?" — Claude should answer with name and employer from memory without them being in the current conversation.

---

### Phase 4: hindsight-admin CLI

**Goal:** A standalone `hindsight-admin` CLI that lists, searches, and prunes each of the four memory networks for any registered agent.

**Files to create/modify:**
- `hindsight/admin-cli/package.json` — `bin: { "hindsight-admin": "dist/index.js" }`, deps: `commander`, `chalk`, `@local/hindsight-client`
- `hindsight/admin-cli/src/index.ts` — commander program root
- `hindsight/admin-cli/src/commands/list.ts` — `hindsight-admin list --agent <id> --network <n>`
- `hindsight/admin-cli/src/commands/search.ts` — `hindsight-admin search <query> --agent <id>`
- `hindsight/admin-cli/src/commands/prune.ts` — `hindsight-admin prune --agent <id> --confidence-below 0.3`
- `hindsight/admin-cli/src/commands/stats.ts` — `hindsight-admin stats` — entry count per network per agent

**Key steps:**
1. In `list.ts`, call `client.recall("", network)` with an empty or wildcard query to dump recent entries; format as a table using `chalk` column alignment.
2. In `prune.ts`, call the Hindsight MCP delete/update tool (check `tools/list` output for the correct method name) for each entry with confidence below the threshold; print count of pruned items.
3. In `stats.ts`, query all four networks with an empty query and count results per network; display as a two-column table.
4. Link the package: `pnpm link --global` or add to workspace root `pnpm-workspace.yaml`.
5. Run `hindsight-admin stats --agent demo` after Phase 3 test to confirm non-zero entry counts.

**Verify:** `hindsight-admin list --agent demo --network experience` prints at least the "Alex / Acme Corp" entry stored in Phase 3.

---

### Phase 5: Drop-In Integration Pattern and Workspace Wiring

**Goal:** A documented, copy-pasteable `withMemory(agentConfig)` wrapper that adds Hindsight to any existing Claude agent session in the workspace with three lines of code.

**Files to create/modify:**
- `hindsight/integration/src/withMemory.ts` — higher-order function wrapping a Claude `Messages.create` call
- `hindsight/integration/src/systemPromptBuilder.ts` — injects recalled memories as a structured XML block
- `hindsight/integration/src/autoStore.ts` — post-turn classifier that stores facts/beliefs/observations
- `hindsight/integration/package.json` — `name: @local/with-memory`
- `hindsight/integration/INTEGRATION.md` — step-by-step guide with before/after code diff
- `pnpm-workspace.yaml` — add `hindsight/client`, `hindsight/admin-cli`, `hindsight/integration`, `hindsight/demo-agent`

**Key steps:**
1. `withMemory(config)` returns a wrapped `create` function. Before forwarding to `anthropic.messages.create`, it calls `systemPromptBuilder.inject(params, recalled)` to prepend a `<hindsight_memory>` block to the system prompt.
2. After the API call, it calls `autoStore.classify(userTurn, assistantReply, client)` — a lightweight regex+heuristic pass that routes content to the right network.
3. `autoStore.ts` should be table-driven: an array of `{ pattern: RegExp, network, confidence }` rows, making it easy to extend.
4. In `INTEGRATION.md`, show the before/after diff for adding `withMemory` to a fictional `openclaw` agent: import, wrap, done.
5. Update `pnpm-workspace.yaml` to include all four new packages so `pnpm install` from root resolves local deps.
6. Run `pnpm install` from workspace root; confirm no unmet peer deps.

**Verify:** In the demo agent, replace the manual `recall`/`remember` calls in `agent.ts` with `withMemory` and confirm the Phase 3 cross-restart test still passes.

---

## Estimated Effort

**3 Claude Code sessions (1 session ≈ 2-4 hours of Claude work)**

- **Session 1**: Phases 1 + 2 — server install, smoke-test, and the full `HindsightClient` TypeScript class with passing integration tests. The bulk of the work is reading the upstream MCP tool schemas and translating them into typed Zod models.
- **Session 2**: Phases 3 + 4 — demo agent with memory hooks and the admin CLI. The cross-restart memory proof-of-concept is the milestone that validates the whole stack end-to-end.
- **Session 3**: Phase 5 — the `withMemory` abstraction, workspace wiring, and integration guide. Finishing with documentation means the pattern is genuinely reusable across openclaw/claw-desk variants without re-reading the code.

---

## Potential Blockers

- **MCP transport protocol version**: Hindsight's server may use SSE or WebSocket transport rather than plain HTTP JSON-RPC. Check the upstream `README.md` and adjust `HindsightClient` to use the matching transport (the `@modelcontextprotocol/sdk` Node client handles both, but the URL scheme differs: `http://` for HTTP, `sse://` for SSE).
- **Upstream tool name instability**: The project is actively developed. The tool names returned by `tools/list` in Phase 1 are the ground truth — do not hard-code names from the GitHub README, which may lag behind the packaged version.
- **Python environment conflicts**: If the system Python is 3.9 or below, Hindsight may require 3.11+. Use `pyenv install 3.11.9 && pyenv local 3.11.9` inside `hindsight/server/` before running the install script.
- **SQLite write-ahead locking**: If multiple agents share one server process and issue concurrent writes, SQLite WAL mode must be enabled. Add `PRAGMA journal_mode=WAL;` to the Hindsight config or the start script if the upstream server exposes a DB init hook.
- **agentId namespacing not natively supported**: Hindsight may not have a built-in agentId field. Inspect the tool schemas — if absent, the `HindsightClient` must prepend `[agentId]` to every content string and filter on recall, making the isolation a client-side convention rather than a server guarantee.
- **autoStore false positives**: The regex classifier in Phase 5 will over-store on verbose conversations. Plan a `minConfidence` threshold (default 0.6) below which facts are discarded; tune it in Session 3 once you have real conversation data from Session 2.

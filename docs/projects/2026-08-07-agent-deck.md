# agent-deck — Web UI to Orchestrate Multiple AI Coding Agents

**Source:** [claude-world/agent-deck](https://github.com/claude-world/agent-deck) · GitHub topics (claude-code, MCP), updated Aug 7 2026
**Language:** Node.js 20+ (Express + WebSocket) · React 18 + Tailwind + Vite · MIT
**Date discovered:** 2026-08-07

## What it is

A web-based command center for running multiple AI coding agents in parallel. You describe a task in plain English; an AI architect agent decomposes it into a DAG of sub-tasks (using Kahn's topological sort), spawns individual agents for each node, and streams their output in real time. Agents complete earlier stages before depending nodes begin. A "git finalize" step commits and summarises all changes when the DAG is done.

The system is model-agnostic: each agent slot can be Claude Code CLI, LiteLLM HTTP/SSE, or Codex CLI. Agent teams are defined as YAML — roles like `planner`, `implementer`, `tester` each declare their own model.

**Why it matters:** The repo has 4 commits and 3 stars — it was built in a weekend by a single developer and shared today. It proves the concept is simple enough to close in one session. The DAG + multi-stream UI is not covered by existing tools in the backlog.

## Why it fits

- Core interest: **agent UIs** — web-based command center for agent orchestration
- Core interest: **Claude/LLM tooling** — Claude Code CLI is a first-class backend
- Core interest: **dev productivity** — decompose a task once, let parallel agents finish it while you do other things
- `weekend_buildable = 1`: upstream has 4 commits; the whole thing was clearly built in a day
- `novel = 1`: only 3 stars, the DAG-first decomposition UI is not a clone of anything in the backlog

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Upstream was built in a single session; a personal version is the same or simpler |
| fills_gap | 1 | No DAG-based multi-agent web UI anywhere in the existing project backlog |
| novel | 1 | 3 stars, 4 commits — genuinely first-mover territory |
| daily_utility | 1 | Decompose big refactors, multi-file migrations, or spec-to-code tasks every working day |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Backend:   Node.js 20+ / Express / ws (WebSocket)
Storage:   better-sqlite3 — sessions, DAG state, agent outputs
DAG:       Kahn's topological sort (one function, ~30 lines)
Frontend:  React 18 + Vite + Tailwind CSS + Zustand
DAG viz:   React Flow (free tier)
Agents:    child_process.spawn → claude -p --output-format stream-json --verbose
           or: LiteLLM HTTP SSE for anything not Claude Code
```

One design choice to make upfront: whether to proxy agent streams through the server (simpler, single WS connection to client) or let the browser open separate EventSource connections per agent (more complex auth, but lower server overhead). For a personal tool, proxy through the server.

## MVP Scope (1 Claude session)

1. Single Express server with a `/sessions` REST endpoint and a single `/ws` WebSocket
2. Accept a plain-text task description via the web UI; call Claude with a brief "decompose into 3-5 tasks with dependencies" system prompt; parse the JSON response into a DAG
3. Execute tasks level-by-level (parallel within a level): spawn `claude -p --output-format stream-json` per task, forward each event to the WS tagged with `{taskId, event}`
4. React frontend renders: task cards (status badge, agent name, running time), a React Flow DAG, and a per-task output panel
5. Persist the session to SQLite; allow re-opening a completed session

## Phases

### Phase 1: DAG Engine + Claude Decomposition (2-3h)
- Build the topological-sort executor: accept `{id, deps, command}[]`, run level by level
- Wrap Claude as an agent: `spawnAgent(prompt) → AsyncIterator<events>`
- Call Claude once with the task + a JSON decomposition schema; parse output into DAG nodes
- Unit test: three tasks A→B→C, confirm B only starts after A completes
- Verify: decompose "add dark mode to a Next.js app" → sensible sub-tasks with correct dep ordering

### Phase 2: WebSocket Streaming Server (2h)
- Express + `ws`: single `/ws` endpoint; sessions identified by UUID
- On each agent event, broadcast `{sessionId, taskId, type, data}` to all clients in that session
- Store completed agent output in SQLite (`sessions`, `tasks`, `events` tables)
- Verify: two browser tabs open the same session and both receive the same stream in real time

### Phase 3: React Dashboard (3-4h)
- Session list → create new / reopen existing
- Task decomposition form: text area + "Decompose & Run" button
- React Flow canvas: nodes coloured by status (queued/running/done/error); edges from dep graph
- Right-panel: click a task node to stream its agent output in real time
- Cost tracker: accumulate `total_cost_usd` from agent result events, show per-task and session total
- Verify: full decompose → run → view flow for a 4-task DAG with one parallel pair

### Phase 4: Git Finalize + Agent YAML (2h)
- "Finalize" button: spawn a summariser agent (`git diff HEAD` → commit message + PR description)
- Agent team YAML: `~/.agent-deck/teams/default.yaml` — map role names to model/CLI choices
- Support two backends: `claude` (spawn CLI) and `litellm` (HTTP SSE to localhost LiteLLM proxy)
- Verify: run a team with planner=claude, implementer=codex, confirm both stream to the same UI

### Phase 5: Polish + Persistence (1-2h)
- Resume a session from SQLite: replay completed events from DB, pick up pending tasks live
- Keyboard shortcut `Ctrl+K` to open session switcher
- `~/.agent-deck/history.db` — retention policy: keep last 30 sessions
- Verify: close the browser mid-session, reopen, confirm pending tasks continue

## Effort Estimate

| Phase | Hours |
|-------|-------|
| DAG Engine + Decomposition | 2-3h |
| WebSocket Streaming Server | 2h |
| React Dashboard | 3-4h |
| Git Finalize + Agent YAML | 2h |
| Polish + Persistence | 1-2h |
| **Total** | **10-13h (~1-2 weekends)** |

Phases 1-3 deliver a fully working multi-agent dashboard in **7-9h (one weekend)**.

## Blockers / Risks

- Claude Code's `--output-format stream-json` schema is not an API guarantee — field names have shifted across versions. Parse defensively and pin the Claude Code version in the project README
- DAG decomposition quality depends on the prompt; Claude occasionally over-decomposes (10+ tasks) or misses a dependency. Add a simple validation step: reject any DAG where `sum(task_count) > 8` or where there are cycles
- Parallel agents on a local machine compete for CPU. For the MVP, cap concurrency at `min(4, cpu_count - 1)` to avoid thrashing
- LiteLLM SSE and Claude's stream-json are different formats; keep adapters cleanly separated so adding a third backend (Codex, OpenCode) is one new adapter file
- React Flow is MIT for personal/open-source use but requires a pro licence for commercial dashboards — fine for personal tooling

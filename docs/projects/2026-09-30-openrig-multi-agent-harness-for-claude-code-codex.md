# OpenRig – Multi-Agent Harness for Claude Code + Codex

**Source:** <https://github.com/mvschwarz/openrig>
**Discovered:** 2026-09-30
**Viability:** 3/4

> Directly enables running Claude Code alongside Codex (or any other agent) as a unified team. The YAML-defined topology + live click-through UI is exactly the kind of agent orchestration layer the user builds toward with projects like openclaw/claw-desk variants. Claude is a first-class player in the rig.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

weekend_buildable=1: The core deliverable — parse a YAML agent manifest, launch tmux panes for Claude Code and Codex instances, wire a simple message bus between them, and render a topology view — is well-scoped glue code. No novel algorithms or large data pipelines; it's mostly shell/tmux orchestration with YAML parsing, achievable in 1-2 focused Claude sessions. fills_gap=1: The user actively builds agent UIs (openclaw, claw-desk, gravity-claw) and Claude tooling, but a declarative, tmux-native harness for running Claude Code + Codex as a coordinated team is a layer above what those projects cover. They clearly need multi-agent coordination but don't have a YAML-first CLI solution for it. novel=1: CrewAI, AutoGen, and LangGraph exist but are Python-framework-heavy and not terminal-native. A tmux-bus architecture targeting Claude Code specifically, with named topologies that can be saved and restored, occupies a meaningfully different niche. daily_utility=0: Multi-agent harness setups are invoked for specific complex tasks, not opened every morning like a planner or expense tracker. Even a heavy agent-workflow user would reach for this when setting up a new coordinated run, not as a daily constant. Total = 3, viable = true. The strong alignment with their existing agent-UI and Claude-tooling work, plus the clear weekend scope, makes this a genuine build candidate despite limited daily cadence.

---

## Implementation Plan

## Overview

OpenRig is a terminal-native multi-agent harness that lets you describe a team of AI agents (Claude Code, Codex, or any CLI agent) in a YAML manifest, boot them with one command, and observe a live topology view. tmux acts as the communication bus: each agent runs in its own pane, and a thin coordinator process routes messages between panes and renders the topology. Named topologies can be saved to disk and restored in one command.

## Stack Recommendation

- **Runtime:** Node.js 20+ (matches the user's existing Claude tooling; fast startup, good tmux/pty libraries)
- **tmux integration:** `node-pty` for pseudoterminal control + direct `tmux` CLI calls via `execa`
- **YAML parsing:** `js-yaml`
- **Topology UI:** `blessed` or `ink` (React for terminals) — `ink` preferred for component reuse
- **CLI entry point:** `commander` for subcommands (`boot`, `save`, `restore`, `status`)
- **Config storage:** `~/.openrig/topologies/` directory, JSON files per named topology
- **IPC bus:** named pipes (`mkfifo`) per agent pair, managed by the coordinator

## MVP Scope

- Parse a YAML agent manifest defining agents, roles, and message routing rules
- Launch a tmux session with one pane per agent, one pane for the coordinator, one pane for the topology view
- Coordinator process reads from agent output pipes and routes messages to target agent input pipes based on routing rules
- Topology view updates live as agents exchange messages
- `openrig boot topology.yaml` starts everything; `openrig save <name>` snapshots; `openrig restore <name>` relaunches

## Implementation Phases

### Phase 1: Project Scaffold and YAML Manifest Parser

**Goal:** `openrig` CLI accepts a YAML file and prints a validated, normalized agent topology to stdout.

**Files to create/modify:**
- `package.json` — Node.js project, `"type": "module"`, bin entry `openrig`
- `src/cli.js` — `commander` entry point with `boot`, `save`, `restore`, `status` subcommands (stubs)
- `src/manifest.js` — YAML loader and schema validator
- `src/schema.js` — Zod schema for the manifest format
- `schemas/topology.example.yaml` — example manifest with Claude Code + Codex agents

**Key steps:**
1. Run `npm init -y` in project root, install `commander js-yaml zod execa`
2. Define the YAML schema in `src/schema.js` using Zod: top-level fields `name`, `agents[]`, `routes[]`. Each agent has `id`, `type` (enum: `claude-code`, `codex`, `shell`), `role` (free string), `cmd` (override optional), `cwd` (optional). Each route has `from`, `to`, `trigger` (regex string matching agent output).
3. In `src/manifest.js`, export `loadManifest(path)`: reads file, parses with `js-yaml`, validates with Zod, returns normalized object with defaults filled (e.g., `cmd` defaulting to `claude` for claude-code type, `codex` for codex type).
4. Wire `openrig boot <file>` in `src/cli.js` to call `loadManifest` and `console.log(JSON.stringify(result, null, 2))` for now.
5. Write `schemas/topology.example.yaml` with two agents (`planner` as claude-code, `executor` as codex) and one route (planner output matching `/TASK:(.+)/` routes to executor).

**Verify:** `node src/cli.js boot schemas/topology.example.yaml` prints JSON with both agents and the route, no errors.

---

### Phase 2: tmux Session Launcher

**Goal:** `openrig boot topology.yaml` creates a tmux session with one pane per agent plus a coordinator pane, and each agent's command is running inside its pane.

**Files to create/modify:**
- `src/tmux.js` — wrapper around `tmux` CLI via `execa`: create-session, new-window, split-pane, send-keys, kill-session
- `src/launcher.js` — reads normalized manifest, builds tmux layout, launches agent processes
- `src/coordinator.js` — stub process that just prints "coordinator running"

**Key steps:**
1. Install `execa@8` (ESM-compatible).
2. In `src/tmux.js`, implement: `createSession(name)`, `newWindow(session, name)`, `splitPane(session, window)`, `sendKeys(session, pane, text)`, `listPanes(session)`, `killSession(name)`. Each is a thin wrapper: `execa('tmux', [...args])`.
3. In `src/launcher.js`, export `launch(manifest)`:
   - Session name = `manifest.name` (slugified)
   - Kill existing session of same name if present (ignore error)
   - Create new session, first window named `coordinator`, run `node src/coordinator.js` in it
   - For each agent in `manifest.agents`, create a new window named `agent-${agent.id}`, send the agent's `cmd` as keys
   - Store pane/window mapping in a temp JSON file at `/tmp/openrig-${sessionName}.json` for later use by coordinator
4. Update `src/cli.js` `boot` command to call `launch(manifest)` after loading manifest, then print session name.
5. Test with the example YAML; verify tmux session is created with correct windows.

**Verify:** `node src/cli.js boot schemas/topology.example.yaml` then `tmux ls` shows a session named after the topology; `tmux attach -t openrig-<name>` shows windows for coordinator and each agent.

---

### Phase 3: Message Bus and Coordinator

**Goal:** When an agent produces output matching a route trigger, the coordinator automatically forwards the matched text to the target agent's stdin.

**Files to create/modify:**
- `src/coordinator.js` — full coordinator: reads manifest, tails agent pane output, applies routing rules, writes to target panes
- `src/bus.js` — named-pipe creation and read/write helpers
- `src/tail.js` — captures tmux pane output via `tmux capture-pane` on an interval

**Key steps:**
1. In `src/bus.js`, export `createPipe(agentId)` (calls `mkfifo /tmp/openrig-bus-${agentId}` via execa), `writePipe(agentId, text)` (opens pipe for writing), `readPipe(agentId, callback)` (streams pipe reads).
2. In `src/tail.js`, export `tailPane(session, windowName, callback, intervalMs=500)`: calls `tmux capture-pane -pt ${session}:${windowName} -S -` on an interval, diffs against last capture, calls `callback(newLines)` with fresh lines only. Track last-seen line count to avoid re-delivering.
3. In `src/coordinator.js`:
   - Read session map from `/tmp/openrig-${sessionName}.json`
   - For each agent, start `tailPane` watching their window
   - On new output lines from agent A, test each line against all routes where `route.from === agentA.id`; if `new RegExp(route.trigger)` matches, extract match group 1 as the message
   - Call `tmux send-keys` to the target agent's pane with the extracted message + Enter
   - Log each routed message with timestamp to `~/.openrig/logs/${sessionName}.log`
4. Update `src/launcher.js` to pass `--session` and `--manifest` args to `coordinator.js` process so it knows which session and manifest to use.

**Verify:** Boot the example topology; in the planner pane type `TASK: write a hello world function`; within ~1 second the executor pane receives the text `write a hello world function` as if typed.

---

### Phase 4: Live Topology View

**Goal:** A topology pane renders agent status (running/idle/routing) and recent message events live, updated every second.

**Files to create/modify:**
- `src/topology-ui.js` — `ink`-based React terminal app showing the topology
- `src/topology-server.js` — tiny event emitter / state store that coordinator writes to
- `src/ui/AgentBox.jsx` — component: agent id, type badge, last message snippet, status indicator
- `src/ui/RouteArrow.jsx` — component: directional arrow with trigger label between agents

**Key steps:**
1. Install `ink react`.
2. In `src/topology-server.js`, maintain an in-memory state object: `{ agents: {[id]: { status, lastMsg, msgCount }}, events: [] }`. Export `updateAgent(id, patch)` and `addEvent(from, to, text)`. Serialize state to `/tmp/openrig-${sessionName}-state.json` on every update.
3. In `src/topology-ui.js`, poll `/tmp/openrig-${sessionName}-state.json` every 800ms with `setInterval`, parse JSON, pass to Ink components. Render a box per agent using `AgentBox`, connect them with ASCII arrows using `RouteArrow`, and show last 5 events at the bottom.
4. In `src/ui/AgentBox.jsx`, use `ink`'s `Box`, `Text`, `Badge` primitives. Status `routing` = yellow, `idle` = green, `error` = red.
5. Update coordinator to call `updateAgent` and `addEvent` on each routing action.
6. In `src/launcher.js`, create a dedicated tmux window named `topology`, run `node src/topology-ui.js --session <name>` in it. Add it to the layout before agent windows so it's the first thing seen on attach.

**Verify:** Boot example topology; `tmux attach` opens to topology window showing both agents as green boxes with an arrow; trigger a route message and the routing agent briefly turns yellow and a new event appears in the event log.

---

### Phase 5: Save, Restore, and Status Commands

**Goal:** `openrig save <name>`, `openrig restore <name>`, and `openrig status` work correctly, and the project has a polished README and install path.

**Files to create/modify:**
- `src/store.js` — read/write named topologies under `~/.openrig/topologies/`
- `src/cli.js` — wire `save`, `restore`, `status` subcommands
- `README.md` — install, quick-start, YAML manifest reference
- `bin/openrig` — symlink target; add to `package.json` `bin` field

**Key steps:**
1. In `src/store.js`, implement:
   - `save(name, manifest)`: writes `~/.openrig/topologies/${name}.json` (full normalized manifest + original YAML path)
   - `restore(name)`: reads the stored manifest, calls `launch(manifest)`
   - `list()`: returns array of saved topology names by reading `~/.openrig/topologies/` directory
2. Wire `openrig save <name>` to load the last-booted manifest from `/tmp/openrig-last.json` (written by launcher on boot), call `store.save(name, manifest)`, print confirmation.
3. Wire `openrig restore <name>` to call `store.restore(name)`, which calls `launch(manifest)`.
4. Wire `openrig status` to call `tmux ls`, filter sessions prefixed `openrig-`, for each read the state JSON and print a one-line summary per session (agents, message count, uptime).
5. Add `"bin": { "openrig": "src/cli.js" }` to `package.json`; add shebang `#!/usr/bin/env node` to `src/cli.js`; run `npm link` to install globally.
6. Write `README.md` with: install (`npm link`), quick-start (5 lines from YAML to booted rig), YAML schema table, save/restore example.

**Verify:** `openrig boot schemas/topology.example.yaml`, then `openrig save my-rig`, then `openrig kill` (kill tmux session manually), then `openrig restore my-rig` relaunches the full rig; `openrig status` prints the running session summary.

## Estimated Effort

**2 Claude Code sessions**

- **Session 1 (Phases 1–3):** Scaffold, manifest schema, tmux launcher, named-pipe bus, coordinator routing logic. The tmux pane-tailing approach needs careful diffing to avoid duplicate delivery — that's the main fiddly bit.
- **Session 2 (Phases 4–5):** Ink topology UI, state polling, save/restore/status commands, README, `npm link` packaging. The UI is the most open-ended part; keep it to ASCII boxes and arrows to stay in scope.

## Potential Blockers

- **tmux version differences:** `capture-pane -S -` behavior varies between tmux 3.0 and 3.3+. Pin to `tmux >= 3.2` in README; use `tmux -V` check at startup.
- **Codex CLI availability:** The implementation assumes `codex` is on PATH as a CLI. If the user only has API access (not the CLI), the `codex` agent type needs a wrapper script. Verify `which codex` early; fall back to a `shell` type with a custom `cmd`.
- **Named pipe blocking:** `mkfifo` pipes block on open until both ends connect. The bus needs non-blocking opens (`O_NONBLOCK`) or a timeout; alternatively replace named pipes with a lightweight TCP socket per agent pair to avoid this entirely.
- **Ink + Node ESM:** `ink` 5.x requires ESM and React 18. Mixing `ink` with `commander` in the same ESM entry point can cause React singleton conflicts if both are bundled differently. Keep `topology-ui.js` as a fully separate process spawned by the launcher, not imported inline.
- **Claude Code stdin control:** `claude` CLI may not accept arbitrary stdin text as task input (it has its own REPL). Test early whether `tmux send-keys` to a running `claude` session correctly submits a new task, or whether the coordinator needs to restart the agent with the message as a CLI argument (`claude -p "message"`).

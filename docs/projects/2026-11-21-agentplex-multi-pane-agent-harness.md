# AgentPlex — open-source agent-driven terminal multiplexer

**Source:** [Zerg Client](https://www.producthunt.com/posts/zerg-client) on Product Hunt (Nov 5 2026, #1 product of day, closed-source, Mac-only)
**Discovered:** 2026-11-21
**Viability:** 4/4

> Zerg Client's key concept: *the agent itself opens and drives terminal panes*. When you tell Claude "open vim in a pane called editor", it does. This inverts the model of every existing open-source multi-pane tool (cmux, Shepherd Terminal, paneherd, agent-terminal), where the user wires panes manually. AgentPlex implements the same inversion as an MIT-licensed, cross-platform CLI.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

- **weekend_buildable=1:** a Node.js script that (a) starts a tmux session with a "supervisor" pane running `claude`, (b) exposes a small MCP stdio server with `open_pane / close_pane / list_panes` tools, (c) opens panes with `tmux new-window`. An 80-line supervisor + a 60-line MCP server is a single afternoon.
- **fills_gap=1:** Zerg Client is closed-source + Mac-only. cmux/Shepherd/paneherd/agent-terminal all require user-side wiring. No open-source tool delegates pane creation to the agent.
- **novel=1:** checked cmux, paneherd, Shepherd Terminal, agent-terminal, herdr, hub-by-icons8. All are user-driven. The inversion (agent opens panes) has 0 open-source implementations in this log's history. ADE Index `cap=parallel-agents` shows 97 tools — none with agent-driven pane opening in OSS.
- **daily_utility=1:** a supervisor pane that opens an editor, a test runner and a linter on demand is exactly how Claude Code sessions work today; this makes it literal and persistent across context resets.

---

## Implementation Plan

### Overview

```
agentplex start          # start a tmux session: supervisor pane + config pane
agentplex attach         # reattach to running session
agentplex kill           # tear down all panes
```

The supervisor pane runs `claude --mcp-config ~/.agentplex/mcp.json`. The MCP config registers one server: `agentplex-mcp`, a local stdio server that exposes:

| Tool | Args | Effect |
|------|------|--------|
| `open_pane` | `name, cmd` | opens a new tmux window running `cmd` |
| `close_pane` | `name` | kills that window |
| `list_panes` | — | returns all windows with names + exit codes |
| `run_in_pane` | `name, cmd` | sends a command to an existing pane |
| `tail_pane` | `name, lines` | returns last N lines from that pane's log |

### Stack

- **Runtime:** Node.js 22 + TypeScript
- **tmux control:** `execa` with `tmux` commands (no native bindings needed)
- **MCP server:** `@anthropic-ai/sdk` MCP stdio server
- **Config:** `~/.agentplex/config.json` (model, default panes)
- **Pane logging:** each pane tees its output to `~/.agentplex/logs/<name>.log`

### MVP Scope (Phase 1)

- `agentplex start`: creates tmux session `agentplex`, launches `claude` in pane 0 with the local MCP server registered
- MCP tool `open_pane(name, cmd)`: runs `tmux new-window -n <name> <cmd>` and returns the pane id
- MCP tool `list_panes()`: parses `tmux list-windows` and returns JSON
- README with 3-line quickstart

**Done when:** running `agentplex start`, asking Claude "open vim in a pane called editor", and seeing a new tmux window named `editor` with vim running.

### Phases

#### Phase 0: Setup (30 min)
1. `npm init` + TypeScript config + `@anthropic-ai/sdk`, `execa`, `tsx`
2. Confirm: `tmux new-session -d -s test`, `tmux new-window -t test -n editor "vim ."`, `tmux kill-session -t test` all work from Node

#### Phase 1: MCP server + supervisor launcher (3h)
1. `src/mcp-server.ts`: MCP stdio server exposing `open_pane`, `close_pane`, `list_panes`
2. `src/cli.ts`: `agentplex start` — spawns tmux session, writes `~/.agentplex/mcp.json`, launches `claude --mcp-config ~/.agentplex/mcp.json` in pane 0
3. Test: ask Claude "open vim in a pane called editor" → new tmux window

#### Phase 2: Pane types and defaults (2h)
1. `~/.agentplex/config.json`: `default_panes: [{ name: "editor", cmd: "vim ." }, { name: "tests", cmd: "npm test -- --watch" }]`
2. Auto-open defaults on `agentplex start` before Claude launches
3. Add `run_in_pane(name, cmd)` for one-shot commands without opening a persistent pane

#### Phase 3: Cross-pane context (2h)
1. Each pane tees output: `cmd 2>&1 | tee ~/.agentplex/logs/<name>.log`
2. `tail_pane(name, lines)` MCP tool reads that log file and returns last N lines
3. Claude can now ask "what's the current test output?" and get real data

#### Phase 4: Session persistence (1h)
1. `agentplex save <name>` → serializes current pane layout to `~/.agentplex/sessions/<name>.json`
2. `agentplex restore <name>` → rebuilds the pane set from JSON
3. `agentplex list` → shows saved sessions

### Effort Estimate

~1.5 Claude sessions (6–8h): Phase 0+1 in one session, Phase 2+3 in the second, Phase 4 as cleanup.

### Blockers / Risks

| Risk | Mitigation |
|------|-----------|
| tmux version differences | Test `tmux -V`; if <3.0 some flags differ — document minimum version |
| `--mcp-config` Claude Code flag | Available since Claude Code 2.1.x; verify before Phase 1 |
| Windows compatibility | tmux is Unix-only; scope to macOS + Linux, document WSL workaround |
| Large pane output | Don't capture-pane (lossy); use tee log file from Phase 3 |
| Pane naming collisions | Error if `open_pane` is called with an already-open pane name |

# Nezha — Parallel AI Coding-Agent Desktop (TUI Edition)

**Source:** <https://github.com/hanshuaikang/nezha>
**Discovered:** 2026-10-04
**Viability:** 3/4

> Nezha is an Electron desktop app that runs multiple Claude Code and Codex sessions in parallel across projects, with a unified task queue, session playback, code browsing, and Git workflow in one window. 1.7k stars, launched April 2026, last push June 2026. The full Electron app is not weekend-buildable, but the core idea — one terminal window that multiplexes N Claude Code processes and lets you route tasks to whichever agent is free — is.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 0/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

Herdr (July 2026) was a terminal-native agent multiplexer with agent state awareness. This plan is narrower: a Claude-Code-specific TUI that manages parallel worktrees, distributes a task queue, and shows each agent's last line of output in one view. The MVP is a Node.js + Ink TUI that spawns N `claude` processes in named tmux panes or via `node-pty`, with a file-based task queue the agents read from. Not the full Electron app, but covers the daily workflow of running one agent per feature branch.

---

## Implementation Plan

**2 Claude Code sessions** to a TUI agent multiplexer that manages 3-4 parallel Claude Code sessions across git worktrees.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (Node.js 22+) | Ecosystem for PTY and Ink |
| TUI framework | Ink 4 | React-like TUI, handles re-renders |
| PTY management | `node-pty` | Spawn and stream Claude Code processes |
| Task queue | Flat JSON file (`queue.json`) | Simple, shareable between processes |
| Git worktrees | `git worktree add` | Each agent gets its own working tree |
| Config | CLI flags + `.nezha.json` | Project-level agent count and branches |

---

## MVP Scope

- Spawn N Claude Code processes (default 3), each in its own git worktree on a separate branch.
- Show a TUI grid: one panel per agent showing the last 10 lines of output, agent status (idle / working / done), and current branch.
- A task queue: pressing `n` opens a prompt to type a task. The task is written to `queue.json`. The first idle agent picks it up and feeds it to its `claude -p` instance.
- Pressing `s` on an agent panel sends it to full-screen view. Pressing `Esc` returns to grid.
- On all agents idle, show a summary of changes in each worktree (`git diff --stat`).

Out of scope for MVP: session playback, code browsing, PR creation, multi-provider (Codex), the full Electron GUI.

---

## Implementation Phases

### Phase 1: Worktree manager and PTY spawner

**Goal:** Spawn N Claude Code processes in separate worktrees; stream their stdout to an array of ring buffers.

**Files:**
- `src/worktree.ts` — `setupWorktrees(n, baseBranch)` → `Worktree[]`; wraps `git worktree add`
- `src/agent.ts` — `AgentProcess` class: spawns `claude --dangerously-skip-permissions -p ""`, owns a ring buffer of 50 lines, emits `output` and `idle` events
- `src/queue.ts` — `TaskQueue`: reads/writes `queue.json`, `nextTask()`, `addTask(text)`

**Key steps:**
1. `setupWorktrees(n, baseBranch)`: for each `i` in `[0..n)`, run `git worktree add /tmp/nezha-wt-${i} -b nezha/${i}`. Return `{path, branch}[]`.
2. `AgentProcess`: use `node-pty` to spawn `claude --dangerously-skip-permissions` in non-interactive mode. On each line of output, push to ring buffer and emit `output`.
3. Detect idle: when the PTY output contains the Claude Code prompt string (`> `) for > 500 ms with no new output, emit `idle`.
4. `sendTask(task)`: write `task + '\n'` to the PTY's stdin.
5. Task loop: in `AgentProcess`, on `idle` event, call `queue.nextTask()`; if a task exists, call `sendTask`.

**Verify:** Spawn 2 agents, add tasks `["write hello world in /tmp/a.ts", "write hello world in /tmp/b.ts"]` to queue. Both files should exist after the agents complete.

---

### Phase 2: Ink TUI grid

**Goal:** A live terminal UI showing all agents in a grid with status, last lines, and a task input.

**Files:**
- `src/ui/App.tsx` — root Ink component
- `src/ui/AgentPanel.tsx` — per-agent box: header (branch, status), last 10 lines, selected indicator
- `src/ui/TaskInput.tsx` — floating input on `n` keypress
- `src/ui/Summary.tsx` — shown when all agents idle: `git diff --stat` per worktree

**Key steps:**
1. `App`: holds `agents` state (array of `{id, branch, lines[], status}`). Subscribes to each `AgentProcess` `output` event with `useEffect`; updates state with `setAgents`.
2. `AgentPanel`: use `Box borderStyle='round'` with `borderColor` keyed to status (green=idle, yellow=working, red=error). Show last 10 lines with `Text wrap='truncate-end'`.
3. On `s` keypress over a panel, push to a `focused` state and render that panel full-screen.
4. `TaskInput`: use Ink's `TextInput` component. On submit, call `queue.addTask(text)`.
5. `Summary`: when all agents idle, spawn `git diff --stat` in each worktree and display results side by side.

**Verify:** Start the TUI with 3 agents. Confirm the grid renders. Add a task; watch the agent status change to `working` and back to `idle`. Press `s` to focus one agent; press `Esc` to return.

---

### Phase 3: Session log and worktree cleanup

**Goal:** Persist what each agent did; clean up worktrees on exit.

**Files:**
- `src/log.ts` — `SessionLog`: appends each completed task + output digest to `~/.nezha/YYYY-MM-DD.jsonl`
- `src/cleanup.ts` — `cleanup(worktrees[])`: removes worktrees on `SIGINT`/`SIGTERM`

**Key steps:**
1. On each agent completing a task, call `log.append({ts, branch, task, summary})` where `summary` is the last 5 lines of the agent's ring buffer.
2. Register `process.on('SIGINT', cleanup)` and `process.on('SIGTERM', cleanup)`. Run `git worktree remove --force` for each path.
3. Add a `--keep` CLI flag to skip cleanup (useful for inspecting results).

**Verify:** Run a session, exit cleanly. Confirm `~/.nezha/<date>.jsonl` has entries and the worktrees are removed.

---

## Estimated Effort

About 2 Claude Code sessions.
- **Session 1 (≈ 3 h):** Phases 1-2. PTY spawning, worktrees, task queue, basic Ink grid.
- **Session 2 (≈ 2 h):** Phase 3 + polish. Session logging, cleanup, focus mode, summary view.

## Potential Blockers

- **PTY idle detection:** The Claude Code prompt string may change across versions, or may not appear in non-interactive mode. Alternative: detect idle by watching for no new output for 3 s after the last line. Tune with `--debug` output.
- **`--dangerously-skip-permissions`:** Required for non-interactive `claude -p`. Ensure each worktree is sandboxed (own branch, no writes outside its path) before using this flag.
- **`node-pty` on Linux:** Requires `python3` and `make` for native compilation. Check `npm install node-pty` builds cleanly in the environment.
- **Ink re-render rate:** High-frequency agent output can cause excessive re-renders. Throttle state updates to max 4 per second with a debounce.
- **`git worktree` limitations:** A worktree cannot be on the same branch as another. Use `nezha/0`, `nezha/1`, etc. as branch names. Clean them up between runs.
- **Herdr overlap:** Herdr (July 2026 plan) covers similar ground but is process-agnostic. This plan is intentionally narrower (Claude Code–specific, worktree-based) so it won't duplicate effort if Herdr was built.

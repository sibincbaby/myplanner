# herdr — Terminal-Native Agent Multiplexer with Agent-State Awareness

**Source:** <https://github.com/ogulcancelik/herdr>
**Discovered:** 2026-07-13
**Viability:** 3/4

> Agent UI (control room for multiple agents) + Dev productivity (orchestrate parallel Claude Code sessions) + Claude/LLM tooling (Claude Code integration). Matches the user's gravity-claw/claw-desk multi-agent UI interest and is a fresh trending breakout.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 0/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

The user runs many coding-agent sessions (openclaw, claw-desk, gravity-claw variants) and juggling multiple detachable Claude Code sessions with state-awareness genuinely fits their daily agent-heavy workflow — this fills a real gap and is novel versus plain tmux (no popular multiplexer tracks per-agent blocked/working/done state). However, weekend_buildable fails: a robust Rust terminal multiplexer with PTY management, session persistence across restarts, SSH reattach, and reliable state detection across 15+ agents is a substantial multi-week systems project, not a 1-2 session MVP. A stripped-down MVP (tmux wrapper with a status sidebar) is plausible but drops the core differentiators, so I score weekend_buildable 0. Since the real value depends on the hard-to-build pieces, total lands at 3 but the honest MVP-in-a-sprint criterion is not met.

---

## Implementation Plan

I have enough understanding. This is a systems-level Rust TUI project. The plan targets an honest MVP that Claude can build autonomously, preserving the core differentiator (per-agent state awareness) while acknowledging the hard pieces.

## Overview

herdr is a terminal multiplexer purpose-built for coding agents: a single Rust binary that runs multiple agent sessions in split panes and, critically, shows a sidebar tracking whether each agent is **blocked / working / done / idle**. The upstream project is a multi-week systems effort (real PTY multiplexing, session persistence across restarts, SSH reattach, socket API, 15+ agent detectors).

For an autonomous Claude build, the plan targets the **novel core** — per-agent state awareness via output heuristics — on top of a pragmatic session layer. Two viable paths exist: (A) a **tmux control-mode wrapper** that delegates PTY/persistence/SSH-reattach to tmux (which already solves those hard problems robustly) and layers a Rust `ratatui` state-aware sidebar on top; or (B) a **from-scratch `portable-pty` + `ratatui`** multiplexer. Path A is strongly recommended: it lets Claude ship the differentiating feature in a sprint while inheriting battle-tested persistence and reattach for free. This plan follows Path A, with the from-scratch PTY path noted as an optional later phase.

## Stack Recommendation

- **Language:** Rust (matches upstream; single-binary distribution via `cargo build --release`).
- **TUI:** [`ratatui`](https://crates.io/crates/ratatui) + [`crossterm`](https://crates.io/crates/crossterm) backend — sidebar + status rendering.
- **Session/PTY backend:** **tmux** (external dependency) driven via **control mode** (`tmux -CC` / `control` mode) over a subprocess. tmux provides detach/reattach, restart survival (`tmux-resurrect`-style or plain server persistence), SSH reattach, and real PTY handling — the exact hard pieces flagged as not weekend-buildable.
- **tmux control:** spawn `tmux -C` (control mode) and parse its line protocol, or shell out to `tmux list-panes`, `tmux capture-pane -p`, `tmux new-window`, `tmux send-keys` for a simpler v1.
- **Process/output capture:** `tmux capture-pane -p -t <pane>` polled on an interval; alternatively `pipe-pane` to a fifo for streaming.
- **State machine / detection:** plain Rust + [`regex`](https://crates.io/crates/regex) rules per agent, driven by a YAML config ([`serde`](https://crates.io/crates/serde) + [`serde_yaml`](https://crates.io/crates/serde_yaml)).
- **Async/timing:** [`tokio`](https://crates.io/crates/tokio) (poll loop + input handling) or a simple thread + `std::sync::mpsc` if avoiding async.
- **Config/paths:** [`directories`](https://crates.io/crates/directories) for `~/.config/herdr/`, [`anyhow`](https://crates.io/crates/anyhow) for errors.
- **CLI:** [`clap`](https://crates.io/crates/clap) (`herdr`, `herdr attach`, `herdr new`, `herdr kill`).

## MVP Scope

**In scope (the differentiator):**
- A `ratatui` sidebar listing all agent sessions with color-coded state: 🟡 working / 🔴 blocked / 🟢 done / ⚪ idle.
- State inference from pane output via configurable regex rules (ships detectors for **Claude Code** + 2–3 others: Codex/Copilot CLI/generic shell).
- Sessions backed by tmux windows → **detach/reattach and restart survival work for free**.
- Spawn a new agent session, switch focus, attach into a chosen pane full-screen.
- A `SKILL.md` so a Claude Code agent can drive herdr.

**Explicitly out of scope for MVP:** from-scratch PTY multiplexing, split-pane rendering inside herdr itself (tmux owns panes), the full socket API, and all 15+ detectors (config-driven so more can be added trivially).

## Implementation Phases

### Phase 1: tmux-backed session layer + CLI
**Goal:** `herdr` can create, list, and kill tmux-backed agent sessions and attach into one, with everything surviving detach/restart.
**Files to create/modify:**
- `Cargo.toml` — declare deps: `ratatui`, `crossterm`, `serde`, `serde_yaml`, `regex`, `clap`, `anyhow`, `directories`.
- `src/main.rs` — `clap` CLI entrypoint (`herdr`, `herdr new <name> [-- cmd...]`, `herdr ls`, `herdr attach <name>`, `herdr kill <name>`).
- `src/tmux.rs` — thin wrapper over tmux: `ensure_server()`, `list_windows()`, `new_window(name, cmd)`, `capture_pane(target) -> String`, `kill_window(name)`, `attach()` (exec `tmux attach`).
- `src/session.rs` — `Session { name, window_id, agent_kind, state }` model.
**Key steps:**
1. In `tmux.rs`, run tmux via `std::process::Command` against a dedicated server socket: `tmux -L herdr <subcommand>` so herdr's sessions are isolated from the user's default tmux.
2. Implement `new_window`: `tmux -L herdr new-session -d -s herdr -n <name> '<cmd>'` (first call) then `new-window -n <name>` for subsequent; store window id.
3. Implement `list_windows` parsing `tmux -L herdr list-windows -F '#{window_id} #{window_name} #{pane_pid}'`.
4. Implement `capture_pane` via `tmux -L herdr capture-pane -p -t <window> -S -50` (last 50 lines).
5. Wire `clap` subcommands; `herdr attach` execs `tmux -L herdr attach -t <window>` so detach/reattach/SSH all delegate to tmux.
**Verify:** `cargo run -- new demo -- bash`, then `cargo run -- ls` shows `demo`; `cargo run -- attach demo` drops into the shell; detach (`Ctrl-b d`) and re-run `attach` — the same shell/state is intact. Kill the terminal and `attach` again — session survives.

### Phase 2: Agent-state detection engine
**Goal:** Given captured pane output, herdr classifies each session as working / blocked / done / idle using config-driven rules.
**Files to create/modify:**
- `src/detect.rs` — the state machine: `fn classify(kind: &AgentKind, recent_output: &str, last_change: Instant) -> AgentState`.
- `src/config.rs` — load `~/.config/herdr/agents.yaml` (via `directories`), deserialize detector rules with `serde_yaml`.
- `assets/agents.yaml` — default detector rules shipped with the binary (embedded via `include_str!`).
- `tests/detect.rs` — unit tests with captured-output fixtures.
**Key steps:**
1. Define `AgentState { Idle, Working, Blocked, Done }` and a `Detector { name, working: Vec<Regex>, blocked: Vec<Regex>, done: Vec<Regex>, prompt_hint: Regex }`.
2. Write default rules in `agents.yaml`: e.g. Claude Code — `blocked` = regexes for permission/approval prompts and `"Do you want"` / `"(y/n)"`; `working` = spinner/`"esc to interrupt"` / `"Thinking"`; `done`/`idle` = an empty input prompt with no activity for N seconds.
3. `classify` logic: if any `blocked` regex matches tail → Blocked; else if `working` matches → Working; else if output unchanged for `idle_timeout` (e.g. 5s) and prompt visible → Idle; else if a completion marker matched recently → Done.
4. Track per-session `last_output_hash` + `last_change` timestamp to distinguish Working (output churning) from Idle (static).
5. Add auto-detection of agent kind: match the pane's command/first output against detector signatures; fall back to `generic`.
**Verify:** `cargo test` passes with fixtures for each state (a Claude Code permission prompt classifies Blocked; a spinner line classifies Working; an idle shell prompt classifies Idle). Add a `herdr debug-state <name>` hidden subcommand that prints the current classification for a live session.

### Phase 3: State-aware sidebar TUI
**Goal:** Running bare `herdr` opens a `ratatui` dashboard: a live sidebar of all sessions with color-coded state, updating in real time, with keys to attach/new/kill.
**Files to create/modify:**
- `src/ui.rs` — `ratatui` app: sidebar list widget, color mapping per state, footer keybindings.
- `src/app.rs` — app state + event loop: poll interval refreshes sessions + reclassifies; `crossterm` key handling.
- `src/main.rs` — default (no subcommand) launches the TUI.
**Key steps:**
1. Build the poll loop (250–500 ms): for each session, `tmux.capture_pane()` → `detect.classify()` → update `Session.state`.
2. Render a `List` in a left sidebar: each row `<indicator> <name> <state>`, colored (yellow=Working, red=Blocked, green=Done, gray=Idle) via `ratatui::style::Color`.
3. Keybindings: `↑/↓` select, `Enter` = suspend TUI and `exec tmux attach -t <window>` (restore terminal on return), `n` = new session prompt, `k` = kill, `q` = quit (sessions keep running — herdr detaches, tmux persists).
4. Show a right-hand preview pane rendering the last ~20 captured lines of the selected session (read-only tail).
5. Ensure clean terminal teardown (raw mode off, alt-screen restore) on all exit paths, including panic hook.
**Verify:** Launch two sessions (`herdr new a -- claude`, `herdr new b -- bash`), run `herdr`; the sidebar shows both with live-updating colors — trigger a permission prompt in `a` and watch it flip to red Blocked, let it work and see yellow, idle it to gray. `Enter` attaches; detach returns to the sidebar.

### Phase 4: SKILL.md + agent integration + packaging
**Goal:** A Claude Code agent can drive herdr from within a session, and the binary is documented and installable.
**Files to create/modify:**
- `SKILL.md` — how an agent invokes `herdr new/ls/attach/kill` and interprets states.
- `README.md` — install, usage, config, adding new agent detectors.
- `src/main.rs` — add `herdr states --json` (machine-readable: `[{name, kind, state}]`) for agent consumption.
- `install.sh` / cargo instructions — `cargo install --path .`.
**Key steps:**
1. Implement `herdr states --json` emitting current classification for all sessions via `serde_json` (add crate) — this is the socket-API-lite surface.
2. Write `SKILL.md`: trigger conditions ("orchestrate parallel agents"), commands, and how to poll `herdr states --json` to wait until a dependent agent is `done` before continuing.
3. Document adding detectors: copy an `agents.yaml` block, add regexes, no recompile needed.
4. Add a `--server-name` flag (default `herdr`) so multiple herdr instances don't collide.
5. `README` with a demo GIF placeholder, build/install, and an explicit "requires tmux ≥ 3.0" prerequisite note.
**Verify:** From inside a Claude Code session, run `herdr new build -- 'cargo build'` then loop `herdr states --json` until `build` shows `done`; confirm JSON is valid (`herdr states --json | jq .`). `cargo install --path .` then `herdr` works from any directory.

## Estimated Effort

**4 Claude Code sessions (~10–14 hours total).**
- **Session 1 (Phase 1):** Cargo scaffolding, tmux wrapper, CLI subcommands, verify detach/reattach/persistence delegation works.
- **Session 2 (Phase 2):** Detection engine, YAML config, default detector rules for Claude Code + 2–3 agents, unit tests with fixtures.
- **Session 3 (Phase 3):** ratatui sidebar, poll loop, color states, attach/new/kill keybindings, preview pane, clean teardown.
- **Session 4 (Phase 4):** `states --json`, SKILL.md, README, packaging, end-to-end agent-orchestration verification.

This ships the **novel differentiator (per-agent state awareness)** honestly within a sprint by delegating the multi-week-hard pieces (PTY, persistence, SSH reattach) to tmux. A from-scratch `portable-pty` + `ratatui` multiplexer to remove the tmux dependency is a viable but separate multi-session Phase 5+ effort, not part of the sprint MVP.

## Potential Blockers

- **tmux dependency & version drift:** herdr requires tmux ≥ 3.0 installed on every host (including the SSH remote). Control-mode/`capture-pane` format strings (`#{...}`) vary across tmux versions; test against the installed version and pin format flags. This trades the "single binary, zero external deps" upstream promise for buildability — call it out in the README.
- **State-detection reliability is the real risk, not the plumbing.** Regex heuristics over `capture-pane` output are inherently fragile: agents render spinners/ANSI escapes, redraw lines, and clear the screen, so tails can be noisy or empty. Mitigate by stripping ANSI (`strip-ansi`/regex), capturing enough scrollback (`-S -50`), and hashing normalized output for the churn/idle signal. Expect per-agent tuning; the `generic` fallback prevents hard failures.
- **"Done" is ambiguous.** Distinguishing genuinely-finished from momentarily-idle is heuristic — a completed agent and an idle shell can look identical. MVP treats "prompt visible + no output change for N seconds" as Idle and reserves Done for explicit completion markers; over-claiming Done will annoy the user, so bias conservative.
- **capture-pane polling cost:** Polling many sessions at 250 ms shells out repeatedly. If it's heavy, switch to `tmux pipe-pane` streaming to per-session fifos (more code, less overhead) — flagged for Phase 3 if profiling shows spikes.
- **Attach hand-off in the TUI:** cleanly suspending the ratatui alt-screen, `exec`ing `tmux attach`, and restoring on return is finicky; a panic hook that restores the terminal is mandatory to avoid leaving the user's shell broken.
- **No auth/external-API blockers** — everything is local. The `claude`/agent binaries just need to be on `PATH` for their sessions to launch.

Plan file focus: all paths above are under the project root `/home/sibin/my-works/myplanner` if you scaffold there, or a fresh `herdr/` repo — confirm the personal-vs-work GitHub account before creating any remote.

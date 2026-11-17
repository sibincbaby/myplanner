# seshka - macOS menu bar app that kills dev servers and watchers Claude Code left behind

**Source:** <https://github.com/jigjoy-ai/seshka>
**Discovered:** 2026-11-18
**Viability:** 3/4

> Claude tooling and dev productivity. There is no Linux version, and the user is on Linux, so a Rust/CLI or tray port is a quick, self-contained build for Claude.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

weekend_buildable=1: the user is on Linux, so the Swift app is no use as-is, but a Linux version is a small job: walk /proc from the claude PIDs, group child processes by session, show memory use and ports (ss/lsof), kill them, and add an optional idle-reaper as a CLI/TUI or tray app. fills_gap=1 and novel=1: the user runs many Claude Code sessions every day and has nothing that tracks processes by session (~/my-works/fkill only closes X11 windows, and csess only reads transcripts), and generic tools like htop or fkill-cli don't group by Claude session, while seshka itself is macOS-only. daily_utility=0: leftover dev servers and port clashes come up often, but once auto-kill is on it is a background cleanup tool rather than something the user would open every day, so this is a borderline 3.

---

## Implementation Plan

## Overview

This plan builds a Linux version of seshka. It lists the processes that Claude Code sessions leave behind (dev servers, watchers, scripts), grouped by session, with memory use, age and listening ports. You can kill one process, one session's leftovers, all orphans, or everything, and an optional reaper cleans up idle leftovers.

**A partial version already exists.** `~/my-works/ccstat` is the user's own Rust crate `claude-ps` (aliased as `ccps` and installed in `~/.cargo/bin`, remote `git@github-personal:sibincbaby/ccstat.git`). It lists live Claude sessions from `~/.claude/sessions/<pid>.json`, sums child memory, and kills whole sessions. It does **not** show individual child processes, ports, or leftovers whose session has already exited. So the assessment's claim that nothing tracks processes by session is only partly true. The best build is a new `procs` / `reap` feature in claude-ps, not a separate project.

**Ground truth checked on this machine (2026-11-18, Claude Code 2.1.311 and 2.1.325):**
- `~/.claude/sessions/<pid>.json` holds `pid`, `sessionId`, `cwd`, `name`, `status` (`idle`/`busy`), `updatedAt`, `procStart` and `entrypoint`.
- Every process Claude spawns inherits `CLAUDECODE=1` and `CLAUDE_CODE_SESSION_ID=<uuid>` in `/proc/<pid>/environ`, including MCP servers and Bash-tool shells. **This tag survives when a process is moved to a new parent after its session dies**, so leftovers can be traced to their session without walking the process tree.
- `CLAUDE_PID` is **not** set reliably (MCP children lack it), so do not depend on it.
- `ss` and `lsof` are installed, but ports can be read directly from `/proc/net/tcp{,6}` plus `/proc/<pid>/fd` with no extra dependency.

## Stack Recommendation

- **Rust (edition 2024), inside the existing `ccstat` crate.** Keep the current approach: only `serde_json` as a dependency, hand-written argument parsing, reading `/proc` directly, and signalling through `kill`.
- No new runtime dependencies for the core work. Ports come from `/proc/net/tcp` and `/proc/net/tcp6` (state `0A` means LISTEN), matched against `socket:[inode]` links in `/proc/<pid>/fd`.
- Auto-reap runs as a **systemd user timer** (systemd 255 is present). It is more reliable than a resident daemon and needs no tray.
- Optional tray: the `ksni` crate (StatusNotifierItem, pure Rust), behind a cargo feature `tray`. Ubuntu's AppIndicator extension renders it.
- Tooling: `~/.cargo/bin/cargo` (cargo 1.99.1). `cargo` is **not on PATH** in non-login agent shells, so use the full path or run `source ~/.cargo/env` first.

## MVP Scope

In scope:
1. `claude-ps procs` shows each live session's child processes and **orphans** (tagged processes whose session is gone), grouped by session. Columns: PID, kind (`mcp` / `bash` / `detached` / `orphan`), command, memory, age, ports, cwd. Add `--json` output.
2. `claude-ps procs kill <PID>`, `kill --session <id-prefix>`, `kill --orphans` and `kill --all`. Each kills the whole process tree (SIGTERM, wait 5 seconds, then SIGKILL), checks the process start time first so a reused PID is never hit, and asks for the same double confirmation claude-ps already uses. `--yes` skips confirmation when not in a terminal.
3. `claude-ps reap [--dry-run] [--grace 10m] [--idle 2h]` kills orphans older than the grace period. It can also kill non-MCP leftovers of sessions idle for longer than `--idle`.
4. `claude-ps reap --install` / `--uninstall` writes or removes the systemd user service and timer.

Out of scope for the MVP: the tray app (Phase 5, optional), Docker containers started by Claude, and crates.io publishing (only if the user asks).

## Implementation Phases

### Phase 1: Module split + process snapshot with session tags
**Goal:** `claude-ps` behaves exactly as before, but it runs on one shared `Snapshot` that also holds each process's environ tag, cmdline, cwd, RSS and CPU ticks.
**Files to create/modify:**
- `src/main.rs`: argument dispatch only. Add `procs` and `reap` arms that print "not yet" for now.
- `src/procfs.rs`: moved here from main.rs: `Stat`, `parse_stat`, `read_stat`, `all_procs`, `rss_kb`, `alive`. New: `read_environ_tag(pid) -> Option<String>` (returns the `CLAUDE_CODE_SESSION_ID` value only when `CLAUDECODE=1`), `read_cmdline`, `read_cwd`, `cpu_ticks(pid)` (stat fields 14 and 15), and `boot_time()` from `/proc/stat` `btime` for working out age.
- `src/sessions.rs`: moved here: `Session` and `load()`, refactored to take `&Snapshot`.
- `src/snapshot.rs`: `struct Proc { pid, ppid, start, uid, comm, cmdline, cwd, rss_kb, cpu_ticks, tag: Option<String> }` and `struct Snapshot { procs: HashMap<u32, Proc>, children: HashMap<u32, Vec<u32>>, sessions: Vec<Session>, self_ancestors: Vec<u32> }`. Build it from `/proc`, skipping processes owned by other users and kernel threads (empty cmdline).
- `src/fmt.rs`: moved here: `fmt_dur`, `fmt_mem`, `parse_dur`, `tail`, `head`, `paint`.
**Key steps:**
1. Run `cd /home/sibin/my-works/ccstat && git checkout -b procs`.
2. Move the code into the modules above with no logic changes. Keep `print_table` and `kill_flow` in a new `src/session_cmd.rs`.
3. Read `/proc/<pid>/environ` lazily, and only for processes whose uid matches the current user, which saves time. Split it on `\0`.
4. Make `Snapshot::build()` the only place that touches `/proc`. Later classification works only on `Snapshot`, so it can be unit-tested.
**Verify:** Run `~/.cargo/bin/cargo clippy -- -D warnings && ~/.cargo/bin/cargo run -- list`. The output should match `ccps list` from before the refactor: same sessions, same memory figures within normal noise.

### Phase 2: Leftover classification + ports + `procs` listing
**Goal:** `claude-ps procs` prints processes grouped by session with kind, memory, age and listening ports, and test orphans show up under a "session ended" group.
**Files to create/modify:**
- `src/leftovers.rs`: `enum Kind { Mcp, Bash, Detached, Orphan }`, `struct Leftover { proc: Proc, kind, session_id, ports: Vec<u16> }`, and `fn classify(&Snapshot, &Ports) -> Vec<Group>`.
- `src/ports.rs`: parses `/proc/net/tcp` and `/proc/net/tcp6`. Columns: `local_address` (hex `IP:PORT`), `st == "0A"`, and `inode`. Builds `HashMap<inode, port>`, then maps each PID's `/proc/<pid>/fd/*` links of the form `socket:[N]` to ports.
- `src/procs_cmd.rs`: table output (same style as `print_table`, colours through `paint`) and `--json` through `serde_json::json!`.
- `tests/classify.rs`: unit tests on hand-built `Snapshot` values.
**Key steps:**
1. Classification rules, in order:
   - Skip every registered live session PID, its whole subtree if it is a nested `claude` with its own `sessions/*.json`, and every ancestor of claude-ps itself.
   - A descendant of a live session PID is attributed to that session, **ancestry beats the environ tag** (this covers `/clear` or resume changing the session ID). It is `Mcp` if its parent is the claude PID and its cmdline is not a shell. Otherwise it is `Bash`.
   - A process that is not a descendant but whose tag matches a live session's `sessionId` is `Detached`. This is the `nohup npm run dev &` case, where the process was moved to `systemd --user`.
   - A process that is not a descendant and whose tag matches no live session is `Orphan`, grouped by tag UUID. Look up the cwd and name from the newest `~/.claude/projects/*/<uuid>.jsonl` if one exists, otherwise use the process's own cwd.
2. Fold child processes into their top-level leftover (for example `vite` → `esbuild`), so one row shows the summed memory and the union of ports, plus a `+N` child count.
3. Mark dev-server-like rows (any listening port, or a cmdline matching `vite|next|nuxt|webpack|nodemon|--watch|uvicorn|flask|artisan serve|php -S|http.server|cargo watch`) with a `*` so they are easy to spot.
4. Before the default output hides `Bash` shells, inspect real Bash-tool shells on this machine (`cat /proc/<pid>/cmdline | tr '\0' ' '` for a shell child of a live claude PID) and write down the pattern found (expected to contain `shell-snapshots/snapshot-`). By default, show `Detached`, `Orphan`, and `Bash`-kind processes that are not shells. `--all` also shows MCP servers and shells.
5. Footer: total leftover memory and orphan count.
6. Unit tests: (a) a descendant with a stale tag goes to the live session; (b) a reparented process with a live tag is `Detached`; (c) a dead tag is `Orphan`; (d) the claude-ps process and its ancestors are never listed; (e) hex port parsing: `00000000:1F90` gives 8080.
**Verify:**
```
CLAUDECODE=1 CLAUDE_CODE_SESSION_ID=deadbeef-0000-0000-0000-000000000000 setsid python3 -m http.server 8765 >/dev/null 2>&1 &
~/.cargo/bin/cargo test && ~/.cargo/bin/cargo run -- procs
```
The output must show a group `deadbeef (session ended)` with a `python3` orphan on port 8765. `cargo run -- procs --json | python3 -m json.tool` must parse. Leave the test server running for Phase 3.

### Phase 3: Kill actions
**Goal:** The user can kill one leftover, one session's leftovers, all orphans, or everything, safely and without hitting a reused PID.
**Files to create/modify:**
- `src/kill.rs`: `fn kill_tree(&Snapshot, pid, start) -> Result<(), String>`. Collect the subtree, check `alive(pid, start)` for every PID, send `-TERM` to children first and then the root, poll for 5 seconds at 100 ms intervals, `-KILL` anything still alive, and return what survived. Reuse `signal()` from the existing code.
- `src/procs_cmd.rs`: subcommands `procs kill <PID>...`, `--session <prefix>`, `--orphans`, `--all`, and `--yes`.
- `src/main.rs`: wire up the new argument patterns and update `usage()`.
**Key steps:**
1. Select targets: a PID must be a listed leftover (refuse PIDs that are not tagged, with a clear error). `--session` matches a UUID prefix of at least 4 characters and must be unambiguous. `--all` never includes MCP servers of **live** sessions unless `--include-mcp` is passed.
2. Confirm: print the target table. If stdin is a terminal, use the existing two-step confirmation (`[y/N]`, then type `kill`). If it is not a terminal, require `--yes` or exit 1 with the same message `kill_flow` uses.
3. Hard safety rules: never signal PID 1, any registered claude PID, or any ancestor of claude-ps, and never a process with a different uid. Re-read `/proc/<pid>/stat` immediately before each signal.
4. Report per row: `killed (TERM)`, `killed (KILL)`, or `still alive: <reason>`. Exit code 0 only if everything died.
**Verify:** `~/.cargo/bin/cargo run -- procs kill --orphans --yes`, then `curl -s -o /dev/null -w '%{http_code}' localhost:8765` must fail to connect, and `cargo run -- procs` must show no `deadbeef` group. Then, in a live Claude session, ask it to run `python3 -m http.server 8799` in the background. `procs` must show it under that session, and `procs kill --session <prefix>` must kill only that process while the session and its MCP servers keep running (`ccps list` still shows the session).

### Phase 4: Idle reaper + systemd user timer
**Goal:** `claude-ps reap` kills stale leftovers on its own every 5 minutes after a one-time `--install`, with a dry-run mode and a config file.
**Files to create/modify:**
- `src/reap.rs`:
  - State file `$XDG_STATE_HOME/claude-ps/reap.json` (default `~/.local/state/claude-ps/reap.json`), mapping `"pid:start"` to `{first_seen_ms, cpu_ticks, cpu_changed_ms}`.
  - Policy: kill an `Orphan` when `now - first_seen >= grace` (default 10 minutes) **and** its CPU ticks have not changed for at least the grace period.
  - With `--idle D`, also kill `Detached` or `Bash` leftovers of live sessions whose `status == "idle"` and `last_ms` is older than D. Never touch `Mcp` processes or sessions with `status == "busy"`.
- `src/config.rs`: `~/.config/claude-ps/config.json` with `{"grace":"10m","idle":null,"protect":["postgres","redis-server"],"protect_ports":[5432]}`. Protected comm or cmdline substrings, and protected ports, are never reaped.
- `src/systemd.rs`: `--install` writes `~/.config/systemd/user/claude-ps-reap.service` (`Type=oneshot`, `ExecStart=<current_exe> reap --yes`) and `claude-ps-reap.timer` (`OnBootSec=5min`, `OnUnitActiveSec=5min`), then runs `systemctl --user daemon-reload` and `systemctl --user enable --now claude-ps-reap.timer`. `--uninstall` reverses it.
- `README.md`: document `procs`, `kill`, `reap` and the config file.
**Key steps:**
1. `reap --dry-run` prints what would be killed and why (`orphan, cpu idle 14m`).
2. Real runs log one line per kill to stdout, which journald captures.
3. Prune state entries whose `pid:start` is no longer alive, and write the state file atomically (write to `.tmp`, then rename).
4. Use `std::env::current_exe()` (canonicalized) in the unit file. Print a warning if it is under `target/`, so the timer does not point at a dev build. Run `cargo install --path .` first.
5. Bump `Cargo.toml` to `0.2.0`.
**Verify:** Start the `deadbeef` http.server again. Run `cargo run -- reap --dry-run --grace 0s`: it must list the server. Then run `cargo install --path . && claude-ps reap --install && systemctl --user list-timers | grep claude-ps`. After `systemctl --user start claude-ps-reap.service` (two runs, because CPU idleness needs two samples, using `"grace":"0s"` in the config), `journalctl --user -u claude-ps-reap -n 20` shows the kill and port 8765 is closed.

### Phase 5 (optional): Tray indicator
**Goal:** A tray icon shows the leftover count and memory, and its menu offers "Kill orphans", per-session "Kill leftovers" and "Open list in terminal".
**Files to create/modify:**
- `Cargo.toml`: `[features] tray = ["dep:ksni"]`, plus a `[[bin]] name = "claude-ps-tray"` with `required-features = ["tray"]`.
- `src/bin/claude-ps-tray.rs`: a `ksni::Tray` implementation that refreshes the `Snapshot` every 10 seconds. The title is `"{n} leftovers · {mem}"`, and the menu items call `kill::kill_tree` (confirmation through a `zenity --question` subprocess if `zenity` is installed).
- `contrib/claude-ps-tray.desktop`: autostart entry for `~/.config/autostart/`.
**Key steps:**
1. Turn `src/` into a library (`src/lib.rs` re-exports the modules) so both binaries share the code.
2. Check the current `ksni` API through the Context7 docs before writing the code. Its API changed between 0.2 and 0.3, which moved to async/blocking variants.
**Verify:** `~/.cargo/bin/cargo run --features tray --bin claude-ps-tray` shows the icon in the GNOME top bar. With the `deadbeef` test server running, the count goes up within 10 seconds, and "Kill orphans" closes port 8765.

## Estimated Effort

**3 Claude Code sessions** (2 for the MVP).
- **Session 1:** Phases 1 and 2. Module refactor, snapshot, classification rules with unit tests, port parsing, the `procs` table and JSON, and checks against real sessions on this machine.
- **Session 2:** Phases 3 and 4. Tree kill with safety guards, kill subcommands, reaper policy and state file, config, systemd install/uninstall, README, `cargo install --path .`.
- **Session 3 (optional):** Phase 5 tray, then end-to-end testing for a day of normal use with `reap --dry-run` before switching on real reaping.

## Potential Blockers

- **The session file format is undocumented.** `~/.claude/sessions/*.json` and the environ tags (`CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`) are internal to Claude Code and could change between versions (2.1.311 and 2.1.325 both run here today). Keep all parsing in `snapshot.rs`/`sessions.rs` and make `procs` print a warning when the sessions directory is empty but `claude` processes exist.
- **Session ID changes.** `/clear` and `--resume`/fork can change a live session's ID while old children keep the old tag. The ancestry-first rule handles attached children. A process that was both detached **and** spawned before a `/clear` would show up as an orphan of the old ID while its real session is alive. Mitigation: the orphan grace period, plus showing the orphan's cwd so the user can tell. Optionally treat a dead tag whose cwd equals a live session's cwd as `Detached?`.
- **Processes that drop the tag.** Anything started with a cleared environment (`env -i`, sudo without `-E`, systemd-run, **Docker containers** run under dockerd) is invisible to the tag scan. `docker compose up` leftovers are a real case. Possible later work: match `docker ps --format json` labels (`com.docker.compose.project.working_dir`) against session cwds.
- **Nested Claude processes.** Subagents and `claude -p` started from a Bash tool inherit `CLAUDECODE=1`. They must be excluded through their own `sessions/*.json` entries. If a non-interactive mode ever stops registering there, those agents would be classified as leftovers and could be reaped. Guard: never classify a process whose `comm` or exe basename is `claude` (or a path containing `native-binary/claude`) as a leftover.
- **Killing the wrong thing.** PID reuse, killing claude-ps's own ancestors, and the user's own long-running databases. These are covered by start-time checks, the ancestor list, the uid filter, the `protect` config list, and `--dry-run`. Do not enable the timer until a day of dry runs looks right.
- **Reading `/proc` costs time.** Reading environ, cmdline, fd and stat for every user process runs on each refresh. It should stay under 100 ms for a few hundred processes. Measure with `time claude-ps procs`, and cache the tag per `pid:start` inside the tray loop.
- **The tray depends on the GNOME AppIndicator extension.** It is enabled by default on Ubuntu but missing on stock GNOME, which is why the tray is optional and the systemd timer is the main auto-kill path.
- **Git and publishing.** The repo already has a personal remote, so no account question is needed, but commit, push and `cargo publish` (claude-ps is set up for crates.io) only when the user asks.

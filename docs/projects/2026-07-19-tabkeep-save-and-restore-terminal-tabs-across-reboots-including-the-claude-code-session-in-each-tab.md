# tabkeep — save and restore terminal tabs across reboots, including the Claude Code session in each tab

**Source:** <https://github.com/rohansx/tabkeep>
**Discovered:** 2026-07-19
**Viability:** 3/4

> Tiny but sharp dev-productivity idea for anyone juggling many Claude Code sessions (the user's daily reality). Trivially within Claude's autonomous build capacity to extend — e.g. adding tmux/kitty support or pairing with `claude --continue` session mapping — or to reimplement for the user's own terminal setup.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

Small Python CLI (repo is tiny, created yesterday) — an MVP that snapshots tab cwd/title plus maps each tab to its latest Claude Code session (~/.claude/projects JSONL) and restores via `claude --resume <id>` is comfortably 1-2 Claude sessions for the user's own terminal emulator. It fills a real gap: this Linux user runs many concurrent Claude Code sessions (csess tooling, multiple agent projects) but has nothing that reconstructs the whole multi-tab agent workspace after a reboot; tmux-resurrect is the mature alternative but restores tmux panes/processes, not terminal-emulator tabs and not the specific Claude session per tab, so the concept is meaningfully fresh. Docked daily_utility because the tool only pays off at reboot/crash — valuable but not an every-single-day interaction — still, at 3/4 it's a strong, immediately buildable fit.

---

## Implementation Plan

## Overview

Build **tabkeep** for this machine's actual setup: the reference repo (rohansx/tabkeep) targets Konsole/Ghostty, neither of which is installed here. This environment runs **gnome-terminal + tmux**, with Claude Code sessions living in named tmux sessions (`cc_*`, created by the csess tooling). The reimplementation snapshots the full agent workspace — every tmux session/window/pane (cwd, title, running command) plus each pane's active Claude Code session id resolved from `~/.claude/projects/<encoded-cwd>/*.jsonl` — and restores it after reboot: tmux tree rebuilt, `claude --resume <session-id>` relaunched in the right panes, and gnome-terminal tabs reopened attached to the right tmux sessions. Auto-snapshot runs on a systemd user timer so the state is always fresh at crash/reboot time.

## Stack Recommendation

- **Python 3.14 stdlib only** (already at `/usr/bin/python3`, v3.14.3) — `subprocess`, `json`, `pathlib`, `argparse`, `shutil`. No pip dependencies.
- **tmux CLI** as the state API: `tmux list-panes -a -F '...'` for enumeration, `tmux new-session` / `new-window` / `send-keys` for restore.
- **/proc scanning** for gnome-terminal tab discovery (gnome-terminal has no query API; its shell children's `/proc/<pid>/cwd` and cmdline reveal per-tab state).
- Single-file-per-module package at `/home/sibin/my-works/tabkeep/`, exposed as `tabkeep` via a symlink in `~/.local/bin`.
- **systemd user units** for periodic auto-snapshot (survives crashes, not just clean shutdowns).

## MVP Scope

**In:**
- `tabkeep snap` — capture all tmux sessions → windows → panes: name, cwd, title, foreground command, and (for panes running `claude`) the Claude session id mapped from cwd via the newest `.jsonl` in `~/.claude/projects/`. Also capture non-tmux gnome-terminal tabs (cwd only) via /proc.
- `tabkeep restore` — rebuild tmux sessions/windows/panes with correct cwds; in Claude panes, type-and-run `claude --resume <id>`; open one gnome-terminal window with a `--tab` per saved tab (tmux tabs attach, plain tabs get their cwd).
- `tabkeep ls` — human-readable view of the latest snapshot.
- Rotating snapshots (keep last 10) in `~/.local/share/tabkeep/`.
- systemd user timer snapshotting every 5 minutes + on shutdown.

**Out (post-MVP):** kitty/Konsole/Ghostty backends, opencode/pi agent detection, pane split geometry fidelity, scrollback capture, GUI.

## Implementation Phases

### Phase 1: Snapshot engine (tmux + Claude session mapping)
**Goal:** `tabkeep snap` writes a JSON snapshot accurately describing every tmux pane and its Claude Code session id.
**Files to create/modify:**
- `/home/sibin/my-works/tabkeep/tabkeep/__init__.py` — package marker, `__version__`
- `/home/sibin/my-works/tabkeep/tabkeep/tmux.py` — tmux enumeration: run `tmux list-panes -a -F '#{session_name}\t#{window_index}\t#{window_name}\t#{pane_index}\t#{pane_current_path}\t#{pane_current_command}\t#{pane_pid}'` and parse into dataclasses
- `/home/sibin/my-works/tabkeep/tabkeep/claude_sessions.py` — cwd → Claude session id resolver
- `/home/sibin/my-works/tabkeep/tabkeep/snapshot.py` — assemble + write `~/.local/share/tabkeep/snapshot-<ISO timestamp>.json` and a `latest.json` symlink; prune to last 10
- `/home/sibin/my-works/tabkeep/tabkeep/cli.py` — argparse entry with `snap` and `ls` subcommands
- `/home/sibin/my-works/tabkeep/bin/tabkeep` — `#!/usr/bin/env python3` shim calling `tabkeep.cli.main()`
**Key steps:**
1. Implement `tmux.py::list_panes()` using the format string above; return `[]` gracefully when `tmux ls` exits nonzero (no server).
2. Implement `claude_sessions.py::session_for_cwd(cwd)`: encode cwd the way Claude Code does (`/home/sibin/my-works/myplanner` → `-home-sibin-my-works-myplanner`, i.e. replace `/` and `.` per the dirs visible in `~/.claude/projects/`), glob `~/.claude/projects/<encoded>/*.jsonl`, return the stem of the most-recently-modified file. Verify encoding empirically against existing dirs like `-home-sibin--config-tipcoder-assistant` (note `.config` → `--config`) before hardcoding.
3. Detect "Claude pane": `pane_current_command == "claude"`, OR walk `/proc/<pane_pid>/task/*/children` for a descendant whose `/proc/<pid>/cmdline` starts with `claude` (covers claude launched under a shell). Record `agent: {"type": "claude", "session_id": ...}` on the pane.
4. `snapshot.py::take()` builds `{"taken_at": ..., "tmux_sessions": [...], "plain_tabs": []}` (plain_tabs filled in Phase 3), writes timestamped file, updates `latest.json`, prunes old snapshots.
5. Wire `cli.py` with `snap` and `ls` (pretty-print latest.json: session → windows → panes, flagging Claude panes with their session id). `chmod +x bin/tabkeep`; `ln -sf /home/sibin/my-works/tabkeep/bin/tabkeep ~/.local/bin/tabkeep`.
**Verify:** `tabkeep snap && tabkeep ls` — output must list the live `cc_LwKallr*` tmux sessions with correct cwds, and any pane currently running Claude Code must show a session id that exists as `~/.claude/projects/<encoded>/<id>.jsonl` (check with `ls`).

### Phase 2: Restore engine
**Goal:** After `tmux kill-server`, `tabkeep restore` rebuilds all tmux sessions with correct cwds and relaunches each Claude pane via `claude --resume <id>`.
**Files to create/modify:**
- `/home/sibin/my-works/tabkeep/tabkeep/restore.py` — snapshot → tmux reconstruction
- `/home/sibin/my-works/tabkeep/tabkeep/cli.py` — add `restore [--dry-run] [--file PATH]`
**Key steps:**
1. For each saved session absent from current `tmux ls`: `tmux new-session -d -s <name> -c <first_pane_cwd>`; for additional windows `tmux new-window -t <name>: -n <win_name> -c <cwd>`. Skip sessions that already exist (idempotent — safe to run twice).
2. For each Claude pane, relaunch with `tmux send-keys -t <session>:<win>.<pane> 'claude --resume <session_id>' Enter`. Guard: verify the `.jsonl` still exists; if not, fall back to `claude --continue` sent from that cwd. Stagger sends with ~0.5s sleep so shells are ready.
3. Non-Claude panes: restore cwd only (the shell starts there via `-c`); do NOT replay arbitrary foreground commands in MVP (dangerous). Log what was skipped.
4. `--dry-run` prints the exact tmux commands without executing. Default restore reads `latest.json`; `--file` accepts any rotated snapshot.
**Verify:** `tabkeep snap`, then in a throwaway test: `tmux new-session -d -s tk_test -c /tmp && cd /home/sibin/my-works/myplanner && tmux send-keys -t tk_test 'claude' Enter` (or use an existing cc_ session), snap again, `tmux kill-session -t tk_test`, run `tabkeep restore`, then `tmux capture-pane -pt tk_test` shows a Claude Code session resumed (banner + prior conversation context).

### Phase 3: gnome-terminal tabs
**Goal:** Plain (non-tmux) gnome-terminal tabs are captured with their cwd and reopened as tabs on restore.
**Files to create/modify:**
- `/home/sibin/my-works/tabkeep/tabkeep/gterm.py` — /proc-based tab discovery + `gnome-terminal --tab` relaunch
- `/home/sibin/my-works/tabkeep/tabkeep/snapshot.py` — populate `plain_tabs`
- `/home/sibin/my-works/tabkeep/tabkeep/restore.py` — reopen tabs
**Key steps:**
1. In `gterm.py`, find the `gnome-terminal-server` PID (`pgrep -f gnome-terminal-server`), enumerate its direct children (`/proc/<pid>/task/<pid>/children`) — each child shell = one tab. Read each child's `/proc/<cpid>/cwd` symlink for the tab's directory.
2. Classify tabs: if a tab's process tree contains `tmux` client attached to session X (parse `tmux list-clients -F '#{client_pid} #{session_name}'` and match against descendants), record it as `{"kind": "tmux-attach", "session": X}`; else `{"kind": "shell", "cwd": ...}`. Dedupe: a tmux-attached tab must not also spawn a duplicate plain tab.
3. Restore: build one command — `gnome-terminal --tab --working-directory=<cwd> [-- tmux attach -t <session>]` repeated per tab — so all tabs land in a single window. Run tmux restoration (Phase 2) BEFORE opening attach tabs.
4. Add `--no-gui` flag to restore for headless/SSH contexts where launching gnome-terminal is wrong.
**Verify:** Open 2 extra gnome-terminal tabs in distinct dirs (one running `tmux attach -t cc_LwKallr`), `tabkeep snap`, `tabkeep ls` shows both with correct cwd/kind; `tabkeep restore --dry-run` prints one `gnome-terminal` invocation containing both `--tab` clauses.

### Phase 4: Auto-snapshot service + docs
**Goal:** Snapshots happen automatically every 5 minutes and at shutdown, so `tabkeep restore` after any reboot recovers the pre-reboot workspace with zero manual prep.
**Files to create/modify:**
- `/home/sibin/my-works/tabkeep/systemd/tabkeep-snap.service` — `Type=oneshot`, `ExecStart=%h/.local/bin/tabkeep snap`
- `/home/sibin/my-works/tabkeep/systemd/tabkeep-snap.timer` — `OnBootSec=2min`, `OnUnitActiveSec=5min`
- `/home/sibin/my-works/tabkeep/systemd/tabkeep-shutdown.service` — oneshot with `ExecStop=%h/.local/bin/tabkeep snap`, `RemainAfterExit=yes`, `Before=exit.target` (fires on clean logout/shutdown)
- `/home/sibin/my-works/tabkeep/install.sh` — symlink binary, `mkdir -p ~/.config/systemd/user`, copy units, `systemctl --user daemon-reload && systemctl --user enable --now tabkeep-snap.timer tabkeep-shutdown.service`
- `/home/sibin/my-works/tabkeep/README.md` — usage, restore-after-reboot walkthrough, snapshot format
- `/home/sibin/my-works/tabkeep/tabkeep/cli.py` — add `tabkeep snapshots` (list rotated files with timestamps) and `tabkeep restore --pick` (choose from rotation)
**Key steps:**
1. Write the three unit files; ensure `tabkeep snap` exits 0 even with no tmux server (empty snapshot must not clobber a good one — skip writing if snapshot captures zero sessions AND zero tabs, log instead).
2. Write `install.sh` (idempotent) and run it.
3. Confirm timer scheduling: `systemctl --user list-timers | grep tabkeep`.
4. Write README including the one-liner recovery flow: reboot → open a terminal → `tabkeep restore`.
**Verify:** `systemctl --user start tabkeep-snap.service && ls -lt ~/.local/share/tabkeep/ | head -3` shows a fresh snapshot; `systemctl --user list-timers` shows `tabkeep-snap.timer` with a NEXT time ~5 min out.

## Estimated Effort

**2 Claude Code sessions.**
- **Session 1:** Phases 1–2 — snapshot engine, Claude session-id mapping (including empirically verifying the `~/.claude/projects` path-encoding rules), restore engine, kill-and-restore test against a throwaway tmux session.
- **Session 2:** Phases 3–4 — /proc-based gnome-terminal tab discovery (the fiddliest part; needs live iteration), systemd units, install script, README, full end-to-end rehearsal (snapshot → kill tmux server → restore → confirm Claude sessions resumed).

## Potential Blockers

- **Claude Code project-dir encoding:** the `~/.claude/projects` encoding is not officially documented (`/` → `-`, and `.` also becomes `-`, producing collisions like `--config`). Must be derived empirically from existing dirs; a wrong encoder silently yields "no session found" → restore falls back to `claude --continue`, which may resume the wrong conversation if multiple projects share an encoded name.
- **`claude --resume <id>` behavior:** must be run from the matching cwd; resuming a session that is *already open elsewhere* may create a forked session file. Restore should only run after reboot (no live claude processes) — add a guard that warns if `pgrep -x claude` finds live processes.
- **gnome-terminal has no introspection API:** tab discovery relies on /proc process-tree heuristics; tab *titles* and tab *order* are not recoverable. Acceptable MVP loss, but don't promise title restore.
- **Shutdown-time snapshot is best-effort:** systemd user `ExecStop` on session teardown races with tmux server death; the 5-minute timer is the real safety net (worst case: 5 minutes of staleness in which panes changed).
- **Live cc_ sessions are production:** the user's real Claude sessions run in `cc_*` tmux sessions during development — all destructive testing (kill-session/kill-server) must use throwaway `tk_test*` sessions only.
- **Repo creation:** per user policy, ask personal-vs-work account before creating any GitHub remote for `/home/sibin/my-works/tabkeep` (almost certainly personal → `git@github-personal:sibincbaby/tabkeep.git`), and do not push until confirmed.

# claude-fleet — Manager Session for Durable Headless Claude Code Workers

**Source:** [exPardus/fleet](https://github.com/exPardus/fleet)
**Language:** Python 3.10+ (single file, stdlib only) · **Platform:** CLI + Claude Code plugin + statusline
**Date discovered:** 2026-08-06

## What it is

One Claude Code session acting as a manager that spawns, steers, and monitors many headless Claude Code workers running in parallel across different projects. The key design choice: workers are not processes the fleet babysits — they are *disposable sessions addressed by `--session-id` / `--resume`*, with all state living in plain files (a worker registry, per-worker mailboxes, per-worker journals). Any surface — CLI, plugin slash command, statusline — reads the same files, so nothing needs locks, probes, or a daemon.

The genuinely new idea is **mid-turn steering without attaching**: you drop a message into a worker's mailbox file, and the worker picks it up between tool calls. You redirect a running agent without opening its terminal.

Around that: per-worker token ceilings enforced fleet-side before each turn, automatic parking of workers that hit usage limits (with resume-later), respawn-to-reset-context while preserving the work journal, and a git-tracked knowledge base of playbooks and lessons that accumulates across campaigns.

Problem it solves: running four Claude Code sessions today means four terminal tabs, four mental context switches, and no way to say "actually, skip the migration, do the tests first" without stopping one and losing its place.

## Why it fits

- Core interest: **Claude/LLM tooling** — this is Claude Code orchestration, built entirely out of the CLI's own primitives
- Core interest: **agent UIs** — a registry + statusline is an agent interface, just a file-backed one
- Core interest: **dev productivity** — the daily-driver problem of "I have more parallel work than attention"
- `weekend_buildable = 1`: a registry JSON, a spawn wrapper around `claude -p --session-id`, and a status poller is a genuinely small program. Single-file stdlib-only Python proves the point
- Directly relevant to how this very repo already works — a scheduled headless agent job with no human attached

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Registry file + `subprocess` spawn + mailbox poll is ~400 lines; upstream ships it as one file with no dependencies |
| fills_gap | 1 | Distinct from the terminal multiplexers already in the backlog — this is *headless, durable, unattended* work, not pane management |
| novel | 1 | 3 stars, brand new. Mailbox-based mid-turn steering of a headless agent is not a pattern anything else implements |
| daily_utility | 1 | Any day with more than one long-running agent task, which is most of them |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Python 3.11+          — stdlib only: subprocess, json, pathlib, argparse
JSON files            — registry, mailboxes, journals. No SQLite, no daemon
claude -p             — headless worker: --session-id / --resume / --output-format stream-json
Claude Code hooks     — PreToolUse hook is the mailbox drain point
statusline            — a one-line script that cats the registry summary
```

No database, no message broker, no supervisor process. The filesystem is the coordination primitive — that is what makes multiple readers safe and what makes the whole thing survive a reboot.

Concurrency note: mailbox writes come from the manager, drains from the worker's hook. Use write-to-temp + `os.replace()` for atomic swaps rather than a lock file.

## MVP Scope (1 Claude session)

1. `fleet spawn <name> --cwd <path> "<task>"` — start `claude -p` with a generated `--session-id`, record `{name, session_id, cwd, pid, state, started_at}` in `~/.fleet/registry.json`
2. `fleet ls` — print one line per worker: name, state, cwd, elapsed, last journal line
3. Each worker appends its turn summary to `~/.fleet/journals/<name>.md`
4. `fleet say <name> "<message>"` — append to `~/.fleet/mailbox/<name>.jsonl`
5. A `PreToolUse` hook in each worker reads and clears its mailbox, surfacing the message to the agent
6. Verify: spawn two workers in different repos, steer one mid-turn, confirm it changes course

## Phases

### Phase 1: Registry + Spawn + List (2-3h)
- `~/.fleet/registry.json` — the single source of truth, written atomically via temp + `os.replace()`
- `fleet spawn`: generate a UUID session id, `subprocess.Popen` the worker detached, record the entry
- `fleet ls`: read the registry, probe liveness with `os.kill(pid, 0)`, mark dead entries `stopped`
- `fleet kill <name>` / `fleet rm <name>` for cleanup
- Verify: spawn two workers, `ls` shows both running; kill one, `ls` shows it stopped without a stale row

### Phase 2: Journals + Statusline (2h)
- Worker's `Stop` hook appends `{timestamp, turn_summary, tokens, cost}` to its journal
- `fleet log <name>` tails the journal; `fleet ls` shows the most recent line inline
- A statusline script prints `⚓ 3 running · 1 parked · $2.14` from one registry read
- Verify: statusline updates within one turn of a worker finishing

### Phase 3: Mailbox Steering (3h)
- `fleet say <name> "<msg>"` appends a JSON line to `~/.fleet/mailbox/<name>.jsonl`
- A `PreToolUse` hook in the worker reads the mailbox, truncates it, and returns the messages as hook output so the agent sees them before its next tool call
- `fleet say --all` broadcasts to every running worker
- Verify: start a worker on a long refactor, `fleet say` it to stop and write tests instead, confirm the redirect happens on the next tool call — not at the end of the turn

### Phase 4: Token Ceilings + Parking (2-3h)
- `--token-ceiling N` per worker, stored in the registry; the hook sums journal usage and refuses the next turn past the ceiling
- Detect usage-limit responses in worker output; mark the worker `parked` with a `resume_after` timestamp
- `fleet resume <name>` / `fleet resume --all` restarts parked workers via `claude --resume <session-id>`
- Verify: set a deliberately low ceiling, confirm the worker parks cleanly instead of dying, and that `resume` continues the same session rather than starting fresh

### Phase 5: Respawn + Knowledge Base (2-3h)
- `fleet respawn <name>` — start a fresh session in the same cwd, seeded with the worker's journal as context. Resets a bloated context window without losing the thread
- `~/.fleet/kb/` as a git repo: `INDEX.md`, `playbooks/`, `lessons/`
- Workers append a lesson on failure; the manager reads `INDEX.md` at startup
- `fleet doctor` — check hook installation, orphaned registry rows, unreadable mailboxes, missing session files
- Verify: respawn a worker after 100k tokens, confirm it resumes the task correctly from journal context alone

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Registry + Spawn + List | 2-3h |
| Journals + Statusline | 2h |
| Mailbox Steering | 3h |
| Token Ceilings + Parking | 2-3h |
| Respawn + Knowledge Base | 2-3h |
| **Total** | **11-14h (~2 weekends)** |

Phases 1-3 (spawn, monitor, steer) are the whole value proposition: **7-8h**.

## Blockers / Risks

- **Mid-turn steering depends entirely on the `PreToolUse` hook contract.** If the hook's stdout is not surfaced to the model, or the hook JSON schema changes, the headline feature silently stops working — the worker keeps going and the message is swallowed. Add a fleet-side ack (worker writes a `steered` journal line) so a silent failure is visible in `fleet ls`
- Parallel headless workers all draw on the same account rate limit. Four workers will hit usage limits roughly four times faster; the parking logic is load-bearing, not a nicety
- Unattended workers with a permissive `--permission-mode` are running Claude Code with no human in the loop. Scope each worker's `cwd` tightly and prefer an explicit allowlist over `bypassPermissions` — a bad tool call in an unattended session has nobody to catch it
- Registry writes race if two `fleet` invocations spawn simultaneously. Atomic replace prevents corruption but can still lose an entry; if that matters, move to one file per worker instead of one shared registry
- `os.kill(pid, 0)` liveness gives false positives after PID reuse. Cross-check the PID's start time (`/proc/<pid>/stat` field 22 on Linux) before trusting it
- The knowledge base accumulates until it does not fit in context. Cap `INDEX.md` and archive old lessons, or the manager's startup read eats the budget the workers need

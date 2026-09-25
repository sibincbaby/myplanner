# Clayrune — Mission Control Dashboard for Parallel Claude Code Agents

**Source:** <https://github.com/clayrune-io/clayrune>
**Discovered:** 2026-09-25
**Viability:** 4/4

> You run an agent on Project A while you work on Project B. It finishes, needs a decision, and you miss it because you are in a different terminal. Clayrune gives you one browser tab that catches the interrupt across every project, plus a cron scheduler so the agent is already running when you arrive in the morning.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

**Weekend-buildable (1):** Flask + JSON files with no database. The upstream is MIT and the core loop (start agent subprocess, poll stdout, write status JSON, render in browser) is an afternoon build.

**Fills a gap (1):** Running multiple Claude Code sessions across projects today means multiple terminal windows with no shared view. The gap is a single interface that shows all running agents, their status, and which ones are waiting for human input.

**Novel (1):** Prior fleet-management plans (claude-fleet Aug 6, agentmux Aug 24, cockpit Aug 28) tracked running agents. None of them added a scheduler with persistence and a cross-session memory that learns from past runs. The NEEDS YOU interrupt model — agents signal explicitly when they need a human, not just "running / stopped" — is the differentiator.

**Daily utility (1):** Every coding session potentially runs an agent. A dashboard that shows all of them is opened every day.

---

## Implementation Plan

## Overview

Three moving parts:

1. **Agent runner:** a subprocess wrapper that launches `claude` (or any CLI agent), streams its output to a per-session log file, and detects when the agent pauses for input. The pause detection is the key mechanism: Claude Code writes `AskUserQuestion` output to stdout in a structured way; the runner watches for that pattern and flips the session status to `NEEDS_YOU`.
2. **Dashboard:** a single-page app (plain HTML + JS, no build step) that polls a status JSON file and renders the session list. Sessions in `NEEDS_YOU` state surface at the top with a link to their live log.
3. **Scheduler:** a cron-style task list stored in a JSON file. On startup, the scheduler checks pending tasks and kicks off any that are due. Tasks can be one-time, daily, or on an interval.

Cross-session memory is an additive layer: on session end, the runner calls a small Python function that reads the session log, extracts key decisions (by looking for `AskUserQuestion` answers and final commit messages), and appends them to a per-project `memory.jsonl` file. On session start, the last N entries are injected as `additionalContext` via a `UserPromptSubmit` hook.

## Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Backend | Python 3.9+, Flask | matches upstream; minimal; subprocess management is straightforward |
| Frontend | Vanilla JS + `fetch` | no build step; dashboard is a polling UI, not a reactive one |
| Storage | JSON files on disk | matches upstream; no database setup; portable |
| Agent subprocess | `subprocess.Popen` + streaming read | only way to capture live output from `claude` |
| Scheduler | APScheduler (lightweight) or plain `threading.Timer` | no Celery/Redis needed at this scale |
| Memory injection | `UserPromptSubmit` hook → `additionalContext` | the documented way to add per-session context |

## MVP Scope

**In:**

1. Launch a single `claude` process for a given project directory; stream its stdout to a log file.
2. Flask endpoint `/status` that returns the live session list as JSON (project, status, last-output-line, elapsed).
3. Detect `NEEDS_YOU` state: scan the last N lines of the log for the pattern that indicates Claude Code is waiting for input (specifically: `"type": "ask_user"` in the structured JSON output, or the text `? ` prompt with a question mark if JSON output is off).
4. Browser dashboard: auto-refreshes every 5 seconds, shows session table, `NEEDS_YOU` rows highlighted, click-through to the live log tail.
5. Stop/restart controls via POST endpoints.

**Out of v1:** scheduler, cross-session memory, multi-model support, mobile access, git worktree isolation, GitHub Issues sync, cost tracking.

## Phases

**Phase 1 — Single-project runner and status page (≈3 hours).**
Write the subprocess wrapper, the log streaming, and the NEEDS_YOU detector. Serve the status endpoint. Build the minimal HTML dashboard. Run one real agent session and confirm the status flips correctly when Claude Code asks for input.

The NEEDS_YOU detection is the critical test here. Claude Code's structured output format (JSON mode) makes this reliable; non-JSON mode requires a heuristic. Test both: run with `--output-format json` first, then without.

**Phase 2 — Multi-project support (≈2 hours).**
Extend the runner to manage a list of projects. Each project gets its own subprocess, its own log file, and its own status entry. The dashboard shows all of them. Add start-on-boot config: a `projects.json` file that lists which projects have always-on agents.

**Phase 3 — Scheduler (≈2 hours).**
A `schedule.json` file with entries like `{"project": "myapp", "prompt": "run tests and push fixes", "cron": "0 9 * * 1-5"}`. On startup, APScheduler loads the file and fires agents at the right time. The scheduler only launches an agent if no agent is already running for that project.

**Phase 4 — Cross-session memory (≈2 hours).**
Session-end: after a Claude Code process exits, parse the last 200 lines of its log. Extract `AskUserQuestion` question/answer pairs and any commit messages. Append to `projects/<name>/memory.jsonl`.
Session-start: the `UserPromptSubmit` hook reads the last 5 `memory.jsonl` entries for the current project and injects them as `additionalContext`. Cap injection at 500 tokens.

**Phase 5 (optional) — Git worktree isolation (≈2 hours).**
Before launching an agent, create a git worktree for the session. On session end, merge the worktree back or discard it. This lets two agents work on the same project in parallel without clobbering each other. Requires `git worktree` support (Git 2.5+) and careful cleanup on crash.

## Effort Estimate

**One weekend for Phases 1–3** (~7 hours), with Phase 4 addable in an evening. Phase 5 is optional and adds another 2–3 hours.

## Blockers and Risks

- **Claude Code output format changes.** The NEEDS_YOU detection depends on recognizing Claude Code's wait-for-input output. If the output format changes (which it has between versions), the detector silently breaks. Mitigation: implement two detection strategies (JSON structured output and text heuristic) and test on startup that at least one fires correctly.
- **Subprocess lifecycle on crashes.** If the Flask server crashes while agents are running, the subprocesses become zombies. Use a PID file and a startup cleanup pass to kill stale processes.
- **The scheduler races with manual sessions.** If you manually start an agent in a terminal, the dashboard does not know about it. Mitigation: scope v1 to only track processes the dashboard launched; document this clearly.
- **Memory injection size.** A 500-token cap is a heuristic. Long decision entries or many projects can exceed it. Mitigation: summarize each `memory.jsonl` entry to one line at write time, not read time.
- **Lane depth (cockpit, claude-fleet, agentmux).** All three of those plans exist. Build this only if the scheduler and NEEDS_YOU interrupt model are the features you actually want. If you just need "see all running agents," upstream clayrune installs in two commands (MIT license).

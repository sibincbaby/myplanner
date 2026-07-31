# AgentSquad

> A multi-agent coding coordinator for Claude Code: three specialized agents — Planner, Coder, and Reviewer — collaborate on a shared task YAML file, each running as a focused Claude Code session, coordinated by a lightweight Python orchestrator.

**Inspired by:** [agencyswarm/CLAII](https://github.com/agencyswarm/CLAII)  
**Date discovered:** 2026-07-31

---

## What gap it fills

CLAII's key idea is that *multi-agent orchestration makes individual agents sharper*: a Planner that only plans produces better plans than a single agent that plans and codes simultaneously. Each agent's narrow focus keeps its context clean and its reasoning tight.

Claude Code today runs as a single generalist agent. You can spawn sub-agents via the Agent tool inside a workflow, but there's no native mechanism for a persistent multi-role team that hands off structured work between sessions. AgentSquad builds exactly this: three roles, each with its own CLAUDE.md skill set and system prompt, sharing a `task.yaml` handoff file as the communication channel. The orchestrator watches the handoff file and launches the right agent when its turn arrives.

Concrete daily value: tackle a complex feature by telling the Planner what you want in one sentence — it writes a structured `task.yaml` with subtasks, acceptance criteria, and file list. The Coder picks that up and implements. The Reviewer checks the diff against the acceptance criteria and either approves or returns the task to the Coder with specific change requests. You stay in the loop on the kanban column, not the implementation details.

Viability score: **4/4** (weekend_buildable ✅, fills_gap ✅, novel ✅, daily_utility ✅)

---

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Agents | Claude Code sub-sessions (via `claude -p`) | Each agent is a focused Claude Code run with its own CLAUDE.md |
| Handoff | `task.yaml` in repo root | Structured, human-readable, git-trackable |
| Orchestrator | Python `watchdog` + `subprocess` | Watches task.yaml for status changes, launches agents |
| Agent skills | `SKILL.md` per role | Planner skill, Coder skill, Reviewer skill |
| CLI | `squad <task-description>` | Single command kicks off the full pipeline |
| Storage | `.squad/runs/<id>/` | Per-run logs, agent transcripts, and diffs |

---

## MVP scope (1-2 Claude sessions)

**Session 1 — Planner agent + handoff format:**
- Define `task.yaml` schema: `{id, description, status: [planned|coding|reviewing|done], subtasks[], acceptance_criteria[], files_to_touch[], notes[]}`
- Write Planner SKILL.md: given a one-sentence task, produce a valid `task.yaml` with 3-5 subtasks and concrete acceptance criteria
- `orchestrator.py`: watches task.yaml, launches `claude -p "$(cat .squad/planner-prompt.md) $(cat task.yaml)"` when status=`new`
- Test: feed the Planner 3 different task descriptions, evaluate quality of produced `task.yaml`

**Session 2 — Coder + Reviewer agents:**
- Coder SKILL.md: given `task.yaml` with status=`planned`, implement each subtask, update `status` to `reviewing`, populate `notes[]` with what changed
- Reviewer SKILL.md: given `task.yaml` with status=`reviewing` and the git diff, check each acceptance criterion, set `status` to `done` or `needs-changes` with specific review comments
- `squad <description>` CLI: creates `task.yaml`, runs orchestrator as a background process
- End-to-end test: one full feature from plain-English description to approved diff

---

## 3-Phase roadmap

### Phase 1 — Planner (Session 1)
task.yaml schema + Planner skill. Orchestrator watcher. Planner runs and produces structured task decomposition. Human reviews and approves the plan before Coder starts.

### Phase 2 — Coder + Reviewer (Session 2)
Coder and Reviewer skills. Retry loop: if Reviewer returns `needs-changes`, Coder gets the review notes and revises. Max 3 retry cycles before escalating to human.

### Phase 3 — Parallel subtasks + kanban (Session 3)
Split independent subtasks across parallel Coder agents (one `claude -p` per subtask). Add a simple HTML kanban view that renders `.squad/runs/` state as a status board. Optional: auto-create a GitHub PR from the approved diff with task description as PR body.

---

## Effort estimate

| Phase | Effort | Output |
|-------|--------|--------|
| Phase 1 | 1 Claude session (~90 min) | task.yaml schema + Planner + orchestrator |
| Phase 2 | 1 Claude session (~90 min) | Full Planner → Coder → Reviewer loop |
| Phase 3 | 1 Claude session (~90 min) | Parallel subtasks + kanban view |

Total: **3 sessions, ~4.5 hours elapsed**

---

## Blockers / watch-outs

- **Context bleed between agents**: Each agent must start with a clean context seeded only from task.yaml and its SKILL.md — never from the prior agent's full transcript. Enforce via separate `claude -p` invocations with explicit system prompts.
- **Coder autonomy vs safety**: The Coder agent has shell access; scope it to the project directory only using Claude Code's `--allowed-tools` flag to prevent accidental system-wide changes.
- **task.yaml write conflicts**: If orchestrator and human both try to update task.yaml simultaneously, use a `.lock` file or rely on git's atomic write + rebase for conflict resolution.
- **Infinite review loops**: Cap retry cycles at 3 in orchestrator; on the third rejection, write `status: escalated` and surface the review notes to the human via terminal notification.

---

## Why now

CLAII's insight — that multi-agent coordination produces better outputs than a single generalist agent — maps directly onto Claude Code's new `claude -p` (programmatic mode) capability, which lets you spawn focused Claude Code sessions from a script. The SKILL.md format gives each agent a clean, swappable context instead of a bloated monolith system prompt. Building AgentSquad now means you get structured multi-agent coding on every project, not just one-off manual sub-agent invocations.

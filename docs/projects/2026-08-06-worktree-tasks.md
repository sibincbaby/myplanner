# t — Task-Centric Worktrees Linked to Agent Conversations

**Source:** [PiemonteF/t](https://github.com/PiemonteF/t) · [Show HN 49185456](https://news.ycombinator.com/item?id=49185456)
**Language:** Python 3 (git + ripgrep) · **Platform:** Terminal, multiplexer-agnostic
**Date discovered:** 2026-08-06

## What it is

A task manager where the unit of work is a named task, and each task owns both a git worktree *and* the agent conversations that happened in it. `t new fix-auth` creates the branch and worktree; every Claude/Codex/Gemini session started inside it is recorded to `.agent/<task>.json`. Come back a week later and `t resume fix-auth` gives you the worktree and a picker of the conversations that built it.

The insight it borrows from Conductor (the Mac app) is that the worktree↔conversation link should be **written down, not derived**. Session ids are recorded at creation time rather than reconstructed later from transcript paths — which is why conversations survive the worktree being deleted.

The insight it does *not* borrow is the GUI. It is explicitly bring-your-own-multiplexer: it manages no panes, and works the same under tmux, Zellij, WezTerm, or bare terminal tabs.

Problem it solves: the worktree is trivially recoverable, the reasoning is not. Right now, "why did I structure it that way?" means grepping `~/.claude/projects/` by hand and guessing which of nine transcripts belongs to the branch you are looking at.

## Why it fits

- Core interest: **Claude/LLM tooling** — records Claude Code session ids and resumes them directly
- Core interest: **dev productivity** — the actual daily friction of multi-branch, multi-agent work
- Core interest: **agent UIs** — the conversation picker and cross-task search are the interface
- `weekend_buildable = 1`: `git worktree add` plus a JSON file plus `rg` over transcripts. No server, no database
- Multi-provider by design, which matters given Claude Code, Codex, and Gemini all being in play

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Worktree wrapper + JSON session records + `rg` search. Small, and Python stdlib covers all of it |
| fills_gap | 0 | Session capture and search overlap [Agentsession](2026-07-24-agentsession.md), [Sessionvault](2026-07-22-sessionvault.md) and [Claude Session Nexus](2026-07-21-claude-session-nexus.md) already in the backlog |
| novel | 1 | The *worktree-as-primary-key* framing is new — prior plans indexed sessions by time or project, not by unit of work |
| daily_utility | 1 | Every branch switch, which is many times a day |
| **Total** | **3/4** | **VIABLE** |

Scored down on `fills_gap` honestly: this is the fourth session-management plan in the backlog. It survives because the organising principle is genuinely different — if any of the four gets built, build this one, and let it subsume the others rather than shipping alongside them.

## Stack Recommendation

```
Python 3.11+          — stdlib: subprocess, json, pathlib, argparse
git worktree          — the isolation primitive; no reimplementation needed
ripgrep               — full-text search across recorded transcripts
Claude Code hooks     — SessionStart hook auto-records the session id
fzf (optional)        — the conversation picker, if installed; numbered list otherwise
```

`.agent/` lives in the *main* repo, not the worktree — otherwise deleting the worktree deletes the record, which is the exact failure the tool exists to prevent. Add `.agent/` to `.git/info/exclude` rather than `.gitignore` so it stays a local concern.

## MVP Scope (1 Claude session)

1. `t new <task>` — `git worktree add ../<repo>-<task> -b <task>`, create `.agent/<task>.json` with `{task, branch, worktree, created, sessions: []}`
2. `t cd <task>` — print the worktree path (shell function does the `cd`, since a subprocess cannot)
3. `t rec <task> <provider> <session-id>` — append a session record
4. `t ls` — list tasks with branch, worktree existence, and session count
5. `t resume <task>` — pick a session, print/run the right resume command per provider
6. Verify: create a task, run two Claude sessions in it, delete the worktree, confirm both sessions still resume

## Phases

### Phase 1: Task Lifecycle (2h)
- `t new`, `t ls`, `t rm` over `git worktree add/list/remove`
- `.agent/<task>.json` in the main repo's git dir, excluded via `.git/info/exclude`
- `t cd` prints a path; ship a two-line shell function (`t() { case $1 in cd) cd "$(command t cd "$2")";; *) command t "$@";; esac }`) for the `cd` case
- Handle the dirty-worktree case on `rm`: refuse unless `--force`
- Verify: create three tasks, `git worktree list` matches `t ls`

### Phase 2: Session Recording (2-3h)
- `t rec` writes `{provider, session_id, started, cwd, first_prompt}` into the task record
- A `SessionStart` hook auto-calls `t rec` when a Claude Code session begins inside a known worktree — resolve worktree → task by matching `cwd` against the records
- Record Codex and Gemini manually via `t rec` until their hook stories firm up
- Verify: start a Claude session in a task worktree, confirm the record appears without any manual step

### Phase 3: Resume + Picker (2h)
- `t resume <task>` lists recorded sessions: provider, age, first prompt, turn count
- Selecting one execs the provider's resume command (`claude --resume <id>`, etc.)
- Use `fzf` if present, fall back to a numbered `input()` list — no dependency
- Handle the deleted-worktree case: offer to recreate the worktree from the branch, then resume
- Verify: delete a worktree, `t resume` recreates it and restores the conversation

### Phase 4: Cross-Task Search (2h)
- `t search "<query>"` — `rg` over every recorded transcript file across all tasks
- Output: task name, provider, date, matching line, session id
- `t search --task <name>` scopes to one task
- Resolve Claude transcript paths from the session id under `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl`
- Verify: search for a string you know appeared in one session two tasks ago, confirm a single correct hit

### Phase 5: Multi-Agent per Task (2-3h)
- Allow several providers on one task and show them as one merged timeline in `t show <task>`
- `t note <task> "<text>"` for human annotations interleaved into the timeline
- `t archive <task>` — remove the worktree, keep branch and records, mark archived and hide from `t ls`
- Verify: run Claude and Codex on the same task, confirm `t show` interleaves both correctly by timestamp

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Task Lifecycle | 2h |
| Session Recording | 2-3h |
| Resume + Picker | 2h |
| Cross-Task Search | 2h |
| Multi-Agent per Task | 2-3h |
| **Total** | **10-12h (~2 weekends)** |

Phases 1-3 are the usable core: **6-7h (one weekend)**.

## Blockers / Risks

- Transcript storage paths are internal implementation details for every provider. `~/.claude/projects/<encoded-cwd>/<session-id>.jsonl` has changed encoding before and will again — isolate path resolution in one function and degrade to "session recorded but transcript not found" instead of crashing
- Recording the session id at `SessionStart` means a session that dies before its first turn leaves an empty record. Prune records whose transcript file never materialised
- Worktrees and submodules interact badly; `git worktree add` in a superproject leaves submodules uninitialised. Detect `.gitmodules` and either run `submodule update --init` or warn
- Resuming a Claude session whose original `cwd` no longer exists fails opaquely. Phase 3's recreate-then-resume path must run *before* the resume command, not as error recovery after it
- Overlaps three existing backlog plans. Decide up front that this replaces them — building this and Agentsession/Sessionvault separately means maintaining two indexes over the same transcripts, which is worse than either alone
- `rg` over every transcript gets slow past a few hundred sessions. Fine at personal scale; if it stops being fine, add a SQLite FTS index rather than trying to make the grep clever

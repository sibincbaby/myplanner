# git-for-agents — Git-like Version Control for AI Agent Actions

**Source:** [Show HN: Git for AI Agents](https://news.ycombinator.com/item?id=48063548)  
**Language:** Go (likely) · **Platform:** CLI / Claude Code hook  
**Date discovered:** 2026-08-05

## What it is

A lightweight harness layer that wraps any AI agent session and snapshots state before each tool call — capturing which files changed, what command ran, and what the agent's stated reasoning was. The result is a timeline you can inspect, bisect, and rewind, analogous to `git log` / `git bisect` / `git revert` for code — but for agent actions.

Problem it solves: when a Claude Code session makes 30 tool calls in a long task, debugging "why did it delete that file?" currently means scrolling through transcripts. Git-for-agents makes this a `git log`-style query.

## Why it fits

- Core interest: **Claude/LLM tooling** — integrates directly with Claude Code's hook system
- Core interest: **dev productivity** — critical for long-running agent sessions and debugging regressions
- `weekend_buildable = 1`: the core is file snapshots + SQLite inserts + a CLI read path; that's 1-2 focused sessions
- Novel approach: treating agent actions as a commit history is a genuinely new mental model

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | File snapshot + SQLite store + CLI is ~500 lines of Go; doable in a weekend |
| fills_gap | 1 | No good tool today for auditing/rewinding agent action history in Claude Code |
| novel | 1 | Version control framing applied to agent actions — not a thing yet in the Claude Code ecosystem |
| daily_utility | 1 | Anyone running Claude Code on real codebases hits this debugging need daily |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Go 1.22+                — single static binary, easy distribution
SQLite (modernc/sqlite) — local action log, no external DB
go-diff                 — compute file diffs between snapshots
Cobra                   — CLI interface (log, show, bisect, revert)
Claude Code hooks       — PreToolUse / PostToolUse triggers
```

Integrates with Claude Code's hook system: `PreToolUse` snapshots state before a tool call; `PostToolUse` records the outcome and diff.

## MVP Scope (1 Claude session)

1. Write a `PreToolUse` hook that copies all tracked files to `~/.agent-history/<session-id>/<seq>/`
2. Record to SQLite: timestamp, tool name, tool args (JSON), file snapshot path
3. Write a CLI: `agent-log` lists all actions; `agent-show <id>` diffs before/after
4. Wire the hook into a Claude Code session and run a simple file-editing task
5. Verify `agent-log` shows the history and `agent-show` displays the correct diff

## Phases

### Phase 1: Hook + Snapshot (2-3h)
- Write the Claude Code hook script in Go or Bash
- On `PreToolUse`: copy modified files to a timestamped snapshot directory
- On `PostToolUse`: compute the diff between pre and post snapshots
- Store in SQLite: `(id, session_id, seq, timestamp, tool, args_json, pre_snapshot_path, post_snapshot_path, diff_text)`
- Test with a simple `Write` tool call: confirm snapshot captured

### Phase 2: CLI Log + Show (2h)
- `agent-log [--session <id>]` — list all actions: seq, timestamp, tool name, first line of args
- `agent-show <seq>` — show full diff for one action (coloured, like `git diff`)
- `agent-show <seq> --args` — show the tool arguments (what Claude intended)
- Format inspired by `git log --oneline` and `git show`

### Phase 3: Bisect (2-3h)
- `agent-bisect <file> <expected-content-regex>` — binary search through action history to find which action introduced or removed a pattern
- Useful for: "when did this function get deleted?", "which action broke the import?"
- Implement as a simple loop over the snapshot history, not a full binary tree (good enough for 50-100 action sessions)

### Phase 4: Revert (2-3h)
- `agent-revert <seq>` — restore all files to their state before action `<seq>`
- Show a summary of what will change, ask for confirmation
- Apply the restore by copying from the pre-snapshot directory
- Safety: only revert if the working tree is clean (like `git stash` requirement)
- Also implement `agent-revert-range <from> <to>` for multi-action rollback

### Phase 5: Web Timeline UI (2-3h)
- Embed a minimal HTTP server: `agent-ui --port 3000` opens a browser timeline
- Show a vertical list of actions, each expandable to show the diff
- Click "revert to here" to invoke the revert logic from the UI
- Optional: show Claude's stated reasoning from the tool call args as a tooltip

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Hook + Snapshot | 2-3h |
| CLI Log + Show | 2h |
| Bisect | 2-3h |
| Revert | 2-3h |
| Web Timeline UI | 2-3h |
| **Total** | **10-14h (~2 weekends)** |

Phase 1-2 (working log + show): **4-5h (1 weekend session)**.

## Blockers / Risks

- Claude Code's hook API is not yet stable — the `PreToolUse`/`PostToolUse` hook contract may change; test after each Claude Code release and pin the CLI version in your `CLAUDE.md`
- Large sessions with many file writes will consume significant disk space for snapshots — implement a configurable retention policy (keep last N snapshots, or by age)
- Binary files (images, databases) can't be diffed meaningfully — skip snapshotting them or store only their hash for change detection
- Revert can produce conflicts if the agent has made interdependent changes across multiple files — detect this and warn rather than partially reverting
- Multi-agent / subagent sessions create parallel action streams — need a session tree model, not a linear list, for full accuracy in agentic workflows

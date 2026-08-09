# agentblame — Human-vs-Agent Line Provenance from Session Transcripts

**Source:** [eighttrigrams/us-vs-them](https://github.com/eighttrigrams/us-vs-them) · HN Aug 9 2026, 28 pts, 23★
**Language:** Python 3 (stdlib only) — git is a subprocess, transcripts are JSONL
**License:** upstream unlisted · plan is a personal build
**Date discovered:** 2026-08-10

## What it is

us-vs-them answers one question about a version-controlled file: who wrote this line, us or them? It works from git history with no special markup, and emits line ranges scored `1.0` (human) to `0.0` (agent), with intermediate values for mixed hunks. You tell it which side is which via `--ours` / `--theirs`.

**Why it matters here:** that last part is the weak joint, and locally it is a broken one. This repo's `CLAUDE.md` explicitly forbids the `Co-Authored-By: Claude` trailer — so the standard provenance marker does not exist in a single commit on this machine. There is nothing to pass to `--theirs`.

But the evidence exists elsewhere and is better. Claude Code writes a JSONL transcript per session under `~/.claude/projects/<slug>/`, and every `Edit`, `Write` and `NotebookEdit` tool call in it carries a file path and a timestamp. Joining those events against `git blame` author dates yields per-line attribution backed by a record of the edit actually happening — not a heuristic, and not a trailer someone has to remember to add.

## Why it fits

- Core interest: **Claude/LLM tooling** — reads the Claude Code transcript format directly, the same surface the `csess` skill already uses
- Core interest: **dev productivity** — turns review into a sorted list instead of a uniform diff
- `novel = 1`: brain0 (07-05) tracks agent prompts and drift, but needs a decision graph wired up in advance; this is retroactive and works on history that already exists
- `fills_gap = 1`: nothing in the backlog attributes authorship, and the one signal everyone else relies on is banned by local convention
- `daily_utility = 1`: agent-authored diffs land here every day, including this pipeline's own commits

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | `git blame --porcelain` plus JSONL parsing; both are stdlib-only work |
| fills_gap | 1 | The trailer signal is unavailable by local rule; transcripts are the only ground truth on this machine |
| novel | 1 | Backlog tracks prompts and drift, never line authorship |
| daily_utility | 1 | Every agent-written diff is a candidate for the review lens |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Runtime:    Python 3.11+, single file, stdlib only (no venv, no install step)
Git:        subprocess — `git blame --porcelain`, `git log --format=%H%x09%at%x09%an`
Transcripts: ~/.claude/projects/<cwd-slug>/*.jsonl, read line by line
Index:      sqlite3 (stdlib) — one table of edit events, rebuilt incrementally
Output:     annotated text by default, --json for scripting, --diff for review mode
```

No embeddings, no model calls. The whole tool is a join between two local sources of truth; adding an LLM would make it slower, non-deterministic and wrong in ways that are hard to see.

## MVP Scope (1 Claude session)

1. `agentblame <file>` — print the file with each line marked `human` / `agent` / `unknown` and a confidence
2. `agentblame --diff` — attribute the working tree or staged diff, agent-authored hunks first
3. `agentblame --summary` — percentage agent-authored per file, per directory, for the repo
4. `agentblame index` — build/refresh the SQLite event index from all local transcripts
5. `--json` on everything, so it can drive a pre-commit hook later

## Phases

### Phase 1: Session Harvest (2h)
- Walk `~/.claude/projects/*/*.jsonl`; for each line, pull tool-use events of type `Edit`, `Write`, `MultiEdit`, `NotebookEdit`
- Record `(absolute_path, timestamp, session_id, tool)` into SQLite; resolve the project slug back to a real working directory so paths are comparable
- Make indexing incremental — key on file mtime plus byte offset, since transcripts are append-only and re-reading everything gets slow within weeks
- Verify: the event count for a session matches the `Edit`/`Write` calls visible in that session via `csess`

### Phase 2: Git Join (2h)
- `git blame --porcelain` per file for line → commit, and **author** date, not committer date. A rebase rewrites committer dates and leaves author dates alone; using the wrong one silently reattributes whole branches after any rebase
- For each commit, ask whether a session edit to that same path exists in a window around the author time
- Tune the window empirically on known commits and make it a flag — this is the calibration knob and the number that decides everything
- Verify: on ten commits with known provenance, attribution matches by hand

### Phase 3: Attribution Scoring (2h)
- Score `1.0` human, `0.0` agent, in between for hunks a commit touched both ways, matching upstream's output contract
- **`unknown` is a third tier, never a synonym for human.** Sessions run on another machine, cloud agents and expired transcripts all leave no local record. A tool that defaults unknown to human reports the agent code as reviewed when nobody reviewed it — that inversion is the one bug that makes the whole thing harmful
- Degrade honestly on squashed and amended commits: collapsed timestamps mean lower confidence, and it should say so rather than pick
- Verify: delete one session transcript, confirm those lines become `unknown` and not `human`

### Phase 4: Review Lens (2h)
- `--diff` reads `git diff` / `git diff --cached`, attributes each hunk, and sorts agent-authored first so review time lands where no human has looked
- Add a one-line summary suitable for a pre-commit hook: `14 hunks, 11 agent-authored, 2 unknown`
- Keep the hook advisory — a provenance tool that blocks commits will be disabled within a week
- Verify: stage a hand-written change and an agent-written change together, confirm the ordering

### Phase 5: Repo Report (1h)
- `--summary` rolls up percentage agent-authored by file and directory
- Trend over time from commit dates: is the agent-authored share rising, and where
- Verify: run against this repo, where `docs/daily/` should come out near-entirely agent-authored and `run-discovery.sh` should not

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Session Harvest | 2h |
| Git Join | 2h |
| Attribution Scoring | 2h |
| Review Lens | 2h |
| Repo Report | 1h |
| **Total** | **9h (~1 weekend)** |

Phases 1-3 alone give working per-file attribution in **6h**; the review lens is what makes it a daily habit.

## Blockers / Risks

- **The timestamp join is a correlation, not a proof.** A commit whose author time falls inside a session window may still contain hand-typed lines. Ship confidence values, never a bare boolean, and resist the urge to round them away in the output
- **`unknown` must render distinctly from `human`.** Stated twice on purpose — every other risk here produces a wrong number, this one produces false assurance about unreviewed code
- Transcripts rotate and get cleaned up. Attribution quality decays going back in time; print the oldest indexed session date in the report header so the horizon is visible
- Squash-merge workflows collapse many sessions into one commit and flatten timestamps. This tool is much weaker on a squashed history — worth checking before investing the full nine hours
- Path resolution between the Claude Code project slug and the real working directory is fiddly, and worktrees make it worse: the same repo appears under several slugs. Handle worktrees in Phase 1 or the join quietly misses events
- The `Co-Authored-By` ban is a deliberate local rule, not an oversight — do not "fix" it by adding trailers. The whole design premise is that provenance has to work without them
- Upstream is 23★ with no visible license. Treat it as a reference for the scoring model and output contract, and write the transcript join fresh

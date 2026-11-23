# agentlogs — agent session transcript logger with git-commit linking

**Source:** [agentlogs/agentlogs](https://github.com/agentlogs/agentlogs) on GitHub — "Collaboration in the age of agentic engineering"; records and shares AI coding-agent session transcripts and links them to git commits; Apache-2.0; gained aggregator traction Nov 2026
**Discovered:** 2026-11-23
**Viability:** 4/4

> agentlogs answers "which Claude session led to this commit?" and "what did the agent actually do during this sprint?". The build here is a local-first implementation: a Claude Code stop hook that saves each session transcript to a SQLite database keyed by git commit hash. `agentlogs show <hash>` pulls up the conversation that produced those changes. No server, no sharing unless you want it.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

- **weekend_buildable=1:** a Claude Code `stop` hook that appends session JSON to a SQLite file and records `git log --oneline -1` is under 60 lines. The CLI to query it is another 60. Phase 1 is a single afternoon.
- **fills_gap=1:** git blame shows *what* changed and *when*, but not *why* or *how the AI session unfolded*. No tool in this log's scope links Claude Code transcripts to commit hashes, so a future "why did we make this change?" query has no answer today.
- **novel=1:** session-to-commit linking is not found in any prior-art search in this log. agent-journal (seen 2026-11-22) stores agent diary entries but doesn't index by commit.
- **daily_utility=1:** every `git commit` after a Claude Code session automatically tags the transcript; zero extra steps.

---

## Implementation Plan

### Overview

```
agentlogs show <commit-hash>    # print the Claude session that produced this commit
agentlogs last                  # show the most recent session
agentlogs search <term>         # grep sessions for a term
agentlogs stats                 # sessions per day, avg length, most active files
agentlogs export <hash>         # dump session as Markdown
```

### Storage Schema

A single SQLite database at `~/.agentlogs/db.sqlite`:

```sql
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,       -- UUID
  started_at  INTEGER NOT NULL,       -- unix epoch
  ended_at    INTEGER,
  project     TEXT,                   -- git remote URL or cwd basename
  branch      TEXT,
  commit_hash TEXT,                   -- HEAD at session end
  commit_msg  TEXT,
  transcript  TEXT NOT NULL,          -- raw JSON from Claude Code hook payload
  summary     TEXT,                   -- Haiku-generated 1-line summary
  files_touched TEXT                  -- JSON array of changed files
);
CREATE INDEX idx_sessions_commit ON sessions(commit_hash);
CREATE INDEX idx_sessions_project ON sessions(project, started_at);
```

### Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22 + TypeScript |
| Database | SQLite via `better-sqlite3` |
| Summary LLM | Claude claude-haiku-5-5 (optional, skipped if `--no-summary`) |
| CLI | `commander` |
| Output formatting | `chalk` + `cli-table3` |

### MVP Scope (Phase 1, ~2h)

- Claude Code `Stop` hook: reads stdin payload, runs `git log --oneline -1` to get commit hash + message, writes record to SQLite
- `agentlogs last`: prints transcript of the last session in a readable format
- `agentlogs show <hash>`: looks up and prints transcript for a commit hash

**Done when:** running a Claude Code session, committing, then running `agentlogs show HEAD` and reading back the conversation that produced those changes.

### Phases

#### Phase 0: Setup (30 min)
1. `npm init` + TypeScript + `better-sqlite3`, `commander`, `chalk`
2. `src/db.ts`: open/create `~/.agentlogs/db.sqlite`, run CREATE TABLE IF NOT EXISTS
3. Test: insert a mock record, query it back

#### Phase 1: Hook + basic CLI (2h)
1. `src/hook.ts`: Claude Code stop hook; reads stdin payload, extracts transcript, calls `git log --oneline -1`, writes row
2. Add hook to `.claude/settings.json`: `"Stop": [{ "type": "command", "command": "agentlogs-hook" }]`
3. `src/cli.ts`: `agentlogs last`, `agentlogs show <hash>`
4. Test end-to-end: run a Claude Code session → commit → `agentlogs show HEAD`

#### Phase 2: Search + summary (2h)
1. `agentlogs search <term>`: full-text search across transcripts (SQLite FTS5) + filenames
2. Optional Haiku summary: after session end, generate 1-line summary and store in `summary` column
3. `agentlogs last --summary`: shows just the summary line; faster for a quick review

#### Phase 3: Stats + per-project view (1.5h)
1. `agentlogs stats`: sessions per day chart (ASCII sparkline), avg session length, most-touched files, busiest hours
2. `agentlogs project <name>`: filter to a specific project
3. `agentlogs timeline`: chronological list of commit + session summary pairs for the current repo

#### Phase 4: Export + sharing (1h)
1. `agentlogs export <hash>`: dump as pretty Markdown to stdout or a file
2. `agentlogs export --all --since=2026-11-01`: export a date range (for sprint retrospectives)
3. Optional: `agentlogs serve` → local web UI at `localhost:5556` for browsing

### Effort Estimate

~1 Claude session to Phase 2 (working hook + search + summary). Phase 3+4 add another 0.5 sessions.

### Blockers / Risks

| Risk | Mitigation |
|------|-----------|
| Claude Code stop hook payload format | Capture with `--debug` flag first; transcript path may be a file path rather than inline JSON |
| Transcript size (large sessions) | Store compressed (gzip) in SQLite BLOB if >100KB; decompress on read |
| Commits made without an active session | `commit_hash` nullable; `agentlogs show <hash>` says "no session recorded for this commit" |
| Multiple sessions per commit | Support one-to-many: each session row has a `commit_hash`; `show` lists all sessions for that hash |
| `better-sqlite3` native module | Pre-build for Node 22; document that `npm rebuild` may be needed after Node upgrades |

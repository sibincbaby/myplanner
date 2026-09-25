# Breadcrumbs — Repo-Local Decision Memory for Coding Agents

**Source:** <https://github.com/jr-mccoy/breadcrumbs>
**Discovered:** 2026-09-25
**Viability:** 4/4

> The agent remembered what you decided last Tuesday. It didn't remember why. Breadcrumbs captures the reasoning — "we picked SQLite over Postgres because we're targeting offline-first" — directly into the repository, in plain Markdown, so any agent on any future session reads it before touching the affected code.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

**Weekend-buildable (1):** The core is a Claude Code skill (one `.md` file) and a `UserPromptSubmit` hook (one Python script). No dependencies, no external service. The entire MVP is under 100 lines.

**Fills a gap (1):** Global memory tools (mem0, hindsight, memorix, turnmem) store context per-user or per-model. When you switch from Claude Code to Codex, the memory does not follow. When a teammate clones the repo, they have no memory. Breadcrumbs stores the context in the repo itself, so it survives tool switches and is visible to every contributor and reviewer.

**Novel (1):** Prior memory plans (memorix Aug 26, turnmem Jul 31, deja-vu Aug 2, atlaso-memory Aug 8, thedotmack-claude-mem Sep 20) all use external stores. Breadcrumbs is the only pattern in this list that is file-system-local, git-committed, and agent-agnostic by construction. The specific focus on *decisions* (why, not what) rather than conversational history is also new.

**Daily utility (1):** Every coding session in a non-trivial project benefits from knowing what was decided and why. The injection hook runs automatically on session start.

---

## Implementation Plan

## Overview

Two pieces and nothing else:

1. **A session-end skill** (`/breadcrumb`): after a working session, Claude reads the session context and writes a short decision log to `.breadcrumbs/YYYY-MM-DD-<topic>.md`. The log captures: what was decided, why, what was tried and discarded, and which files are affected.
2. **A session-start hook** (`UserPromptSubmit`): before the first prompt of a new session, the hook scans `.breadcrumbs/` for entries whose `files` frontmatter overlaps with the files recently touched in the repo (`git diff --name-only HEAD~5`), and injects the last 3 relevant entries as `additionalContext`.

That is the complete MVP. The rest of the plan extends this with better relevance filtering and cross-agent support.

## Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Decision capture | Claude Code skill (`.md` instruction file) | one file, no code; Claude writes the Markdown |
| Hook | Python 3 stdlib only | runs on every prompt; startup time matters |
| Storage | `.breadcrumbs/*.md` in the repo root | plain files, git-committed, readable by any editor |
| Relevance filter | `git diff --name-only` + frontmatter `files:` field | no vector DB; fast; good enough for v1 |
| Injection | `UserPromptSubmit` → `hookSpecificOutput.additionalContext` | the only correct path for per-prompt context injection |

## MVP Scope

**In:**

1. `/breadcrumb` skill: a `.claude/commands/breadcrumb.md` file that instructs Claude to write a decision log for this session. The log includes: `decision` (one line), `reason` (one paragraph), `discarded` (what was tried and dropped), `files` (list of affected paths), `date`.
2. Session-start hook: reads `.breadcrumbs/` if the directory exists. For each file, parses the YAML frontmatter's `files:` list. Compares with `git diff --name-only HEAD~5`. Injects the most recent 3 matching entries as `additionalContext`. If no `.breadcrumbs/` directory, exits 0 silently.
3. A `.breadcrumbs/README.md` that explains the format to human readers and to agents that do not have the hook installed.

**Out of v1:** semantic relevance ranking, multi-agent read via MCP, automatic capture on session end (without explicit `/breadcrumb` invocation), breadcrumb search command.

## Phases

**Phase 1 — Skill only, no hook (≈1 hour).**
Write the `/breadcrumb` skill instruction file. Create the `.breadcrumbs/` directory and the README. Run one real session, invoke `/breadcrumb` at the end, and confirm Claude writes a well-structured log. Tune the instruction until the output is consistently useful (decision + reason + discarded + files in frontmatter).

**Phase 2 — Session-start injection hook (≈1 hour).**
Write the Python hook. Parse YAML frontmatter from each `.breadcrumbs/` file (PyYAML or a two-line regex; stdlib only is fine here). Match against `git diff --name-only HEAD~5`. Inject the top 3 matches as `additionalContext`. Test on a repo with 5 existing breadcrumbs and confirm the right entries surface.

**Phase 3 — Structured frontmatter + cap (≈30 minutes).**
Finalize the frontmatter schema. Add a character cap on injected content (500 chars per entry, 3 entries max = 1500 chars). Make the hook fail open: any parse error exits 0, never 1 or 2.

**Phase 4 — Recency + relevance ranking (≈2 hours, optional).**
Replace the `git diff` file-match with a simple scoring function: entries that mention files in the current working directory score higher, recent entries score higher, entries whose `files:` list overlaps with the current edit set score highest. This avoids injecting an old SQLite decision when you are working on the auth module.

**Phase 5 — Cross-agent MCP tool (≈2 hours, optional).**
A minimal MCP server with one tool: `read_breadcrumbs(repo_path, current_files)` → returns the top 5 relevant entries as text. This makes breadcrumbs readable by Codex, Cursor, and any other MCP-capable agent without needing to install the hook. Serves the directory listing over a local HTTP endpoint.

## Effort Estimate

**Under one hour for a working MVP** (Phases 1–3). Phases 4 and 5 are refinements addable over a week of use. The project is small enough that if Phase 1 fails (the skill instruction produces poor output), you can tune it in place in 15 minutes rather than starting over.

## Blockers and Risks

- **Claude's output quality varies.** The skill relies on Claude writing a well-structured decision log. If the instruction is too loose, you get paragraphs instead of frontmatter. Mitigation: include an exact template in the skill instruction — YAML frontmatter block with specific keys — and validate the output in Phase 1 before building the hook.
- **The `files:` field requires discipline.** The injection only works if Claude correctly identifies which files a decision affects. Mitigation: ask Claude to run `git diff --name-only HEAD` before writing the log, so the affected files list is grounded in reality.
- **Hook startup time.** The hook runs on every prompt. YAML parsing + `git diff` is fast (< 50ms), but a `.breadcrumbs/` directory with hundreds of files will slow it down. Mitigation: index the directory on first run, cache the index in a temp file keyed by `mtime` of `.breadcrumbs/`.
- **Context crowding.** If 3 entries × 500 chars each = 1500 chars are injected on every prompt, that adds ~375 tokens of fixed overhead to every turn. For long sessions this is acceptable; for short sessions it is noise. Mitigation: only inject if the hook detects a non-trivial working context (e.g., at least one file is open or was recently edited). A bare `/help` prompt should not get breadcrumbs.
- **The lane already has eight plans.** Build this only if the *repo-local* and *agent-agnostic* properties matter for your workflow. If you only ever use Claude Code and global memory is fine, upstream `thedotmack-claude-mem` or `memorix` cover the need without the git-commit discipline.

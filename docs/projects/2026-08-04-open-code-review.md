# open-code-review — Deterministic LLM Code Review CLI

**Source:** [github.com/alibaba/open-code-review](https://github.com/alibaba/open-code-review)  
**Stars:** 18,454 (+3,881 this week) · **Language:** Go + TypeScript · **License:** Apache 2.0  
**Date discovered:** 2026-08-04

## What it is

An AI-powered CLI for automated code review that originated as Alibaba's internal tool, used across tens of thousands of developers before open sourcing. It reads a `git diff`, sends the changed files to an LLM (Claude or OpenAI), and returns line-precise review comments with structured severity ratings.

The key architectural choice: **hybrid deterministic + agentic**. Deterministic Go code handles file selection, bundling, and output parsing. The LLM only does the "thinking" part — spotting bugs, anti-patterns, security issues. This gives it "~1/9 the tokens" and higher precision than using a general-purpose agent for the whole workflow.

Integrations: CLI, GitHub Actions, VS Code extension, Claude Code skill, Cursor, Codex.

## Why it fits

- Core interest: **dev productivity** — automated review on every commit or PR
- Core interest: **Claude/LLM tooling** — uses Claude Sonnet 5 as the reviewer via Anthropic API
- Weekend-buildable: a simplified version (git diff → Claude → structured comments) is 1 Claude session
- Daily utility: catches bugs before PR, reduces review cycles with teammates
- Novel: the deterministic-first hybrid that avoids "position drift" common in pure agent approaches

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Core concept (diff → LLM → comments) is a weekend build; the full tool is weeks |
| fills_gap | 1 | No local Claude Code skill does automatic git-diff review with line-level precision |
| novel | 1 | Deterministic file bundling + focused LLM avoids known failure modes of general agents |
| daily_utility | 1 | Runs on every commit; surfaces bugs Claude Code didn't catch during authoring |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Claude API (claude-sonnet-5) — primary reviewer
Go or Python — diff parsing and file bundling (Go preferred for speed)
git diff (subprocess) — changed file extraction
JSON schema — structured output (file, line, severity, message)
GitHub Actions — CI integration
```

For MVP, Python wrapping the Anthropic SDK is faster than Go.

## MVP Scope (1 Claude session)

A minimal `review.py` that:
1. Runs `git diff HEAD~1` (or a specified commit range)
2. Filters to changed `.py`, `.ts`, `.dart` files (configurable extensions)
3. Bundles changed files with line numbers into a single prompt
4. Calls Claude Sonnet 5 with a structured review prompt requesting JSON output
5. Prints review comments as a human-readable list with file:line references

No CI integration for MVP — just a script you run locally before pushing.

## Phases

### Phase 1: Diff Parser + File Bundler (2-3h)
- Parse `git diff` output to extract: changed files, +/- lines, context
- Bundle into a prompt-safe format (strip binary files, limit total tokens to 50k)
- Implement file extension filter and ignore list (`.gitignore` aware)
- Test: verify correct line numbers survive the bundling

### Phase 2: Claude Integration (2h)
- Write system prompt: code reviewer role, output format (JSON array of comments)
- Each comment: `{file, line, severity: error|warning|info, message, suggestion}`
- Call `claude-sonnet-5` with `max_tokens=4000`, `temperature=0`
- Parse JSON response, handle malformed output gracefully

### Phase 3: Output Formatting (1-2h)
- Print comments grouped by file, sorted by line number
- Colorize by severity (error=red, warning=yellow, info=blue) via ANSI codes
- Add `--json` flag for machine-readable output (CI integration)
- Add `--fail-on error` flag to exit non-zero if any errors found

### Phase 4: Git Hook Integration (1-2h)
- Write `install-hook.sh` that copies `review.py` to `.git/hooks/pre-push`
- Hook runs review, exits non-zero if errors found, blocks the push
- Add `--skip-review` env var override for emergency pushes
- Document in CLAUDE.md: "Run /review before any PR"

### Phase 5: GitHub Actions + Claude Code Skill (2-3h)
- Write `.github/workflows/code-review.yml` — runs on PR open/sync
- Post review comments to PR via GitHub API (uses `mcp__github__add_comment_to_pending_review`)
- Write `SKILL.md` so Claude Code can trigger review in-session: `/review`
- Add summary comment to PR: "X errors, Y warnings found by AI review"

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Diff Parser | 2-3h |
| Claude Integration | 2h |
| Output Formatting | 1-2h |
| Git Hook | 1-2h |
| GitHub Actions + Skill | 2-3h |
| **Total** | **8-12h (~1-2 weekends)** |

Phase 1-3 alone (working local CLI): **5-7h (1 weekend session)**.

## Blockers / Risks

- Large diffs (10k+ lines) hit Claude's context limits — add automatic chunking by file or commit range
- LLM review generates false positives — start with `--severity warning` threshold; only fail on errors
- Line number drift: Claude sometimes references line numbers off by a few lines — test carefully and add tolerance in parsing
- The Alibaba open-source version may have enterprise assumptions in its config — build from scratch rather than forking to avoid hidden dependencies
- GitHub API rate limits: if many PRs open simultaneously in CI, the review workflow queues — add a concurrency limit in the workflow

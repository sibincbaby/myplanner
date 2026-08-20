# contextkit — CLI That Generates Structured Agent Context Files From Any Repo

**Source:** [Cynrath/agent-context-kit](https://github.com/Cynrath/agent-context-kit) · GitHub (new project, August 2026) · Python, MIT, offline-first
**Date discovered:** 2026-08-20

## What it is

agent-context-kit is an offline-first CLI that analyzes a git repository and emits structured context files ready for AI coding agents: a canonical `AGENTS.md` (project overview, directory map, key conventions), per-role instruction files (`planner.md`, `implementer.md`, `tester.md`), and a repo hygiene report (TODO count, dead imports, test coverage estimate). The goal is to reduce the repetitive "here is what this project does" front-matter that every coding agent session starts with, and to give agents working on the same repo consistent, versioned context rather than ad-hoc prompts.

The key design choice: offline-first. The analysis runs entirely on local file content — grep, git log, package manifest parsing — and the structured output is deterministic given the same inputs. A Claude API call for summarization is optional and behind a `--with-ai` flag. The base tool never phones home.

## Why it fits

- Core interest: **Claude/LLM tooling** — the output is directly consumed by Claude Code (via `CLAUDE.md`) and any MCP-compatible agent
- Core interest: **dev productivity** — eliminates the context-setting ceremony that starts every new Claude Code session on a project
- `fills_gap = 1`: no prior plan covers structured context file generation. `selfspec` (07-28) covered self-describing agent specs; `schemactx` (08-12) covered DB schema context. This covers the general repo → agent-context pipeline.
- `novel = 1`: offline-first structured generation of multi-role agent instruction files, checked into git alongside the code, is not in any prior plan

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Repo analysis is grep + git log + file parse. Template rendering is jinja2. One session covers phases 1–3 |
| fills_gap | 1 | No prior plan covers the general repo → agent-context-file pipeline |
| novel | 1 | Multi-role instruction files + offline-first + git-tracked is new in the backlog |
| daily_utility | 1 | Run once per project; run again when the project structure changes. Low frequency, high value |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Language:   Python 3.11+ with uv (single-file install)
Templates:  jinja2 — one template per output file (AGENTS.md, planner.md, etc.)
Analysis:   subprocess → git log, grep, wc; stdlib pathlib for file tree
Summarize:  Claude API (claude-haiku-4-5, optional, behind --with-ai)
Config:     .contextkit.toml at repo root — role list, ignore patterns, custom sections
Output:     .agent-context/ directory, gitignored by default or committed by choice
```

The analysis layer deliberately avoids tree-sitter, LSP, or any language-specific parser. It uses grep and file names. This limits the depth of what it can say about code structure, but keeps the tool dependency-free and works on any language without plugins.

## MVP Scope (1-2 Claude sessions)

One session:
1. `contextkit init` — scan the repo root, generate `AGENTS.md`
2. `contextkit roles` — generate per-role files using a default role list (planner, implementer, tester)
3. `contextkit hygiene` — emit a hygiene report (TODO count, `# noqa`/`# type: ignore` count, test-to-source ratio)
4. Verify on this repo (`myplanner`) and on one real project

## Phases

### Phase 1: Repo Analysis (2h)
- Project name, language(s), framework (detected from package.json, pyproject.toml, go.mod, Cargo.toml, pubspec.yaml, build.gradle)
- File tree: top 3 levels, skipping `.gitignore` entries and common noise dirs (`node_modules`, `.git`, `__pycache__`)
- Git summary: last 10 commit messages, top 5 authors, days since last commit
- Entry points: look for `main.*`, `index.*`, `app.*`, `server.*` in the root and `src/`
- Test coverage proxy: count `test_*.py`, `*.test.ts`, `*_spec.rb`, etc. vs. source files at the same level
- Verify: `contextkit analyse .` on 3 real repos produces correct language and framework detection

### Phase 2: AGENTS.md Generation (1h)
- Jinja2 template → `AGENTS.md` with sections: What this is, Directory map, Entry points, Dependencies, Conventions (detected: snake\_case vs camelCase, tabs vs spaces, test runner), Do not touch (`.env`, lock files, generated files), How to run tests
- "Conventions" section uses heuristics: scan 20 source files, vote on naming style and indentation
- Output is Markdown; the agent reads it as its first context block
- Verify: Claude Code session on a project with `AGENTS.md` in the root names the correct framework without being told in the prompt

### Phase 3: Per-Role Files (1h)
- Default roles: `planner` (read-only, architecture focus), `implementer` (write access, concrete tasks), `tester` (read + run shell, validation focus)
- Each role file adds: its scope, its allowed tools, its escalation rule ("if the task requires modifying the DB schema, hand off to planner")
- Custom roles via `.contextkit.toml`: `[[roles]] name = "migrator" scope = "database changes only"`
- Verify: give a Claude Code session the `planner.md` file as its system context; confirm it declines to write files

### Phase 4: Hygiene Report (1h)
- TODO/FIXME/HACK/FIXME count by file, top 10 files
- `# noqa`, `# type: ignore`, `@ts-nocheck` count — proxy for suppressed warnings
- Dead import detection: grep for imports that appear once (the import line itself, no usage) — fast, approximate, useful
- Test-to-source ratio: `(test file count) / (source file count)` per top-level module
- Output: `hygiene.md` in `.agent-context/`; also printed to stdout
- Verify: run on a project with known TODOs; the count matches a manual count

### Phase 5: AI-Enhanced Summary (1h, `--with-ai` only)
- Read Phase 1 analysis output, call `claude-haiku-4-5` with: "Given this project analysis, write a one-paragraph description of what this codebase does and who would use it. Do not invent anything not in the data."
- Inject the paragraph at the top of `AGENTS.md` under the project name
- Keep the non-AI output identical to Phase 2; the AI paragraph is additive
- Verify: `--with-ai` description for this repo is accurate; `--no-ai` (default) produces identical output on two runs

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Repo analysis | 2h |
| AGENTS.md generation | 1h |
| Per-role files | 1h |
| Hygiene report | 1h |
| AI-enhanced summary | 1h |
| **Total** | **6h (one day)** |

Phases 1–4 are fully offline. Phase 5 adds the API call and should come last.

## Blockers / Risks

- **Language detection is heuristic.** A monorepo with Go, Python, and TypeScript will have all three detected and the `AGENTS.md` will try to say something about all of them. The template needs a "primary language" field that the user can override in `.contextkit.toml` before Phase 2 ships.
- **Convention detection is noisy.** Twenty files is not enough to reliably detect naming style in a mixed codebase. Call the convention section "observations" not "rules" — the agent should treat them as hints, not mandates.
- **The output ages.** `AGENTS.md` generated today will be wrong in three months. The tool needs a `contextkit refresh` command that re-runs Phase 1–2 and diffs the output against the committed version. Build `refresh` in Phase 1; it is a git diff away.
- **CLAUDE.md already exists in many repos.** If the repo has a hand-written `CLAUDE.md`, `contextkit init` should detect it and offer to merge, not overwrite. A silent overwrite on `init` destroys weeks of curated context. Prompt before any write that would clobber an existing file.
- **The hygiene report is a proxy, not a measurement.** Dead import detection by "appears once" will flag re-exported symbols and side-effect imports. Document the false-positive rate explicitly in the output; do not present the counts as measurements.

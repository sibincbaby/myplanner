# addyosmani/agent-skills

**Source:** <https://github.com/addyosmani/agent-skills>
**Discovered:** 2026-09-20
**Viability:** 3/4

> Plug-and-play skills for Claude Code that immediately improve output quality on any dev project. The /ship and /test skills align directly with your dev productivity focus. At 97k stars and actively growing, it has become the de facto skill library for Claude Code users.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

The project is a collection of production-grade structured workflow skills for AI coding agents. Evaluating each criterion:

weekend_buildable (1): Creating a personalized set of agent skills — markdown workflow definitions, persona configs, slash command mappings — is squarely achievable in one or two Claude Code sessions. The artifact is flat files, no complex infrastructure required.

fills_gap (1): The user's profile shows heavy Claude Code and LLM tooling use but centers on building UIs and wrappers, not on systematizing their own coding agent workflows. A structured library of /spec, /plan, /build, /review, /ship commands with specialist personas (security auditor, test engineer) would add genuine scaffolding they appear to lack.

novel (0): addyosmani/agent-skills is itself the mature, well-maintained open-source version the user would build. It already covers 25 workflows, 70+ agents, and ships multiple specialist personas. Building a near-identical thing from scratch adds no value over forking and personalizing the existing repo.

daily_utility (1): Given the user writes code with Claude Code daily across Flutter, Nuxt, Node.js, and Python projects, structured workflow skills (/spec before implementation, /review before shipping) would be invoked in nearly every session.

Total 3. The right action is personalizing the existing repo (custom stack-specific workflows for Flutter/Nuxt/Node, personal finance AI domain tasks) rather than building from scratch, but that adaptation work is real and valuable.

---

## Implementation Plan

## Overview

Fork and personalize [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) into a private skill library tailored to the user's daily stack: Flutter, Nuxt 4, Node.js, Python, and personal-finance AI. Rather than rebuilding from scratch, the work is (1) cloning the upstream library into a personal repo, (2) auditing which of the 25 upstream skills are directly usable, (3) writing net-new stack-specific skills the upstream repo does not cover, and (4) wiring everything into the local Claude Code config so skills are available in every project.

---

## Stack Recommendation

- **Skill authoring format:** Markdown (`.md`) — same as upstream; zero new tooling needed
- **Storage:** A private GitHub repo (`myagent-skills`) that can be symlinked or submoduled into any project's `.claude/` directory
- **Integration:** Claude Code `CLAUDE.md` + `.claude/commands/` for slash-command registration; no server infrastructure required
- **Personas:** Plain markdown agent-persona files dropped into `.claude/personas/`

---

## MVP Scope

A working personal skill library with:
- All upstream skills audited and trimmed to the ~10 most relevant
- 5 net-new stack-specific skills: `/flutter-build`, `/nuxt-ship`, `/finance-spec`, `/llm-review`, `/redmine-log`
- 2 specialist personas: `finance-auditor` and `flutter-reviewer`
- A single install script that symlinks the library into any project in `~/my-works`

---

## Implementation Phases

### Phase 1: Fork, Audit, and Local Setup
**Goal:** A local clone of agent-skills with a personal overlay directory and a clear keep/drop decision for each upstream skill.

**Files to create/modify:**
- `~/my-works/myagent-skills/README.md` — personal library root and usage guide
- `~/my-works/myagent-skills/upstream/` — git subtree of addyosmani/agent-skills (read-only reference)
- `~/my-works/myagent-skills/skills/` — personal skill files (initially symlinks or copies of kept upstream skills)
- `~/my-works/myagent-skills/audit.md` — one-line keep/drop/adapt verdict for each of the 25 upstream skills

**Key steps:**
1. Create the repo: `mkdir -p ~/my-works/myagent-skills && cd ~/my-works/myagent-skills && git init`
2. Add upstream as a remote subtree: `git subtree add --prefix=upstream https://github.com/addyosmani/agent-skills.git main --squash`
3. List every upstream skill file: `ls upstream/skills/` and `ls upstream/commands/` to enumerate all 25 skills
4. For each upstream skill, write one line in `audit.md`: skill name, verdict (`keep` / `drop` / `adapt`), reason tied to the user's stack (e.g., `/webperf` → keep; `/android` → drop; `/spec` → adapt for Flutter widget specs)
5. Copy kept/adapted skills into `skills/` with filenames matching the slash-command name (e.g., `skills/spec.md`, `skills/plan.md`)

**Verify:** `ls skills/ | wc -l` returns 8–12; `cat audit.md | grep -c keep` matches that count.

---

### Phase 2: Net-New Stack Skills
**Goal:** Five new skills exist in `skills/` and are immediately invocable in a test project via `/flutter-build`, `/nuxt-ship`, `/finance-spec`, `/llm-review`, `/redmine-log`.

**Files to create/modify:**
- `skills/flutter-build.md` — pre-flight checklist + build commands for Flutter (Android/iOS/web); includes `flutter analyze`, `flutter test`, `flutter build apk --release`
- `skills/nuxt-ship.md` — Nuxt 4 ship workflow: type-check, `nuxt generate`, Vercel/Netlify deploy, cache-header audit
- `skills/finance-spec.md` — structured spec template for personal-finance AI features: data schema, privacy constraints, edge-case table, acceptance criteria
- `skills/llm-review.md` — code-review checklist specific to LLM/Claude integrations: prompt injection surface, token-budget checks, streaming error handling, API key hygiene
- `skills/redmine-log.md` — workflow to draft a Redmine time-entry comment from a session summary; outputs a formatted log block ready to paste

**Key steps:**
1. For `flutter-build.md`: open a representative Flutter project from `~/my-works`, extract its actual build commands and common lint failures, embed them as concrete steps in the skill template.
2. For `nuxt-ship.md`: pull the Nuxt 4 config pattern used in the user's existing Nuxt projects (`grep -r "nuxt.config" ~/my-works --include="*.ts" -l | head -5`) to make the ship steps match real project structure.
3. For `finance-spec.md`: use the personal-finance AI projects in `~/my-works` as reference for the data-schema fields (e.g., transaction categories, card identifiers) and embed them as a filled example.
4. For `llm-review.md`: start from the upstream `/review` skill and add an "LLM-specific" section covering the checklist items above; reference `@anthropic-ai/sdk` patterns the user already uses.
5. For `redmine-log.md`: define a structured prompt that takes `$SESSION_SUMMARY` as input and outputs a Redmine-formatted work log with time estimate, issue reference, and description.

**Verify:** In a scratch project: `mkdir /tmp/skill-test && cp -r ~/my-works/myagent-skills/.claude /tmp/skill-test/.claude` then open Claude Code in `/tmp/skill-test` and run `/flutter-build` — Claude should execute the checklist without errors about missing context.

---

### Phase 3: Specialist Personas
**Goal:** Two specialist agent personas (`finance-auditor`, `flutter-reviewer`) are loadable in any project and visibly change Claude's review behavior.

**Files to create/modify:**
- `personas/finance-auditor.md` — system-prompt persona: expert in personal-finance data privacy, PCI-DSS awareness, budget-calculation correctness, and Python/Node financial library pitfalls
- `personas/flutter-reviewer.md` — system-prompt persona: senior Flutter engineer focused on widget rebuild efficiency, `const` constructors, `BuildContext` misuse, and platform-channel error handling
- `skills/persona.md` — a `/persona` skill that lists available personas and explains how to activate one for a session

**Key steps:**
1. Write `finance-auditor.md` as a markdown file with a `## System Prompt` section; the prompt should instruct Claude to flag: hardcoded currency assumptions, missing null-checks on API amounts, unencrypted local storage of financial data, and missing `try/catch` around third-party finance API calls.
2. Write `flutter-reviewer.md` with a `## System Prompt` section covering: unnecessary `setState` calls that rebuild large subtrees, missing `const` on leaf widgets, `Navigator` called without `mounted` check, `FutureBuilder` without `connectionState` check.
3. Write `persona.md` as a skill that outputs a numbered menu of personas and instructions: "To activate, copy the system prompt from `personas/<name>.md` into your project's CLAUDE.md under `## Agent Persona`."
4. Test by adding `finance-auditor` system prompt to a scratch `CLAUDE.md` and asking Claude to review a sample expense-tracking file — verify it flags the checklist items.

**Verify:** `grep -c "System Prompt" personas/*.md` returns 2; running `/persona` in Claude Code lists both names with activation instructions.

---

### Phase 4: Install Script and Per-Project Integration
**Goal:** Running `install.sh <project-path>` wires the full skill library into any project under `~/my-works` in under 10 seconds.

**Files to create/modify:**
- `install.sh` — idempotent install script (see steps below)
- `template/CLAUDE.md` — minimal CLAUDE.md template that imports skill library and documents the available slash commands
- `template/.claude/commands/` — symlink stubs for each skill so Claude Code registers them as slash commands
- `uninstall.sh` — removes symlinks without touching project files

**Key steps:**
1. In `install.sh`: accept one argument (`$PROJECT_PATH`), default to current directory.
2. Create `$PROJECT_PATH/.claude/` if absent.
3. Create `$PROJECT_PATH/.claude/commands/` and symlink each `skills/*.md` file into it as `<skill-name>.md` — Claude Code discovers slash commands from this directory.
4. If `$PROJECT_PATH/CLAUDE.md` does not exist, copy `template/CLAUDE.md`; if it exists, append a `## Agent Skills` section that references the symlinked commands (idempotency check: skip if section already present via `grep -q "Agent Skills" CLAUDE.md`).
5. Print a confirmation listing all registered commands: `echo "Registered skills:" && ls $PROJECT_PATH/.claude/commands/`.
6. Make the script executable: `chmod +x install.sh uninstall.sh`.
7. Test on a real project: `./install.sh ~/my-works/openclaw` and verify Claude Code in that project shows the new slash commands in its command palette.

**Verify:** `./install.sh ~/my-works/openclaw && ls ~/my-works/openclaw/.claude/commands/ | grep flutter-build` outputs `flutter-build.md`.

---

### Phase 5: Upstream Sync and CI Hygiene
**Goal:** A `sync.sh` script keeps the upstream subtree current and a GitHub Actions workflow lints skill markdown for broken links and empty required sections.

**Files to create/modify:**
- `sync.sh` — pulls latest upstream changes into `upstream/` subtree and prints a diff summary of changed skill files
- `.github/workflows/lint.yml` — runs `markdownlint` and a custom Python script that checks each `skills/*.md` for required sections
- `scripts/check-skills.py` — validates that every skill file contains `## Purpose`, `## When to Use`, and `## Steps` headings
- `.markdownlint.json` — markdownlint config (allow long lines in code blocks, require ATX headings)

**Key steps:**
1. Write `sync.sh`: `git subtree pull --prefix=upstream https://github.com/addyosmani/agent-skills.git main --squash` then `git diff HEAD~1 upstream/ --stat` to surface which upstream skills changed.
2. Write `scripts/check-skills.py`: iterate over `skills/*.md`, parse headings with a regex (`^#{1,3} `), assert required headings are present, exit non-zero with a list of failing files if any are missing.
3. Write `.github/workflows/lint.yml`: trigger on push/PR to `main`; steps: checkout, install `markdownlint-cli` via npm, run `markdownlint skills/*.md personas/*.md`, then `python3 scripts/check-skills.py`.
4. Add `required_headings` to each existing skill file that is missing them (the check script output drives this).
5. Push to GitHub and confirm the workflow passes green.

**Verify:** `python3 scripts/check-skills.py` exits 0; a test PR that removes a required heading from one skill file causes the workflow to fail with the filename printed.

---

## Estimated Effort

**2 Claude Code sessions** (4–6 hours total)

- **Session 1 (Phases 1–2):** Fork, audit upstream, produce the five net-new stack skills. All file creation, no external API calls. Ends with a working `skills/` directory.
- **Session 2 (Phases 3–5):** Write personas, install script, sync tooling, and CI lint workflow. Ends with the library installable in any project and self-maintaining via GitHub Actions.

---

## Potential Blockers

- **`git subtree` on a large repo:** addyosmani/agent-skills has grown to 97k-star popularity; the initial `subtree add` may pull a large history. Mitigation: use `--squash` (already specified in Phase 1 steps) to collapse history to one commit.
- **Claude Code slash-command discovery path:** The exact directory Claude Code scans for custom commands (`.claude/commands/` vs `.claude/skills/`) must be confirmed against the installed Claude Code version before Phase 4. Run `claude --version` and check the release notes for that version's custom-command directory name; adjust `install.sh` accordingly.
- **Symlink behavior on macOS vs Linux:** The user's projects span Linux (confirmed by environment) but may be edited on macOS as well. `install.sh` uses `ln -s` which behaves identically, but absolute symlink paths will break if the `~/my-works/myagent-skills` root moves. Use relative symlinks (`ln -sr` on Linux) or switch to a copy-based install with an `--update` flag.
- **Redmine API shape:** `/redmine-log` as written outputs a paste-ready block rather than calling the Redmine API directly. If the user later wants automated time logging, the Redmine REST endpoint and API key will need to be added; that is a Phase 6 extension, not in scope here.
- **`finance-spec.md` domain specificity:** The personal-finance schema fields embedded in Phase 2 are inferred from existing projects; if the user's actual data models differ significantly, the skill template will need a second-pass edit after first use on a real finance project.

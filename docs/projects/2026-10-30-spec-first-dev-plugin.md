# Spec-First Agentic Dev Plugin — Spec-Driven LLM Workflow

**Source:** HN Show HN (posted ~Oct 28, 2026 — 2 days old at time of discovery)  
**Reference:** https://devpick.it-araiguma.com/en/articles/60580  
**Discovered:** 2026-10-30  
**Viability:** 4/4 (WB ✅ · FG ✅ · N ✅ · DU ✅)

## What it is

A VS Code / Claude Code workflow plugin that enforces specification-first agentic development. The author reports generating ~500k lines of code from over 1,000 specifications since early 2026 using this approach. The core idea: every coding task starts with a machine-readable spec file (a short structured YAML/Markdown document) that the agent must satisfy, verify against, and cite in its commits. The plugin scaffolds the spec, tracks which spec requirements are satisfied by which code, and blocks commits that don't link to a spec item.

Key details:
- Spec files: structured YAML with `goal`, `requirements`, `acceptance_criteria`, `out_of_scope`
- Agent prompt injection: the spec is automatically prepended to every Claude Code session for the task
- Requirement tracking: each spec item gets a status (pending/in-progress/verified/blocked)
- Commit hook: blocks commits not linked to a spec item with `spec: #req-N` in the message

## Why it scores

- **Weekend-buildable:** A Claude Code hook + a YAML spec schema + a small CLI tool is the right scope for 1-2 Claude sessions. The VS Code extension layer is optional — the core value is in the hook and schema.
- **Fills gap:** Claude Code sessions currently start with a freeform prompt. There is no structured way to define, track, and verify task requirements before coding begins. The user loses context in long sessions because the original goal isn't machine-tracked.
- **Novel:** Spec-driven LLM workflows are discussed but rarely implemented as a first-class tool. Enforcing spec linkage in commits and auto-injecting the spec into agent context is a concretely new workflow.
- **Daily utility:** Every coding task — new feature, bug fix, refactor — benefits from starting with a 2-minute spec that guides the entire agent session.

## Build angle

Build a spec-first Claude Code workflow as hooks + CLI:

1. A `spec init <task-name>` CLI command that scaffolds a YAML spec file (`~/.claude/specs/<task>.yaml`).
2. A `PreToolUse` hook that reads the active spec and prepends it to the system prompt of the Claude Code session.
3. A `PostToolUse` hook that scans each tool output for `spec: #req-N` patterns and marks requirements as satisfied.
4. A `spec status` CLI command showing a requirements completion board.
5. A `prepare-commit-msg` git hook that warns if the commit message doesn't link to a spec requirement.

## MVP Scope (weekend build)

- [ ] Spec YAML schema: `{goal, requirements: [{id, text, status}], acceptance_criteria, out_of_scope}`
- [ ] `spec init <name>` — creates `~/.claude/specs/<name>.yaml` from a template
- [ ] `spec activate <name>` — writes the spec path to `~/.claude/active-spec`
- [ ] `PreToolUse` hook: reads `~/.claude/active-spec`, loads YAML, prepends formatted spec to `system_prompt`
- [ ] `spec status` — prints a colored checklist of requirement statuses
- [ ] `prepare-commit-msg` git hook: warns (does not block) if no `spec: #req` reference found

## Phases

### Phase 1 — Spec schema & CLI (Day 1, ~2h)
- Define YAML schema with `pydantic` or `zod`
- `spec init`, `spec activate`, `spec status` commands
- Test spec creation and activation flow

### Phase 2 — PreToolUse hook injection (Day 1, ~1.5h)
- Hook reads active spec YAML, formats as a "Current Task Spec:" block
- Appends to `system_prompt` in hook's output JSON
- Verify spec text appears in Claude's context in a real session

### Phase 3 — Requirement tracking (Day 2, ~2h)
- `PostToolUse` hook scans assistant message for `spec: #req-N` patterns
- Updates requirement status in the YAML file
- `spec status` shows ✅/🔄/⬜ per requirement

### Phase 4 — Commit hook (Day 2, ~1h)
- `.git/hooks/prepare-commit-msg` script reads active spec
- Checks commit message for `spec: #req` reference
- Prints a warning (not a block) listing unsatisfied requirements

## Effort estimate

| Phase | Hours |
|-------|-------|
| Spec schema & CLI | 2 |
| PreToolUse hook injection | 1.5 |
| Requirement tracking | 2 |
| Commit hook | 1 |
| **Total** | **~6.5h** |

## Blockers / risks

- Claude Code's hook `system_prompt` injection may have format requirements; test that prepended spec text doesn't break the agent's existing system prompt parsing.
- Long spec files (many requirements) inflate the context window for every tool call; keep spec files under 500 tokens by keeping requirements terse.
- The `spec: #req-N` pattern requires the agent to output it voluntarily — include an explicit instruction in the injected spec block ("After completing a requirement, write `spec: #req-N` in your response").

## Reference

- Show HN post: https://devpick.it-araiguma.com/en/articles/60580
- Claude Code hooks: https://docs.anthropic.com/en/docs/claude-code/hooks
- Claude Code system prompt customization: https://docs.anthropic.com/en/docs/claude-code/configuration

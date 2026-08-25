# anywhere-agents — Portable Agent Config Across Every AI Coding Tool

**Source:** [yzhao062/anywhere-agents](https://github.com/yzhao062/anywhere-agents) · Python/JSON · GitHub (Aug 2026)
**Date discovered:** 2026-08-25

## What it is

Anywhere-agents maintains one canonical config at `~/.agents/config.json` — writing-style rules, permission policies, custom skill references — and syncs it to every AI coding agent on the machine. Each agent reads its rules from its own format (`.claude/CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`, `.github/copilot-instructions.md`, etc.), and each one is generated from the single source of truth by a sync daemon or a `sync` CLI command.

The core value: write your rules once, get consistent agent behavior everywhere. Change one line in config.json, every agent sees it on next sync.

The "safer" angle: a destructive-command guard in the permission policies translates to Claude Code's `denyList` and Cursor's equivalent — the same list of blocked patterns in every tool, not duplicated and drifted across four files.

## Why it fits

- Core interest: **Claude/LLM tooling** — wraps and configures Claude Code and any other LLM-backed agent
- Core interest: **Dev productivity** — eliminates per-agent config drift, a daily friction point when using multiple agents
- `novel = 1`: no tool in the toolkit manages cross-agent rule portability from one source
- `daily_utility = 1`: every session across every tool benefits from consistent, non-drifted rules

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Core is JSON parsing + template rendering + file writes; one session |
| fills_gap | 1 | No tool in the toolkit addresses the multi-agent config drift problem |
| novel | 1 | Cross-agent rule sync from one source is not in the ecosystem |
| daily_utility | 1 | Works silently in the background; every coding session benefits |
| **Total** | **4/4** | **VIABLE** |

**Note:** If yzhao062/anywhere-agents ships a ready-to-install CLI (`pip install anywhere-agents; agents sync`), use it directly rather than building from scratch. The plan below covers a custom implementation tailored to the exact agents and rule categories you use, which is the right choice if the original tool doesn't support all targets or the config schema doesn't fit.

## Stack Recommendation

```
Language:     Python 3.11+ with uv (or TypeScript — either works)
Config:       ~/.agents/config.json — single source of truth
Targets:      Claude Code, Cursor, GitHub Copilot, Aider, Codex CLI
Templating:   Jinja2 (Python) or Handlebars (TS) — templates per agent format
Sync:         CLI command `agents sync` + optional launchd/cron daemon
Watch:        watchfiles (Python) for live-sync on config change
```

## Config Schema

```json
{
  "version": "1",
  "writing_rules": [
    "Default to writing no comments. Only add one when the WHY is non-obvious.",
    "Never write multi-paragraph docstrings.",
    "Prefer editing existing files over creating new ones."
  ],
  "permission_policies": {
    "deny_patterns": [
      "rm -rf",
      "git push --force",
      "DROP TABLE",
      "chmod 777"
    ],
    "require_confirm_patterns": [
      "git reset --hard",
      "kubectl delete"
    ]
  },
  "custom_skills": [
    { "name": "loopx", "path": "~/.agents/skills/loopx.md" },
    { "name": "maka", "path": "~/.agents/skills/maka.md" }
  ],
  "agents": {
    "claude_code": { "enabled": true, "output": "~/.claude/CLAUDE.md" },
    "cursor": { "enabled": true, "output": "~/.cursor/rules/global.mdc" },
    "copilot": { "enabled": true, "output": "~/.github/copilot-instructions.md" },
    "aider": { "enabled": true, "output": "~/.aider.conf.yml" }
  }
}
```

## MVP Scope (1-2 Claude sessions)

Two commands and four agent targets:

1. `agents sync` — read config.json, render each enabled agent's output file from a template, write it
2. `agents watch` — run sync once, then watch `~/.agents/config.json` for changes and re-sync automatically
3. `agents status` — for each enabled agent, show the output path and whether it's in sync (hash match)
4. `agents diff` — show what would change in each agent's file without writing it

## Phases

### Phase 1: Config Schema + Claude Code Target (1h)
- Define `~/.agents/config.json` schema (writing_rules, permission_policies, custom_skills, agents)
- Write the Claude Code template: renders writing_rules as a `## Writing Rules` section, permission_policies.deny_patterns as a `## Banned Commands` list, custom_skills as `## Skills` section
- `agents sync --target claude_code` — render and write to `~/.claude/CLAUDE.md`
- Verify: add a writing rule, sync, confirm it appears in `CLAUDE.md`

### Phase 2: Additional Targets (1.5h)
- Add Cursor target: renders to `~/.cursor/rules/global.mdc` (MDC format with frontmatter `globs: "**/*"`)
- Add GitHub Copilot target: renders to `~/.github/copilot-instructions.md`
- Add Aider target: renders `convention:` block in `~/.aider.conf.yml`
- Verify each: sync, open the output file, confirm the rules appear in the agent's expected format

### Phase 3: Watcher Daemon (0.5h)
- `agents watch` — watchfiles loop on `~/.agents/config.json`, calls `agents sync` on each change
- Print a one-line diff summary per agent on each sync: `claude_code: +1 rule, cursor: unchanged`
- Verify: edit config.json, watch output, confirm all agent files update within 1s

### Phase 4: Status + Diff (0.5h)
- `agents status` — for each enabled agent: output path, last-synced timestamp, in-sync/stale
- `agents diff` — run sync in dry-run mode; print unified diffs for each agent that would change
- Verify: add a rule, run `agents diff` before syncing — diff shows the addition

### Phase 5: Project-level Override (0.5h)
- `agents sync --project .` — read `<project>/.agents/config.json` if it exists, merge with global config (project rules appended after global rules)
- Renders project-local `CLAUDE.md` instead of global `~/.claude/CLAUDE.md`
- Verify: project-level config with one extra rule — synced file contains both global and project rules

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Config schema + Claude Code target | 1h |
| Additional targets | 1.5h |
| Watcher daemon | 0.5h |
| Status + diff | 0.5h |
| Project-level override | 0.5h |
| **Total** | **4h (one day)** |

## Blockers / Risks

- **Agent format churn.** Claude Code's `CLAUDE.md` format, Cursor's `.mdc`, and Copilot's instructions file have all changed in 2026. The templates need to track these. Pin to the format version you're running and update templates when an agent upgrades. Keep templates as plain text files (not inline code) so they're easy to patch.
- **Config merge conflicts.** If a project agent file was edited by hand, `agents sync` would overwrite those manual edits. Add a header comment (`# Generated by anywhere-agents — do not edit directly`) and check for its absence before overwriting; if the file doesn't have the header, print a warning and skip.
- **Aider's YAML format is fragile.** The `~/.aider.conf.yml` merge must not corrupt existing Aider settings. Load the file, update only the `convention:` key, and write back — not overwrite the whole file.
- **Cursor MDC globs.** Cursor's global rules file needs the correct frontmatter globs (`globs: "**/*"`) to apply globally. If the glob is wrong, rules silently don't apply. Hardcode `"**/*"` for the global template; let the project-level override set its own glob.
- **yzhao062/anywhere-agents may already do all of this.** Check the repo before starting Phase 1. If the schema matches and the targets are supported, `pip install anywhere-agents` is the whole project.

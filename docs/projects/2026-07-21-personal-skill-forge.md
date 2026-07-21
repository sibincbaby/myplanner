# Personal Skill Forge

> A curated pack of Claude Code skills tailored to your workflow — built in one session, used every day

**Inspired by:** [suede-creator-skills](https://github.com/JasonColapietro/suede-creator-skills) (45 ⭐)  
**Date discovered:** 2026-07-21

---

## What gap it fills

suede-creator-skills and rohitg00's 135-agent toolkit are generic — they optimise for breadth. A personal skill pack optimises for *your* most-repeated tasks. The skill format is just markdown + optional shell scripts; building one from scratch in a single Claude session is the highest effort-to-value ratio of any project on this list.

## Stack recommendation

Skills live in `.claude/skills/` (project) or `~/.claude/skills/` (global).  
No external dependencies required — skills are markdown files with optional shell snippets.

Optional additions:
- Shell scripts in `.claude/bin/` for multi-step automation
- Hooks in `.claude/settings.json` to auto-invoke skills at lifecycle events

## MVP scope (1 Claude session)

Identify your top 10 most-repeated Claude Code tasks, then write a skill for each. Starting candidates:

| Skill name | Trigger | What it does |
|------------|---------|--------------|
| `/standup` | morning | Reads git log since yesterday, drafts a standup update |
| `/review-diff` | before commit | Reviews staged diff for bugs, style, and missing tests |
| `/expense-log` | ad hoc | Prompts for amount/category/note, appends to finance CSV |
| `/init-project` | new repo | Scaffolds CLAUDE.md, .gitignore, README skeleton |
| `/summarise-pr` | after PR | Reads PR diff, writes summary for description body |
| `/debug-test` | failing tests | Runs tests, reads failures, proposes minimal fix |
| `/draft-commit` | before commit | Reads staged diff, writes a conventional commit message |
| `/context-check` | mid-session | Reports how many tokens remain, summarises session progress |
| `/week-goals` | Monday | Reads open GitHub issues, drafts a weekly priority list |
| `/release-notes` | before tag | Reads commits since last tag, writes CHANGELOG entry |

## Phases

### Phase 1 — Inventory (0.5 h)
- List the 10 tasks you repeat most in Claude Code sessions
- Note which ones involve reading files, running commands, or calling external APIs
- Prioritise by daily frequency

### Phase 2 — Skill files (2 h)
- Write each as a `.md` file in `~/.claude/skills/`
- Include: trigger description, expected inputs, step-by-step instructions to Claude
- Test each skill in a live Claude Code session and iterate

### Phase 3 — Shell helpers (1 h)
- For skills that need non-trivial data (e.g. git log since yesterday), write a short shell script in `.claude/bin/`
- Skills call the script via `Bash` tool and process the output

### Phase 4 — Hooks (0.5 h)
- Wire high-value skills to lifecycle hooks in `.claude/settings.json`:
  - `pre_tool_use`: `/context-check` if session > 80k tokens
  - `post_tool_use`: auto-run linter after Edit tool

### Phase 5 — Open-source + document (1 h)
- Push to GitHub as `<yourname>/claude-skills`
- Write a short README explaining each skill and how to install
- Tag it `claude-code-skills` for discoverability

## Effort estimate

~5 hours total · 1 focused Claude Code session  
Ongoing: 30 min/week refining and adding skills

## Blockers / risks

- **Skill quality decays**: skills that reference file paths or project conventions become stale when the project changes. Mitigation: keep skills generic and prefer asking Claude to discover paths rather than hard-coding them.
- **Skill conflicts**: if you install community skill packs (suede, claude-forge), command names may collide. Mitigation: namespace your personal skills with a prefix (e.g. `/my-standup`).

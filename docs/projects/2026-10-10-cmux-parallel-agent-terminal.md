# cmux — Ghostty-Based Terminal for Parallel AI Coding Agents

**Source:** GitHub Trending October 2026 — https://github.com/manaflow-ai/cmux  
**Tagline:** "A terminal for AI agents built on Ghostty"  
**Discovered:** 2026-10-10

---

## Why it fits

Running more than one Claude Code session means juggling multiple terminal windows, losing track of which agent is on which branch, and missing the moment an agent needs input. cmux solves all three: it's a Ghostty-based macOS terminal that gives each workspace its own pane with live git-branch and PR-status sidebar, rings a pane blue when the agent waiting on you, and supports a programmable API for scripting multi-agent workflows. Dual-licensed GPL-3.0 / commercial, so it's free to use.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 0 | Full Ghostty-native terminal is not a weekend build |
| fills_gap | 1 | No existing tool combines parallel agent tabs + git context + notification ring |
| novel | 1 | Ghostty-based approach is architecturally different from iTerm2/tmux hacks |
| daily_utility | 1 | Directly replaces current terminal for every Claude Code session |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **cmux** — macOS only; install from manaflow-ai releases (Homebrew cask or DMG)
- **Ghostty config** — cmux reads `~/.config/ghostty/config` so existing theme/font settings carry over
- **Claude Code + Codex + Gemini CLI** — run each in a named cmux workspace
- **cmux API** — script workspace creation and agent assignment for project-specific launchers

## MVP Scope

Replace the current terminal workflow with cmux for all Claude Code sessions. Configure one workspace per active project branch.

Not in MVP: custom API scripts, CI webhook integration, cmux commercial license features.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Install cmux; migrate Ghostty config; verify theme and font render correctly | 1 h |
| 2 | Create project workspaces: one per active repo + branch | 1 h |
| 3 | Assign Claude Code to workspaces; confirm git-status sidebar shows branch/PR | 1 h |
| 4 | Test notification ring: trigger an agent input-wait, verify blue ring appears | 1 h |
| 5 | Write a launcher script using cmux API to open standard workspace layout on project open | 2 h |

**Total estimate:** ~6 h (under 1 Claude session)

## Blockers

- macOS only — no Linux/Windows support currently
- GPL-3.0 licence: fine for personal use; commercial use requires Manaflow licence
- cmux is not a worktree manager; must combine with `git worktree` setup separately

## References

- GitHub: https://github.com/manaflow-ai/cmux
- GitHub Trending roundup (Oct 2026): https://www.coddykit.com/pages/blog-detail?id=5129963

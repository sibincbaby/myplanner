# SCMD — Manage What Claude Remembers

**Source:** Product Hunt Oct 3, 2026 daily leaderboard  
**Tagline:** "Manage what Claude Remembers and Keeps as Memory"  
**Discovered:** 2026-10-09

---

## Why it fits

Claude's persistent memory system has grown significantly through 2026. As memories accumulate across hundreds of sessions, there's no native way to browse, edit, or prune them. SCMD is a dedicated memory management UI — the first of its kind in this user's toolkit.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Read memory files + simple CRUD UI; well within 1 session |
| fills_gap | 1 | No memory management project in seen.json; distinct from "memory MCP servers" |
| novel | 1 | Memory *management* (browse/edit/delete/search) is different from memory *storage* |
| daily_utility | 1 | Every Claude session that updates memory creates a maintenance task |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Claude Code plugin** (TypeScript) — panel accessible from the Claude Code UI
- **OR** standalone Electron/Tauri app if plugin API is insufficient
- Memory files live at `~/.claude/memory/` (or inspected from session start)
- No backend needed — all local reads/writes

## MVP Scope

A panel or small Electron app that:
1. Lists all memory entries with timestamps and word count
2. Lets user view full text of any entry
3. Lets user edit or delete any entry
4. Provides a text search across all memories

Not in MVP: tagging, bulk import/export, semantic deduplication.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Discover and parse Claude memory storage format | 2 h |
| 2 | List view with timestamp + preview | 2 h |
| 3 | Edit + delete with file-write-back | 1 h |
| 4 | Full-text search | 1 h |
| 5 | Tag/categorize + export as markdown | 2 h |

**Total estimate:** ~8 h (1 Claude session)

## Blockers

- Memory file format needs to be inspected first (`~/.claude/` directory structure)
- Claude Code plugin API may not expose a general file-write panel — may need to fall back to Electron
- Concurrent write safety (Claude might write memory while user is editing)

## References

- Product Hunt Oct 3: https://www.producthunt.com/leaderboard/daily/2026/10/3
- Claude Code plugin authoring: use `/plugin-authoring` skill

# Kage — Git-Native Memory for Coding Agents

**Source:** GitHub — https://github.com/kage-core/Kage  
**Tagline:** "Git-native memory for coding agents — decisions, fixes, and conventions live beside your code"  
**Discovered:** 2026-10-12

---

## Why it fits

Claude Code and Cursor sessions are stateless: every session starts cold, re-learns your project's quirks, and repeats the same warnings. Kage stores that accumulated knowledge directly in the repo as Open Knowledge Format (OKF) files under `.agent_memory/`, commits them alongside code, and loads the relevant subset at session start via MCP tools. Unlike cloud-synced memory tools (claude-mem, Mori), every byte lives in your own git repo — privacy is structural, not a promise. The citation verifier is the standout feature: if a memory references a function that was refactored away, Kage silently drops that memory rather than confusing the agent.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Single `npx` install, zero accounts or API keys — integrates into any existing project in minutes |
| fills_gap | 1 | No current tool in the toolkit provides persistent, git-versioned, citation-verified project memory |
| novel | 1 | Git-native OKF format + citation verification against live file tree is unique; cloud-mem tools don't do this |
| daily_utility | 1 | Every coding session benefits from not re-explaining the codebase |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Kage MCP server** (`npx` install, no database) — all storage is plain Markdown files in `.agent_memory/`
- **Open Knowledge Format (OKF)** — Google Cloud's structured memory schema (launched June 2026)
- **Claude Code + Cursor + Codex** — all supported via MCP tool registration
- Existing git workflow — memory commits ride alongside code commits, reviewable in PRs

## MVP Scope

Install Kage into one active project, let it observe a week of Claude Code sessions, review the auto-captured memories, and evaluate whether session startup noticeably improves. No code changes to the project required.

Not in MVP: custom OKF category definitions, multi-repo memory sharing, team sync.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Install: `npx @kage-core/kage-graph-mcp install` in the project root; verify AGENTS.md and CLAUDE.md are updated | 30 min |
| 2 | Seed: add 5–10 manual memory files covering key conventions, gotchas, and architecture decisions | 1 h |
| 3 | Run 3 Claude Code sessions; review what Kage auto-captures in `.agent_memory/` | 2 h |
| 4 | Tune: prune stale memories, add missing categories, verify citations still resolve | 1 h |
| 5 | Commit `.agent_memory/` to the repo and add a `.gitignore` exemption; test fresh clone picks up context | 30 min |

**Total estimate:** ~5 h (1 Claude session)

## Blockers

- Node.js required (standard in most dev environments)
- MCP client must support stdio servers — Claude Code and Cursor both do
- OKF is a new format; documentation is sparse — may need to read the kage-core/Kage README carefully
- Early adoption: 6 GitHub stars as of initial listing; bugs likely, community small

## References

- GitHub: https://github.com/kage-core/Kage
- MCP package: `@kage-core/kage-graph-mcp` on npm
- OKF spec: Google Cloud Open Knowledge Format (June 2026)
- Product Hunt: https://www.hunted.space/product/kage-2

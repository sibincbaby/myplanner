# agent-beacon — Cross-Harness Memory Layer for AI Agents

**Source:** [Asymptote-Labs/agent-beacon](https://github.com/Asymptote-Labs/agent-beacon) · beacon.sh (Product Hunt Nov 2, 2026; MIT, local-first)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** install-first. Install beacon, run it alongside your usual agent sessions for a week, then review the generated skills to see what patterns it captured.

## Why this one

The core problem: agents start cold every session. You run Claude Code for an hour, it learns your project's quirks (this API returns nulls, that function has a side effect, always run the linter before committing), the session ends, and tomorrow's agent starts from zero. claude-mem (103k★) solves this for Claude Code specifically. agent-beacon solves it for all agents at once — Claude Code, Cursor, Codex, OpenCode, and 20 others — from a single local store.

The secondary feature is skill generation: beacon watches your sessions and extracts repeatable patterns as `.md` skill files. A correction you make three times becomes a skill that's injected automatically going forward.

**Why FG=1:** The "I use Claude Code for some tasks and Cursor for others and Codex in CI" workflow is real and growing. A separate memory per tool means separate learning curves and repeated corrections. beacon's cross-harness store eliminates that.

**Why N=1:** claude-mem is harness-specific (Claude Code). mem0 is API-based and cloud-hosted by default. agent-beacon is local-first, harness-agnostic, and generates skills from workflow history — not just raw context. The skill-generation angle is the novel differentiator.

**Why WB=1:** Install is `npm install -g agent-beacon && beacon init`. Integration with Claude Code and Cursor takes under 10 minutes via MCP (`beacon mcp install`). The first useful skill generation run takes 3–5 agent sessions.

**Why DU=1:** Memory compounds daily. After a week, beacon's injected context starts noticeably reducing agent mistakes and repeated corrections.

## Stack recommendation

- **agent-beacon CLI** (Node.js, MIT, local-first): core memory and skill generation
- **MCP integration** (3 tools: `beacon_retrieve`, `beacon_compress`, `beacon_stats`): connects to Claude Code, Cursor, Codex, OpenCode
- **Agent Skills integration** (alternative): if your agents use Claude Skills, beacon can export directly as `.md` skill files
- **beacon.sh Cloud (optional, free tier):** cross-machine sync if you work on multiple machines. $20/month for multi-timeline. Local-only is free and has no account requirement.

## MVP scope

1. Install beacon CLI and run `beacon init` to set up the local store
2. Install the MCP integration: `beacon mcp install` (adds beacon to Claude Code + Cursor configs)
3. Run 3–5 normal agent sessions without changing your workflow
4. Run `beacon skills generate` to produce skill files from captured patterns
5. Review generated skills: accept, reject, or edit each one

Out of scope (MVP): cloud sync, team sharing, custom skill templates, direct CI integration.

## Phases

1. **Install + baseline (30 min).** Install and run `beacon init`. Connect to your primary agent via `beacon mcp install`. Run one normal Claude Code session; confirm beacon is capturing.
2. **One week of passive capture (no effort).** Let beacon run in the background. It captures corrections, patterns, and context from all sessions.
3. **First skill review (1 session).** Run `beacon skills generate`. Review the output. Edit or reject skills that are too specific. Accept the ones that generalize. Check that `beacon_retrieve` is surfacing relevant context in new sessions.
4. **Cross-harness setup (1 session, if using Cursor/Codex).** Run `beacon mcp install --all` to add beacon to every installed agent. Verify that the same skill set surfaces in a Cursor session.
5. **Skill curation (ongoing).** Every two weeks, run `beacon skills review` to trim outdated skills and promote patterns that have been useful.

## Effort

Install: 30 minutes. First skill generation: 1 session after one week of passive use.

## Blockers / risks

- **Privacy:** beacon captures all tool calls and agent output by default. If your sessions include secrets or proprietary code, configure `beacon ignore` rules before starting. Local-first means data stays on disk, but the disk path matters.
- **Skill noise:** auto-generated skills can be over-specific ("in project X, function Y should be called before Z"). The review step is important — low-quality skills add noise rather than signal. Plan 20–30 minutes for the first review.
- **MCP conflict:** if you already have other memory MCPs installed (claude-mem, mem0), there may be context duplication. Run beacon standalone for the first week to establish a baseline before layering.
- **Session attribution:** beacon attributes captured context to the agent that ran it. In a worktree setup (e.g., with worktrunk), verify that beacon correctly identifies which project each session belongs to.

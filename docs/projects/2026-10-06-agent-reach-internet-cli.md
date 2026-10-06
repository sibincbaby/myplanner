# Agent-Reach — Give Your AI Agent Eyes to See the Entire Internet

**Source:** <https://github.com/Panniantong/agent-reach>
**Discovered:** 2026-10-06
**Viability:** 3/4

> A unified CLI and MCP server that gives AI coding agents the ability to read and search Twitter, Reddit, YouTube, GitHub, Bilibili, and XiaoHongShu — zero API fees. Works with Claude Code, Cursor, Windsurf, and anything that can run shell commands. Routes each platform request through the best available access method and auto-recovers when one breaks. 77k GitHub stars.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

The gap: when you ask a Claude Code agent to research a technical topic, it can't browse Reddit threads, check Twitter for recent reactions, or watch a YouTube tutorial — it has no persistent internet access. Agent-Reach closes this gap with a single CLI install. Zero API fees because it routes through free access paths rather than paid platform APIs. Novel because it handles 6 platforms under one interface with automatic fallback when a platform blocks its access path. Daily utility is 0 because internet research is a session-specific need, not a constant one — but when you need it, it's transformative.

---

## Implementation Plan

**15 minutes** to install Agent-Reach as an MCP server in Claude Code. No build session needed.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Install | `npx skills add Panniantong/agent-reach` | Official install |
| Integration | MCP (stdio) | Works in Claude Code, Cursor, Windsurf |
| Platforms | Start with Reddit + GitHub | Highest signal-to-noise for technical research |
| Rate limiting | Built-in | Auto-throttles to avoid bans |

---

## MVP Scope

1. Install Agent-Reach via `npx skills add Panniantong/agent-reach`
2. Register as MCP server in `~/.claude/settings.json`
3. Verify in Claude Code: "Search Reddit r/LocalLLaMA for recent posts about Ollama performance" → confirm real results
4. Verify: "Find GitHub repos trending today in the Python AI category" → confirm trending list
5. Verify: "Search Twitter for recent Claude Code updates" → confirm recent tweets appear

Out of scope for MVP: YouTube video content analysis, Bilibili/XiaoHongShu (unless you use these platforms), custom routing overrides.

---

## Implementation Phases

### Phase 1: Install + MCP registration

**Goal:** Agent-Reach registered and accessible in Claude Code.

**Steps:**
1. `npx skills add Panniantong/agent-reach` — installs agent-reach globally
2. Verify install: `agent-reach --version` and `agent-reach health` (should show platform statuses)
3. Add to `~/.claude/settings.json`:
   ```json
   {
     "mcpServers": {
       "agent-reach": {
         "command": "agent-reach",
         "args": ["serve", "--stdio"]
       }
     }
   }
   ```
4. Restart Claude Code; verify "agent-reach" tools appear in tool picker
5. Quick test: ask Claude to "search GitHub for MCP servers trending this week" → confirm real results

---

### Phase 2: Verify each platform

**Goal:** Confirm the platforms you'll use are healthy.

**Steps:**
1. `agent-reach health` — check status of each platform (green/yellow/red)
2. Reddit: "Search r/ClaudeAI for posts about Claude Code performance from the last week" → verify results include real thread titles and scores
3. GitHub: "Find issues in the anthropics/claude-code repo mentioning MCP timeout" → verify specific issues
4. Twitter: "Find recent tweets about Claude Code from @AnthropicAI or mentioning @ClaudeAI" → verify recent content
5. YouTube (optional): "Search YouTube for Claude Code tutorial 2026" → verify video titles and descriptions

---

### Phase 3: Add to research workflow

**Goal:** Agent-Reach becomes the default research step before major decisions.

**Workflow examples:**
1. Before adding a new dependency: "Search Reddit r/javascript and r/node for complaints about [package-name] in the last 3 months"
2. Before debugging a tricky error: "Search GitHub issues for [error message] across repos using [framework]"
3. Before choosing an architecture: "Search Hacker News for discussion of [approach] vs [alternative]"
4. When evaluating a new tool: "Find GitHub repos using [tool] and check their issue tracker for common pain points"

Add these as CLAUDE.md research prompts so the agent runs them automatically before major implementation decisions.

---

## Estimated Effort

15 minutes install + 30 minutes verification.

- **10 min:** Install + settings.json config
- **5 min:** Health check
- **30 min:** Verify each platform with real queries

## Potential Blockers

- **Platform blocking:** Agent-Reach routes to the best available access path per platform, but platforms periodically block scrapers. If `agent-reach health` shows a platform as red, it may take 24-48 hours for the built-in rerouting to find a working alternative.
- **Rate limits:** Even with built-in throttling, aggressive research queries (10+ searches in a few minutes) can trigger temporary rate limits on Reddit or Twitter. Space out queries in long research sessions.
- **Twitter reliability:** Twitter/X has been the most volatile platform for third-party access. If Twitter shows as degraded, the other 5 platforms continue working. Don't block research workflows on Twitter availability.
- **77k stars, mature project:** Agent-Reach launched September 2026. The install and health check paths are reliable. The edge cases are platform-specific access methods; check the GitHub issues if a specific platform fails.

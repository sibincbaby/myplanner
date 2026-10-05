# OpenDots — Persistent Always-On AI Agent Workspace

**Source:** <https://github.com/CopilotKit/OpenDots>
**Discovered:** 2026-10-05
**Viability:** 4/4

> An MIT-licensed TypeScript/Next.js template for "always-on AI coworkers that move between text, calls, and Slack." Each Dot is a persistent agent with its own computing environment, document space, and memory that survives across sessions and can be reached by Slack DM or voice call.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

The gap vs Claude Code: Claude Code sessions are ephemeral and single-purpose. An OpenDots Dot accumulates context across sessions, remembers prior findings, and can be pinged asynchronously. The template deploys in one `npm run dev` and configures agents as TypeScript objects. MVP: fork → deploy locally → configure a ResearchDot (web search + persistent findings store) and a FinanceDot (wired to the finlynq MCP). 1-2 sessions to a running personal workspace. The 3.2k-star base and CopilotKit runtime handle the hard parts (streaming, tool calls, Slack bot).

---

## Implementation Plan

**1-2 Claude Code sessions** to a running local workspace with 2 specialized Dots.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Template | CopilotKit/OpenDots | MIT, TypeScript, 3.2k stars, actively developed |
| Runtime | CopilotKit Cloud (free tier) | Handles streaming, tool-call state, Slack routing |
| Model | Claude Sonnet (primary) + Haiku (quick tasks) | Anthropic SDK direct |
| Persistence | Supabase (free tier) | Dot memory, conversation history, findings store |
| Voice | Twilio Voice API (stretch) | Template already has the integration wired |
| Slack | Slack bot token (stretch) | Template handles routing |

---

## MVP Scope

Two configured Dots:

**ResearchDot** — persistent web research agent:
- Tools: `web_search(query)`, `save_finding(title, content, tags)`, `recall_findings(query)`, `summarize_session()`
- Memory: findings stored in Supabase `findings` table, searchable by tags + semantic query
- Behavior: always accumulates context; on new research request, first checks prior findings before hitting the web

**FinanceDot** — personal finance agent:
- Tools: all tools from the finlynq MCP server (or a subset of 10 key ones)
- Behavior: can answer "what did I spend on coffee this month?", "run FIRE projection at 8% return", "set budget for dining €400"
- Memory: last 30 days of transaction context always in window

Out of scope for MVP: Slack integration, voice calls, multi-user, RBAC.

---

## Implementation Phases

### Phase 1: Fork + local deploy + base configuration

**Goal:** OpenDots running at `localhost:3000` with the default demo removed and CopilotKit configured.

**Steps:**
1. `git clone https://github.com/CopilotKit/OpenDots && cd OpenDots && npm install`
2. Copy `.env.example` → `.env.local`; add `ANTHROPIC_API_KEY`, `COPILOTKIT_CLOUD_KEY` (free tier), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Run `npm run dev` → confirm default Dots load at `localhost:3000`.
4. In `dots.config.ts`: remove demo Dots, add `ResearchDot` and `FinanceDot` skeletons.
5. Confirm the workspace loads with 2 empty Dots and no errors.

**Verify:** Both Dots appear in the sidebar; basic text message returns a Claude response.

---

### Phase 2: ResearchDot — persistent findings

**Goal:** ResearchDot accumulates web research findings across sessions.

**Files:**
- `dots/research/tools.ts` — `web_search`, `save_finding`, `recall_findings`, `summarize_session`
- `dots/research/memory.ts` — Supabase CRUD for `findings(id, title, content, tags, created_at)`
- `dots/research/prompt.ts` — system prompt instructing ResearchDot to check prior findings before searching

**Key steps:**
1. `web_search`: call Anthropic's built-in web search tool (or wrap a Brave Search API call).
2. `save_finding`: insert into Supabase `findings`; confirm success.
3. `recall_findings(query)`: full-text search over `findings.content || findings.title` in Supabase.
4. System prompt: "Before searching the web, always call `recall_findings` with the user's query. Only search the web if no relevant findings exist or the user explicitly asks for fresh information."

**Verify:** Research "latest MCP security vulnerabilities" → confirm finding saved. Re-ask the same query → confirm Dot retrieves from memory instead of re-searching.

---

### Phase 3: FinanceDot — finlynq MCP integration

**Goal:** FinanceDot is a thin wrapper over the finlynq MCP server.

**Files:**
- `dots/finance/mcp-client.ts` — MCP client connecting to finlynq stdio server
- `dots/finance/tools.ts` — re-exports the 10 most useful finlynq tools as CopilotKit tools
- `dots/finance/prompt.ts` — system prompt with user's currency, budget philosophy, FIRE target

**Key steps:**
1. Start finlynq MCP server as a child process (`spawn('node', ['path/to/finlynq/mcp.js'])`).
2. Connect via `@modelcontextprotocol/sdk` MCP client over stdio.
3. Expose 10 tools: `list_transactions`, `add_expense`, `get_budget_status`, `get_net_worth`, `fire_projection`, `monte_carlo_simulation`, `list_goals`, `update_goal`, `spending_by_category`, `income_vs_expenses`.
4. System prompt includes: "User's FIRE target: €1.2M. Current net worth: {dynamic from finlynq}. Report currency: EUR."

**Verify:** Ask "Am I on track for FIRE by 45?" → confirm FinanceDot calls `fire_projection` and `monte_carlo_simulation`, returns a readable answer.

---

### Phase 4 (stretch): Slack integration

**Goal:** Message a Dot via Slack DM; get responses without opening the web UI.

**Steps:**
1. Create a Slack App at api.slack.com → add `chat:write`, `im:read`, `im:history` OAuth scopes.
2. Add `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` to `.env.local`.
3. Set OpenDots' Slack webhook URL in the Slack app's event subscriptions.
4. Test: DM `@ResearchDot what are the top AI papers from this week?`

---

## Estimated Effort

About 1-2 Claude Code sessions.
- **Session 1 (≈ 2 h):** Phase 1 + 2. Fork, deploy, Supabase, ResearchDot with persistent findings.
- **Session 2 (≈ 2 h):** Phase 3 (FinanceDot + finlynq MCP) and optional Phase 4 (Slack).

## Potential Blockers

- **CopilotKit Cloud free tier limits:** Check `copilotkit.ai` for free-tier message quotas. For local-only use, CopilotKit can run self-hosted (`@copilotkit/backend`); swap `COPILOTKIT_CLOUD_KEY` for local config.
- **Supabase free tier:** 500 MB storage, 2 GB bandwidth — more than enough for personal use.
- **finlynq Docker dependency:** FinanceDot requires finlynq running. If not yet deployed, mock the 3 most-used tools first and add the real MCP connection in a follow-up session.
- **Voice calls:** Twilio is paid ($0.013/min); skip for MVP. The template has a flag to disable the voice button.
- **Alpha status:** OpenDots README states "Alpha — breaking changes expected." Pin to a specific commit SHA rather than HEAD.

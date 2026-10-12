# AgentLens — MCP-Native Agent Observability & Audit Trail

**Source:** GitHub Trending (agents-radar October 2026 digest)  
**Tagline:** "Observability and audit-trail platform for agents — MCP-native, logging LLM calls, tool invocations, and decisions"  
**Discovered:** 2026-10-09

---

## Why it fits

As agent pipelines grow more complex (multi-session, parallel, cloud), debugging what actually happened in a run requires structured logging — not just terminal output. AgentLens is MCP-native (sits between agent and tools) and logs the full decision chain. Nothing equivalent exists in this toolkit.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | MCP proxy server + SQLite + minimal web dashboard is 2-session scope |
| fills_gap | 1 | No agent observability tool in seen.json; MCPaudit is for auditing, not live tracing |
| novel | 1 | MCP-native proxy that captures the full tool-invocation graph is structurally new |
| daily_utility | 0 | Useful for debugging runs, not opened every single session |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **TypeScript MCP proxy server** — sits in front of all downstream MCP servers
- **SQLite** — structured audit log (session id, tool name, input, output, latency)
- **Static HTML dashboard** or **Next.js** — timeline visualization
- Works with Claude Code via MCP config (`mcpServers` in settings)

## MVP Scope

An MCP proxy that every tool call routes through:
1. Intercepts and logs all tool calls with timing + inputs/outputs
2. Stores to SQLite
3. Serves a local web dashboard (`localhost:4444`) showing a session timeline

Not in MVP: alerts, cross-session comparison, anomaly detection.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | MCP proxy server that forwards all calls and logs to SQLite | 4 h |
| 2 | Session timeline web view (HTML + vanilla JS) | 3 h |
| 3 | Tool-call detail drill-down (inputs, outputs, latency) | 2 h |
| 4 | Session replay — step through decisions in order | 3 h |
| 5 | Alert rule engine (e.g., "notify if tool X called > 10 times") | 2 h |

**Total estimate:** ~14 h (2 Claude sessions)

## Blockers

- MCP 2026-07-28 spec moves to request/response (stateless); proxy pattern needs to handle both old and new spec
- Claude Code MCP configuration must point all servers through the proxy — requires user config changes
- Large output payloads (file reads) will bloat the SQLite log; need size limits

## References

- Discovered via: https://github.com/kouweizhu/agents-radar/issues/3628 (Oct 6 digest)
- MCP spec: https://claude.com/blog/bringing-mcp-2026-07-28-to-claude

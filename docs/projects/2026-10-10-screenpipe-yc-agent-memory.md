# Screenpipe — Local AI Agent Memory via Screen & Audio Capture

**Source:** HN Launch HN (YC S26) — https://news.ycombinator.com/item?id=49024620  
**Tagline:** "Record how you work and turn that into agents"  
**Discovered:** 2026-10-10

---

## Why it fits

Claude Code sessions are ephemeral — every new session starts blind to what you did yesterday. Screenpipe solves this by running a local daemon that records your screen and audio 24/7, indexes it in a searchable store, and exposes it via an MCP server. Any Claude Code session can then query what you were working on, what error you saw at 14:32, or which file you had open during yesterday's PR review. Pairs directly with Claude Code's persistent memory system to give agents genuine long-term context.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 0 | Core capture daemon is a complex native app (YC-backed, not a weekend build) |
| fills_gap | 1 | Claude Code currently has zero visibility into past work sessions |
| novel | 1 | Local-first, privacy-preserving continuous capture; no cloud upload required |
| daily_utility | 1 | Running as a background daemon, it enriches every coding session automatically |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **Screenpipe daemon** — install binary from `brew install screenpipe` or official releases
- **Screenpipe MCP server** — ships with the daemon; wire into Claude Code settings
- **Claude Code** — query context via `@screenpipe` MCP tool calls or CLAUDE.md hooks
- **Privacy filter** — configure `~/.screenpipe/config.toml` to exclude password managers, banking sites

## MVP Scope

Install Screenpipe, configure the MCP integration, and wire a startup hook that tells Claude Code to pull the last 2h of activity at session start.

Not in MVP: custom summarisation pipeline, Obsidian sync, automated SOP generation.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Install daemon and confirm capture running (`screenpipe status`) | 1 h |
| 2 | Add MCP server to Claude Code `settings.json` under `mcpServers` | 1 h |
| 3 | Write CLAUDE.md startup hook: "On session start, query last 2h of screenpipe context" | 1 h |
| 4 | Configure privacy filters (exclude bank/password URLs, Terminal windows with secrets) | 2 h |
| 5 | Test: open a project with prior context, verify Claude Code recalls yesterday's state | 1 h |

**Total estimate:** ~6 h (under 1 Claude session)

## Blockers

- Disk space: continuous screen capture accumulates fast; need to configure retention policy
- Privacy audit: must review what is being captured before committing to daily use
- MCP server may require Screenpipe Pro for some query features (verify licence)

## References

- HN Launch HN: https://news.ycombinator.com/item?id=49024620
- MCP server listing: https://mcpservers.org/servers/mediar-ai/screenpipe

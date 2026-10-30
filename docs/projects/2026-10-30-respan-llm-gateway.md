# Respan — Self-Hosted LLM Gateway with MCP & Routing

**Source:** HN Show HN (Oct 21, 2026) — Respan is an open-source AI gateway written in Rust  
**Repo:** https://github.com/respan-ai/respan  
**Discovered:** 2026-10-30  
**Viability:** 4/4 (WB ✅ · FG ✅ · N ✅ · DU ✅)

## What it is

Respan is an open-source AI gateway built as a Rust plugin system. It provides unified routing across LLM providers (OpenAI, Anthropic, Gemini, local models), MCP server integration, automatic fallbacks, and request routing based on model cost and capability. The team says it has built on LiteLLM since 2024. Key traits: provider-agnostic routing, MCP as a first-class concept in the gateway layer, and a plugin architecture for custom middleware.

Key details:
- Rust core with a plugin system for providers, middleware, and routing strategies
- MCP support built into the routing layer (agents can declare tools; gateway picks the model)
- Automatic fallbacks when a provider is down or rate-limited
- Self-hosted, no vendor lock-in

## Why it scores

- **Weekend-buildable:** A TypeScript MVP — an Express/Hono server that proxies to multiple providers, reads an MCP tool manifest, and applies simple round-robin/cost routing — is achievable in 1-2 Claude sessions. No need to replicate the Rust core.
- **Fills gap:** The user already works with Claude Code and custom MCP servers. A local gateway that routes tool calls to the cheapest/fastest available model, and falls back when Anthropic is rate-limited, fills a real daily friction point.
- **Novel:** Respan's value is MCP-aware routing at the gateway layer, not just provider switching. No existing tool (LiteLLM, Portkey) treats MCP tool manifests as a first-class routing signal.
- **Daily utility:** Every Claude Code session that calls external MCP tools or multiple providers would benefit from a local routing proxy.

## Build angle

Build a TypeScript LLM gateway with MCP-aware routing as a local reverse proxy:

1. An Express/Hono server listening on `localhost:8080` that speaks the OpenAI Chat Completions API format.
2. A provider registry (Claude, GPT-4, Gemini) with cost-per-token metadata.
3. An MCP tool manifest reader: if the request includes tools that match a provider's known capability set, route to that provider.
4. Fallback chain: if provider A returns 429/500, retry on provider B.
5. A config YAML (`~/.gateway/config.yaml`) for provider keys and routing rules.

## MVP Scope (weekend build)

- [ ] Hono HTTP server proxying to Anthropic and OpenAI APIs (same request format, translated internally)
- [ ] Config loader from YAML: providers, keys, cost-per-token
- [ ] Routing logic: prefer cheapest model unless `tools` are present (then prefer Claude for MCP tool calls)
- [ ] Fallback: retry on next provider on 429/500/timeout
- [ ] Basic logging: request→provider→latency→cost per call to a local SQLite log
- [ ] README with `claude mcp add` setup instructions

## Phases

### Phase 1 — Proxy core (Day 1, ~2h)
- Hono server with `/v1/chat/completions` endpoint
- Translate Anthropic ↔ OpenAI message formats
- Round-trip test with both providers

### Phase 2 — Routing & fallback (Day 1, ~2h)
- Config YAML parser (provider list, cost metadata)
- Routing selector: cheapest model for plain prompts, Claude for tool-bearing requests
- Fallback chain on error codes

### Phase 3 — MCP tool routing (Day 2, ~2h)
- Parse `tools` array from request; match against provider capability tags in config
- Force-route to Claude when MCP tool names match a `mcp_tools` allowlist

### Phase 4 — Logging & observability (Day 2, ~1h)
- SQLite log: `{ts, provider, model, input_tokens, output_tokens, latency_ms, cost_usd}`
- `gateway stats` CLI command for daily cost summary

## Effort estimate

| Phase | Hours |
|-------|-------|
| Proxy core | 2 |
| Routing & fallback | 2 |
| MCP tool routing | 2 |
| Logging & observability | 1 |
| **Total** | **~7h** |

## Blockers / risks

- Anthropic and OpenAI request formats differ enough that translation layer needs careful testing; use `zod` schemas to validate both sides.
- MCP tool names in Claude's format (`server__tool`) may not map cleanly to OpenAI function names — normalize with a slug transform.
- Running a local server as a Claude Code MCP proxy requires `claude mcp add` with `--transport sse` and careful port management.

## Reference

- Respan repo: https://github.com/respan-ai/respan
- Anthropic Messages API: https://docs.anthropic.com/en/api/messages
- Hono web framework: https://hono.dev/
- LiteLLM (prior art): https://docs.litellm.ai/

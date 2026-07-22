# ClaudeScope

> OpenTelemetry observability for Claude Code: trace every tool call, token spend, and cost to any OTEL backend — one alias to rule all your sessions

**Inspired by:** [claude_telemetry](https://github.com/TechNickAI/claude_telemetry)  
**Date discovered:** 2026-07-22

---

## What gap it fills

Running Claude Code in CI, cron jobs, or long coding sessions means all context is lost when the session ends. You can't answer "why did that session cost so much?" or "which tool calls are slowest?" without digging through raw JSONL transcripts. ClaudeScope parses those transcripts post-run and forwards structured traces to any OpenTelemetry backend (Logfire, Honeycomb, Datadog) so you can query cost, latency, and tool usage over time — all without wrapping the CLI or touching Claude's internals.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Parser | Python + stdlib `json` | JSONL is simple; no heavy deps |
| OTEL | `opentelemetry-sdk` + `opentelemetry-exporter-otlp` | Standard; works with Logfire, Honeycomb, Datadog |
| Backend | Logfire (free tier) | LLM-aware spans out of the box; zero infra |
| Trigger | Claude Code `stop` hook | Fires after every session; passes transcript path |
| CLI | Single `claudescope ingest <file>` command | Can also run as a post-session hook |

## MVP scope (1 Claude session)

Four core capabilities:
1. Parse a Claude Code session JSONL and extract: session start/end, all tool calls + durations, token counts, estimated cost
2. Emit one OTEL span per tool call with attributes: `tool.name`, `tool.duration_ms`, `session.id`, `model`, `tokens.input`, `tokens.output`
3. Emit a parent span per session with totals
4. Ship via `claudescope ingest ~/.claude/projects/.../session-*.jsonl`

Out of scope for MVP: real-time streaming, per-project dashboards, cost alerts.

## Phases

### Phase 1 — JSONL parser (1 h)
- Read Claude Code session transcript format
- Extract tool calls: `type=tool_use` entries with name, input, timing
- Extract token counts from `usage` blocks
- Compute duration between `tool_use` and its `tool_result`

### Phase 2 — OTEL span builder (1 h)
- One root span per session with `session.id`, `model`, `total_cost_usd`
- Child spans per tool call with start/end times and attributes
- Logfire exporter config (env-var `OTEL_EXPORTER_OTLP_ENDPOINT`)

### Phase 3 — Claude Code hook integration (0.5 h)
- `.claude/settings.json` `stop` hook: `claudescope ingest "$CLAUDE_TRANSCRIPT"`
- Fallback: a `claudia` shell alias that runs claude then calls claudescope on the latest session

### Phase 4 — Daily cost summary (1 h)
- `claudescope summary --days 7` prints a table: date, sessions, tokens, cost
- Reads all JSONL files in `~/.claude/projects/` without needing OTEL

### Phase 5 — Budget alerts (0.5 h)
- `~/.claudescope/config.toml`: `[alerts] daily_cost_usd_limit = 2.00`
- Exit with code 1 and print a warning when limit is exceeded

## Effort estimate

~4 hours for Phase 1–3 · 1 Claude session  
~5 hours complete

## Blockers / risks

- **Transcript format changes**: Anthropic occasionally updates the JSONL schema. Mitigation: treat unknown fields as no-ops; parse defensively.
- **Logfire account required**: free tier is sufficient. Mitigation: Phase 4 summary works fully offline.
- **Token cost computation**: Claude Code doesn't always embed cost directly. Mitigation: derive from token counts × model pricing table stored in a small JSON file.

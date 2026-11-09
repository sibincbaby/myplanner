# billion-context — Infinite-Session Context Compression Proxy

**Source:** [ranxianglei/billion-context](https://github.com/ranxianglei/billion-context) (GitHub trending Nov 8, 2026; TypeScript/Node.js, MIT, 5.2k★)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** build-your-own. The gap isn't installing billion-context (which you can do in five minutes via npm install bili), it's owning a lightweight version that fits your workflow: one file, no npm dependency, easy to modify.

## Why this one

Claude Code sessions die from context exhaustion. The common workarounds — `/compact`, restarting sessions, or chunking work by hand — all break flow. billion-context solves this by folding consumed conversation into layered summaries that the model calls on demand via injected tool calls, turning a finite context window into an effectively infinite one.

The core idea is a MITM proxy that intercepts every API call: when tokens cross a threshold it compresses the oldest context into a summary, caches it on disk, and injects a `decompress` tool so the model can recover detail on request. The result is sessions that run for hours or days on complex codebases without losing track of earlier decisions.

**Why FG=1:** Sessions dying at the wrong moment is a weekly frustration. The alternative — `/compact` — loses nuance and forces you to re-explain context. A proxy that handles this automatically removes the biggest interruption in long coding work.

**Why N=1:** headroom (79.2k★, already seen) compresses individual tool outputs. billion-context is different: it compresses the *conversation history itself*, preserving cross-turn state across the whole session. The reversible layered-summary approach and the model-driven `compress`/`decompress` tools are a novel mechanism not seen in earlier tools.

**Why WB=1:** A minimal version — a Node.js MITM proxy on port 8787 that counts tokens, compresses old messages into a summary via the Claude API, and writes the summary to SQLite — is a focused 1-session build. The full billion-context has benchmarks, multi-agent support, cache-hit rate monitoring, and 20+ integrations, but the core loop is small.

**Why DU=1:** Every Claude Code session that runs longer than 30 minutes benefits. Once installed it runs invisibly; the win compounds with session length.

## Stack recommendation

- **Node.js 22+** with built-in SQLite — no extra database to install
- **TypeScript** — the existing project is a good reference for the proxy structure
- **Anthropic SDK** — for the compression LLM call (a small model like Haiku 5.5 is enough)
- **`http-proxy` or `http-mitm-proxy`** npm package — handles the MITM layer
- **`tiktoken-node`** — accurate token counting for Claude models

## MVP scope

A single Node.js script (`bili-mini.ts`) that:
1. Starts an HTTP proxy on port 8787
2. Intercepts `POST /v1/messages` calls to any Anthropic endpoint
3. Counts total tokens in the `messages` array
4. When total > 60% of `max_tokens`, calls Claude Haiku 5.5 to summarize the oldest 40% of messages into a single assistant message
5. Replaces those messages with the summary and continues
6. Saves the compression event to SQLite (timestamp, tokens before/after, summary preview)
7. Exposes a `GET /status` endpoint showing current session token counts and compression history

Configure Claude Code via `~/.claude/settings.json` to use `ANTHROPIC_BASE_URL=http://localhost:8787`.

Out of scope (MVP): `decompress` tool, multi-agent support, monitoring UI, Python/CLI wrappers.

## Phases

1. **Core proxy (1 session).** Build the MITM proxy that passes requests through transparently. Confirm Claude Code works through it. Add token counting.
2. **Compression loop (1 session).** When token threshold is crossed, call Haiku 5.5 to summarize old messages. Replace them in the outgoing request. Write compression event to SQLite. Test on a real 2-hour coding session.
3. **Reversible compression (1 session).** Inject a `decompress` tool into every request. When the model calls it, return the original text from SQLite. This turns compression from lossy to reversible.
4. **Monitoring endpoint (30 min).** Add `GET /status` JSON and a minimal HTML page at `GET /ui` showing session length, token savings, and compression count.
5. **Configuration and packaging (30 min).** Read threshold and compression model from env vars. Write a `start-with-cc` shell alias that sets `ANTHROPIC_BASE_URL` and launches Claude Code.

## Effort

Phases 1–2: 1 session. Phases 3–5: 1 more session. Total: 2 sessions.

## Blockers / risks

- **Compression quality:** poor summaries drop important context (variable names, prior decisions). Mitigate by writing a detailed compression prompt that preserves code snippets verbatim and summarizes only prose.
- **Streaming responses:** Claude Code uses SSE streaming. The proxy must buffer the full response before forwarding it, or handle streaming passthrough without breaking the token counter. Use a non-streaming internal call for the compression step, but pass streaming through for normal calls.
- **Token counting accuracy:** `tiktoken-node` for cl100k_base is a good approximation but not exact. A ±5% error on threshold detection is acceptable; the proxy errs toward more compression.
- **SQLite concurrency:** if multiple Claude Code sessions share the same proxy port, SQLite writes can collide. For MVP use a single port per session; multi-session support is a later phase.

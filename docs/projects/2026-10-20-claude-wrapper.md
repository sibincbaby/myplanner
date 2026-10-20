# claude-wrapper — OpenAI-Compatible API Server for Claude Code CLI

**Source:** GitHub — https://github.com/ChrisColeTech/claude-wrapper  
**Tagline:** "Expose Claude Code's underlying model as an OpenAI-compatible Chat Completions endpoint so any tool that speaks the OpenAI API can use your Claude plan subscription."  
**Discovered:** 2026-10-20

---

## Why it fits

Dozens of developer tools — Open WebUI, Continue.dev, LM Studio, Cursor's API-key mode, many VS Code extensions — speak only the OpenAI Chat Completions format (`POST /v1/chat/completions`). Claude has a native API, but that's a separate pay-per-token billing surface. claude-wrapper bridges the two: it runs a local server that accepts OpenAI-format requests and routes them through the `claude -p` CLI subprocess, which uses your Claude Pro/Max plan quota.

This means: Open WebUI, Continue, and any other OpenAI-compatible frontend can talk to your Claude plan with zero API spend. The same gap that Atticus (Oct 20 companion project) fills for voice, claude-wrapper fills for the entire ecosystem of OpenAI-format tools.

Prior art in toolkit: no covered tool does this. LiteLLM proxies the Claude *API*, not the CLI; it requires an API key. claude-wrapper specifically wraps the *Claude Code CLI subprocess* so requests go through the subscription path.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Express + child_process subprocess management; well-understood pattern; achievable in 1 session |
| fills_gap | 1 | No covered tool routes OpenAI-format requests through the Claude plan subscription via CLI |
| novel | 1 | Wrapping the Claude Code CLI subprocess (not the API) is the novel mechanism; no known OSS equivalent |
| daily_utility | 1 | Any OpenAI-compatible tool — Open WebUI, Continue.dev, any VS Code extension — can now use the Claude plan |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Node.js / TypeScript** — Express server; matches the existing claude-wrapper implementation
- **child_process.spawn** — spawn `claude -p "<prompt>"` per request; capture stdout line by line
- **express** — single POST route at `/v1/chat/completions`; return OpenAI-format JSON
- **uuid** — generate `id` fields in the response envelope
- **p-queue** — optional: limit concurrent claude subprocesses to avoid plan rate limits

## MVP Scope

1. Express server on `localhost:11434` (or configurable port)
2. POST `/v1/chat/completions`: accept `{model, messages, stream}` payload
3. Map `messages` array to a text prompt (system + user turns concatenated); call `claude -p "<prompt>"`
4. Wrap stdout in an OpenAI completion response: `{id, object, choices: [{message: {role, content}}], usage}`
5. Return `200 OK` with the wrapped response

Not in MVP: streaming SSE, tool calling, function calling, multi-turn session continuity, model routing.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Express boilerplate: POST `/v1/chat/completions`; parse body; validate `messages` array | 20 min |
| 2 | Message serialisation: flatten `messages` to `<role>: <content>\n...` string; handle system prompt | 20 min |
| 3 | subprocess invocation: `child_process.spawn('claude', ['-p', prompt])`; buffer stdout to completion | 30 min |
| 4 | Response wrapping: build OpenAI-format `{id, object: "chat.completion", choices, usage}` JSON | 20 min |
| 5 | Streaming mode: if `stream: true`, spawn claude and pipe stdout as SSE chunks in `data: {"choices":[{"delta":{"content":"..."}}]}` format | 45 min |

**Total estimate:** ~2.5 h (1 Claude session; streaming adds ~45 min)

## Blockers

- **`claude -p` cold start**: the first call in a session takes 2–4 s; subsequent calls are faster but not zero-latency; expose a `/health` or keepalive endpoint that pre-warms the subprocess
- **Session continuity**: `claude -p` is stateless by default; multi-turn conversations must prepend the full history as the prompt (same approach as Open WebUI does with other local models)
- **Plan rate limits**: Claude plans enforce per-minute and per-day message limits; concurrent requests that each spawn a subprocess can hit the limit fast — use a queue (p-queue) to serialise calls
- **Tool calling**: the OpenAI `tools` parameter has no direct equivalent in `claude -p`; omit in MVP or preprocess tool definitions into the system prompt as XML and parse tool calls from the response

## References

- GitHub: https://github.com/ChrisColeTech/claude-wrapper
- Claude Code docs (subprocess interface): https://code.claude.com/docs/en/changelog
- Open WebUI (consumer of this pattern): https://github.com/open-webui/open-webui
- Related: Atticus (Oct 20 — uses same `claude -p` path for voice input)

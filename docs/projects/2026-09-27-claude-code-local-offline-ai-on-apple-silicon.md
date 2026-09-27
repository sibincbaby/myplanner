# Claude Code Local — Offline AI on Apple Silicon

**Source:** <https://github.com/nicedreamzapp/claude-code-local>
**Discovered:** 2026-09-27
**Viability:** 3/4

> Claude Code is API-first by design: every turn calls Anthropic's servers, and every token costs money. This project proves the bridge exists — an MLX-native server that accepts exactly the routes Claude Code hits and routes them to a local model instead. The build is the minimal version of that bridge: one `uvicorn` entry point, one model-download script, and the two or three routes that cover 95% of Claude Code turns.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 0/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

**Weekend-buildable (0):** The upstream project ships six model "fighters", browser automation, voice mode, and phone control — that is not a weekend scope. A stripped-down version (completions + streaming, one model, no browser/voice) *is* a weekend scope, but the criterion evaluates the project as found, not a reimagined MVP.

**Fills a gap (1):** Two real gaps close simultaneously. First, API cost: a session with heavy subagent use can spend $10–30 of tokens; running against a local 27B model costs electricity. Second, airgap/privacy: code under NDA or in a healthcare context cannot leave the machine; the upstream README calls this out explicitly.

**Novel (1):** Three prior-art searches (`claude code local mlx server`, `claude code offline apple silicon`, `mlx anthropic api compatible server`) returned `ClaudeCode2oMLX` (aagern, 0★), `local-agents` (haiggoh, private config overlay, not a model server), and a few Gist scripts. None shipped a production-grade multi-model server with automated hardware detection and model download. `nicedreamzapp/claude-code-local` occupies the slot.

**Daily utility (1):** Anyone paying Claude API costs or working on private code uses this on every session.

---

## Implementation Plan

### Overview

Claude Code makes exactly three categories of API call: (1) `POST /v1/messages` for the main conversation turn, (2) streaming variants of the same for long outputs, and (3) `GET /v1/models` to populate the model picker. A minimal local bridge only needs to handle these three routes. Everything else (browser control, voice, phone) is layered on top and is out of scope for Phase 1.

The model server is MLX-LM, the standard inference engine for Apple Silicon. It speaks an OpenAI-compatible REST API out of the box (`mlx_lm.server`). The bridge's only job is to translate Claude Code's Anthropic-format requests into OpenAI format, forward them to the local server, and translate the responses back.

### Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | matches upstream; `httpx`, `fastapi`, `uvicorn` are the full import list |
| Inference | `mlx-lm` (`mlx_lm.server`) | first-party Apple Silicon LLM server; ships OpenAI-compatible API at `localhost:8080` |
| Bridge | FastAPI + `httpx` reverse proxy | minimal; route-level translation is 40–60 lines per endpoint |
| Model storage | `~/.claude-local/models/` | mirrors upstream convention; `hf_hub_download` in a one-shot script |
| Config | `~/.claude-local/config.json` (model name, port, RAM tier) | sourced before `mlx_lm.server` launches |
| Claude Code wiring | `ANTHROPIC_BASE_URL=http://localhost:8888` env var | Claude Code respects this; no binary patching |

### MVP Scope

**In:**

1. `bridge.py`: FastAPI app with three routes — `GET /v1/models`, `POST /v1/messages`, `POST /v1/messages` with `"stream": true`. Translates Anthropic request body → OpenAI body, proxies to `mlx_lm.server`, translates response back. Handles `stop_sequences` → `stop`, `system` prompt inlining, and `max_tokens`.
2. `setup.py`: detects RAM (`sysctl hw.memsize`), recommends a model tier (8B for ≤16 GB, 27B for 32 GB, 70B+ for 64 GB+), downloads the chosen GGUF/MLX model via `huggingface_hub`, writes config.
3. `run.sh`: starts `mlx_lm.server` in the background, waits for it to be ready, then starts `bridge.py` on port 8888, and exports `ANTHROPIC_BASE_URL`.
4. One `test_bridge.py` with three tests: model list returns at least one entry, a non-streaming completion round-trips, a streaming completion emits at least one SSE line.

**Out of v1:** tool use translation (Claude Code's tool call format differs from OpenAI's — Phase 3), browser/voice/phone control (upstream's territory), multi-model routing, any UI.

### Phases

**Phase 1 — Non-streaming completions (2 h).** `bridge.py` handles `POST /v1/messages` without streaming. `setup.py` downloads one model. `run.sh` boots the stack. Verify by running a plain Claude Code session (`claude -p "say hello"`) against it.

**Phase 2 — Streaming (1.5 h).** Add the streaming route: translate Anthropic's `text_delta` SSE format to and from OpenAI's `delta.content` format. Verify with `claude` interactive mode — the cursor should stream, not batch.

**Phase 3 — Tool call translation (2 h).** Claude Code uses Anthropic's tool call format (`tool_use` / `tool_result`); `mlx_lm.server` speaks OpenAI's `function_call` / `tool_calls`. Map between them. This unblocks subagent use, Edit/Write/Bash, and everything else that relies on tools. Without Phase 3 the bridge works for chat but not for agentic sessions.

**Phase 4 — Multi-model config (1 h).** Read `model_overrides` from config: map `claude-opus-*` to the big model, `claude-haiku-*` to the small one, everything else to the default. Lets jev-pilot's model routing work locally.

**Phase 5 (optional) — Automated model pull and update (30 min).** Add a `--update` flag to `setup.py` that checks for a newer quantization of the configured model on HF and downloads it. Keeps quality improving without manual intervention.

**Total effort:** 6–7 hours. Phase 1 + 2 alone (3.5 h) give a usable interactive session. Phase 3 (tools) is the gate for real agentic work.

### Blockers and Known Ceilings

- **Tool call fidelity is the hard part.** Claude Code uses `input_schema` JSON Schema for tool definitions; OpenAI uses `parameters`. The mapping is one-to-one in most cases but Claude's `computer_use` tool and multi-block tool results have no OpenAI analogue. Phase 3 will need per-tool special-casing for the harness's built-in tools.
- **Model quality ceiling is real.** Qwen 3.5 122B at 65 tok/s (upstream) is the best available locally. It is noticeably weaker than Claude Opus 5 on multi-step reasoning. Haiku-tier tasks (file edits, search, simple completions) are indistinguishable; deep planning tasks are not.
- **`ANTHROPIC_BASE_URL` must be set before Claude Code launches.** Wiring it into a shell alias or `~/.claude/.env` is a one-time setup step that the README must explain clearly, otherwise users assume the binary is being patched.
- **mlx-lm context window varies by model.** Qwen 3 and Gemma 4 support 128k+ context; older models may cap at 8k. Claude Code sends large context payloads in agentic sessions; the bridge should check `n_ctx` against the payload length and warn before sending.

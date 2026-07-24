# LLMCassette

> pytest plugin that records real Anthropic API responses to JSON cassette files and replays them in tests forever — zero cost, zero flakiness, zero network in CI

**Inspired by:** [autopost/llm-mock](https://github.com/autopost/llm-mock) (HN AI digest 2026-07-14, 2 stars — extremely new)  
**Date discovered:** 2026-07-24

---

## What gap it fills

When you build Claude-powered tools and write pytest tests, every CI run hits the Anthropic API: slow, expensive, and non-deterministic. `llm-mock` exists but has 2 stars and limited documentation; building your own gives full control over the cassette format, model, and matching strategy. LLMCassette is a drop-in pytest plugin (`pip install llmcassette`) that intercepts `anthropic.Anthropic().messages.create()` calls via `httpx` transport replacement, records responses to `.cassette/` JSON files on first run, and replays them on every subsequent run — the same VCR pattern that `vcrpy` popularized for HTTP, applied specifically to the Anthropic SDK including streaming.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Core | Python 3.11 + `anthropic` SDK | Target the SDK's `http_client` transport layer |
| HTTP interception | `httpx.MockTransport` | Anthropic SDK uses httpx internally; replace the transport |
| Storage | `.cassette/<test_name>/<call_index>.json` | One file per API call per test, human-readable |
| Matching | Hash of (model, messages, system, max_tokens) | Deterministic; ignores ephemeral fields |
| Plugin | `pytest` plugin via `conftest.py` auto-fixture | Zero config — just install and it works |
| Streaming | Collect SSE stream → store as message list → replay as iterator | Transparent to test code |

## MVP scope (1 Claude session)

A pytest plugin with one fixture `llm_cassette` that:

1. In **record mode** (`CASSETTE_MODE=record pytest`): passes through to real API, saves each response
2. In **replay mode** (default): returns saved responses without network
3. Supports both `messages.create(stream=False)` and `messages.create(stream=True)`
4. Cassettes stored in `.cassette/` dir at repo root (git-committable, no secrets since API keys aren't stored)

Out of scope for MVP: OpenAI support, auto-heal mode, CLI tool.

## Phases

### Phase 1 — Anthropic SDK transport interception (1 h)
- Subclass `httpx.MockTransport` to intercept all requests made by the Anthropic client
- In record mode: forward to real `httpx.HTTPTransport`, capture `(request, response)` pair
- Serialize request: URL, headers (strip `Authorization`), body JSON
- Serialize response: status code, headers, body bytes
- Save to `.cassette/<hash>.json`

### Phase 2 — Replay mode (45 min)
- On fixture setup: scan `.cassette/` for files matching the test node id
- Build in-memory map: `request_hash → response_bytes`
- Return stored response bytes as `httpx.Response` with correct status + headers
- Raise `CassetteNotFoundError` with a helpful message if a call has no recorded cassette

### Phase 3 — pytest fixture integration (30 min)
- Register an auto-use `session`-scoped fixture that patches `anthropic.Anthropic._client` transport
- `CASSETTE_MODE` env var: `record` (real API), `replay` (default), `passthrough` (disable plugin)
- Per-test cassette directory: `pytest.ini` / `pyproject.toml` config option `cassette_dir`
- Fixture yields, restores original transport on teardown

### Phase 4 — Streaming support (45 min)
- Detect `stream=True` calls (body contains `"stream": true`)
- Record mode: collect the full SSE stream, store event list as a JSON array
- Replay mode: yield stored events one by one from a generator, with original inter-event delays stripped (instant replay)
- Patch `anthropic.Stream` so consuming code sees identical types

### Phase 5 — Auto-heal and CLI (45 min)
- `CASSETTE_MODE=auto` (default in future): use cassette if it exists, record if it doesn't
- `llmcassette list` — show all cassettes with model, token count, cost estimate
- `llmcassette clear [--test <nodeid>]` — delete cassette files
- `llmcassette show <cassette-file>` — pretty-print the recorded conversation

## Effort estimate

~3 hours for Phases 1–3 (record + replay MVP) · 1 Claude session  
~5 hours complete with streaming + auto-heal

## Blockers / risks

- **Anthropic SDK internal changes**: the transport replacement relies on `httpx` being the underlying HTTP layer. Mitigation: pin `anthropic>=0.50` and test on each major SDK release; the plugin's `__init__` warns if it detects an incompatible SDK version.
- **Request matching false positives**: two different calls with the same (model, messages, max_tokens) hash could collide if tests reuse the same prompt. Mitigation: include test node ID in the lookup key so cassettes are test-scoped; log a warning if multiple different responses are recorded for the same hash.
- **API key in test environment**: CI needs a real key only during record runs. Mitigation: document that record runs are done locally and cassettes are committed to the repo; CI always runs in replay mode (`CASSETTE_MODE=replay`) with no API key needed.

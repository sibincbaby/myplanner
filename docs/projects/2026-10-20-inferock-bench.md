# inferock-bench — Per-Call Billing Receipt for LLM APIs

**Source:** Product Hunt — https://www.producthunt.com/p/inferock/inferock-bench  
**Tagline:** "Sit between your app and Anthropic/OpenAI; emit an independent receipt after every API call showing spend, billed-empty outputs, truncations, and token-recount mismatches."  
**Discovered:** 2026-10-20

---

## Why it fits

When building with the Anthropic API, the only cost signal is the provider's monthly invoice — aggregated, no per-call breakdown, no anomaly flags. LLM calls can fail silently in ways that cost money: billed-empty outputs (you're charged but the model returns nothing), truncated responses (billed for output tokens that weren't delivered), and failed retries billed as separate requests.

inferock-bench closes this gap: it runs as a local proxy on `localhost:PORT`, you point your Anthropic SDK at it by changing `baseURL`, and it captures every request/response pair. After each call it emits a JSON receipt with spend, anomaly flags, and a "bill-bounded money-loss" figure. The provider key never leaves the local machine.

Prior art in toolkit: none. LangSmith and Langfuse focus on traces and evals rather than billing anomalies. helicone.ai is a cloud proxy (data leaves your machine). inferock-bench is local-first and anomaly-focused.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Node.js HTTP proxy + request/response capture + JSON output; clear MVP in 1 session |
| fills_gap | 1 | No covered tool detects per-call billing anomalies from Anthropic/OpenAI locally |
| novel | 1 | "Receipt" framing with billed-empty and truncation detection is not replicated by any known OSS tool |
| daily_utility | 1 | Every active LLM development session benefits; catches silent money drains immediately |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **Node.js / TypeScript** — HTTP proxy with `http-proxy-middleware` or a raw `http.createServer`
- **Axios / node-fetch** — forward requests to `api.anthropic.com` or `api.openai.com`
- **SQLite (better-sqlite3)** — store per-call receipts for session summaries
- **Commander.js** — CLI: `inferock-bench --port 20128 --provider anthropic`

No cloud dependency; everything local. Use `npx inferock-bench` for zero-install.

## MVP Scope

1. HTTP proxy: accept OpenAI-compatible or Anthropic-format requests; forward to provider; capture response
2. Token accounting: extract `usage.input_tokens` and `usage.output_tokens` from the response; compute cost using a static provider pricing table
3. Anomaly detection: flag billed-empty (output_tokens > 0, response content empty), truncations (stop_reason = "max_tokens"), and refusals (stop_reason = "stop" + content contains "I can't")
4. Receipt output: print a JSON block to stdout per call: `{timestamp, model, input_tokens, output_tokens, cost_usd, anomalies: []}`
5. Session summary: on `SIGINT` print totals: total_spend, total_calls, anomaly_count

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | `http.createServer` proxy: accept request, read body, forward to provider URL with auth header forwarded; stream response back | 45 min |
| 2 | Response buffering: collect full response body; parse JSON; extract `usage` block | 20 min |
| 3 | Pricing table: hardcode Anthropic + OpenAI current per-token costs; compute `cost_usd` | 20 min |
| 4 | Anomaly detection: implement 3 checks (billed-empty, truncation, refusal); attach to receipt | 30 min |
| 5 | SQLite persistence: store each receipt row; add `--report` command to print session summary table | 30 min |

**Total estimate:** ~2.5 h (1 Claude session)

## Blockers

- **Streaming responses**: Anthropic and OpenAI both support `stream: true`; the proxy must buffer SSE chunks and assemble them before computing usage — streaming receipts come after the stream ends
- **Pricing drift**: token costs change without notice; the pricing table must be easy to update; consider fetching from a community-maintained JSON at startup
- **FSL license**: the current repo uses FSL-1.1-Apache-2.0 (converts to Apache-2.0 in 2 years); building your own under MIT avoids that constraint entirely
- **HTTPS passthrough**: if your SDK enforces HTTPS, the local proxy needs a self-signed cert for `localhost` — generate with `mkcert localhost` before first run

## References

- Product Hunt: https://www.producthunt.com/p/inferock/inferock-bench
- EveryDev listing: https://www.everydev.ai/tools/inferock-bench
- Launch coverage: https://aitoolly.com/ai-news/article/2026-10-15-inferock-launches-on-product-hunt-delivering-transparent-receipts-and-cost-protection-for-llm-api-in

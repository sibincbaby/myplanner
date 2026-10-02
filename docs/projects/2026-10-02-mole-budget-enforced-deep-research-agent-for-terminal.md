# Mole – Budget-Enforced Deep Research Agent for the Terminal

**Source:** <https://github.com/lajosdeme/mole>
**Discovered:** 2026-10-02
**Viability:** 3/4

> Fills a real gap between "paste a question into Claude" and a structured research pipeline. Budget enforcement with per-call token reservation is the standout design — every call is reserved before it runs and settled after, so the ceiling you set is the ceiling it hits. The claim-verification layer (checks each extracted claim against the text it came from) directly addresses the hallucination problem for research tasks. MCP toolkit mode means a coding agent can hand Mole a question and collect a cited answer, which slots naturally into an existing Claude Code workflow.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 0/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

The claim-verification pipeline is not a one-session build: decomposing a question, parallelising searches, extracting claims per source, cross-checking for contradictions, and writing a citation graph takes real engineering across multiple components. But the concept is importable: a user who wants verified, budgeted research today should install Mole rather than rebuild it. The plan below describes building a compatible subset — an MVP that implements the budget and citation layer — rather than a full clone.

---

## Implementation Plan

**2 Claude Code sessions** to a usable local research agent with budget guard and citation output.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | asyncio-native, rich ecosystem |
| LLM | Anthropic SDK (`claude-haiku-4-5`) | Fast, cheap per query; swap to Sonnet for synthesis |
| Web search | `duckduckgo-search` (async) | No API key, privacy-respecting |
| HTTP fetch | `httpx` (async) | Concurrent source fetching |
| HTML → text | `trafilatura` | Better than BeautifulSoup for body extraction |
| Budget tracking | In-process `TokenLedger` class | Reserves before call, settles after |
| Local data | DuckDB via `duckdb` | Analyses CSV/JSON in-process, no SQL server needed |
| CLI | Typer + Rich | Streaming progress indicators |
| MCP server | `fastmcp` | Single decorator, stdio transport |

---

## MVP Scope

A research question enters as CLI input. Mole decomposes it into 3-5 sub-queries, fetches and extracts text from the top 3 results per query, uses the LLM to extract factual claims from each source, checks each claim against the source text it came from (returns a `verified` flag), assembles a synthesis with inline citations, and stops when the token budget is exhausted. Output: a Markdown report with a Sources section and a claim-verification table.

Out of scope for MVP: contradiction detection across sources, local CSV/JSON analysis, MCP server mode, interactive TUI.

---

## Implementation Phases

### Phase 1: Research Pipeline Core
**Goal:** CLI that takes a question, searches the web, fetches sources, extracts claims, and writes a cited Markdown report.

**Files:**
- `pyproject.toml` — deps: anthropic, httpx, duckduckgo-search, trafilatura, typer, rich
- `src/mole/cli.py` — Typer app, `research` command
- `src/mole/decompose.py` — `decompose_question(q)` → list of sub-queries via LLM
- `src/mole/search.py` — `search(query, n=3)` → list of `{title, url, snippet}`
- `src/mole/fetch.py` — `fetch_text(url)` → extracted body text via trafilatura + httpx
- `src/mole/claims.py` — `extract_claims(source_text)` → list of `{claim, quote}` via LLM
- `src/mole/verify.py` — `verify_claim(claim, quote, source_text)` → `verified: bool` via exact-match + LLM
- `src/mole/synthesise.py` — `synthesise(question, verified_claims)` → Markdown report
- `prompts/` — separate .txt files for each LLM step

**Key steps:**
1. Implement `decompose_question`: single LLM call returning JSON `["sub-query 1", ...]`.
2. Run `duckduckgo_search.DDGS().text(query, max_results=3)` for each sub-query; deduplicate URLs.
3. Async-fetch all URLs concurrently with `asyncio.gather`; skip URLs where `trafilatura.extract` returns None.
4. For each source, call `extract_claims` with a prompt that requests JSON: `[{"claim": "...", "quote": "exact sentence from text that supports this"}]`.
5. In `verify_claim`, first try simple substring match of the quote in the source text (fast path). On miss, ask LLM: "Does this source text support this claim? Reply JSON `{verified: true/false, reason}`."
6. In `synthesise`, pass the list of `{claim, verified, source_url}` to the LLM with instruction to only use verified claims in the narrative; include a Sources section and a "Claim Verification" table.
7. Stream the synthesis to stdout with Rich's live progress bar showing claims checked / total.

**Verify:** `mole research "what are the main criticisms of RAG pipelines in 2026?"` → prints a Markdown report with citations and a claim table showing verified/unverified flags.

---

### Phase 2: Budget Guard
**Goal:** Every LLM call is reserved against a budget before it runs; if the budget is exhausted, the pipeline terminates gracefully with whatever it has.

**Files:**
- `src/mole/budget.py` — `TokenLedger` class: `reserve(estimated_tokens)`, `settle(actual_tokens)`, `remaining`, `exceeded` property
- All LLM call sites updated to call `ledger.reserve` before and `ledger.settle` after
- `src/mole/cli.py` — adds `--budget TOKENS` flag (default 50_000 input tokens)

**Key steps:**
1. `TokenLedger.__init__(self, max_tokens)`: stores `max_tokens`, `reserved = 0`, `used = 0`.
2. `reserve(n)`: if `reserved + n > max_tokens`, raise `BudgetExceeded`. Else `reserved += n`.
3. `settle(actual)`: `reserved -= estimated` (from the matching reserve call), `used += actual`.
4. Wrap every `client.messages.create` call in a `try/except BudgetExceeded` that prints a Rich warning and returns the partial result.
5. Estimate token cost before each call using `len(prompt.split()) * 1.3` as a fast proxy (overestimate intentionally). Settle with `response.usage.input_tokens + response.usage.output_tokens` from the API response.
6. At the end of the run, print a budget summary: reserved / used / remaining.

**Verify:** `mole research "..." --budget 5000` terminates mid-pipeline and prints a partial report with a "Budget exhausted" notice and a budget summary line.

---

### Phase 3: Local Data + MCP Server
**Goal:** Local CSV/JSON/JSONL files can be queried as part of the research context; the tool is MCP-accessible so a coding agent can drive it.

**Files:**
- `src/mole/local_data.py` — `analyse_local(path, question)`: loads file into DuckDB in-memory, asks LLM for a SQL query, runs it, returns result table
- `src/mole/mcp_server.py` — `fastmcp` server exposing `research(question, budget)` and `analyse(path, question)` tools
- `src/mole/cli.py` — adds `mole serve` command that starts the MCP stdio server

**Key steps:**
1. `analyse_local`: detect extension (`.csv`, `.json`, `.jsonl`), load into DuckDB with `CREATE TABLE t AS SELECT * FROM read_csv_auto(?)` or the JSON reader. Ask LLM for a DuckDB SQL query that answers the question. Run with `con.execute(sql).fetchdf()`. Return a markdown table of the first 20 rows.
2. Implement `mcp_server.py` with `@mcp.tool() async def research(question: str, budget: int = 50000)` that calls the full pipeline and returns the Markdown report string.
3. Add `@mcp.tool() async def analyse(path: str, question: str)` that calls `analyse_local`.
4. `mole serve` launches with `mcp.run()` on stdio.

**Verify:** Add `mole` to Claude Code's MCP config; ask Claude Code "use mole to research X" → it calls the MCP tool and displays the report inline.

---

### Phase 4: Contradiction Detection + Polish
**Goal:** Claims extracted from different sources are cross-checked for direct contradictions; the synthesis flags them.

**Files:**
- `src/mole/contradict.py` — `find_contradictions(claims)` → list of `{claim_a, claim_b, explanation}`
- `src/mole/synthesise.py` — updated to include a "Contradictions" section when any are found
- `tests/` — pytest tests for budget guard, claim verification logic

**Key steps:**
1. Group verified claims by topic (ask LLM to assign a `topic_tag` to each claim during extraction). For each topic with ≥ 2 claims, run a contradiction check: send the claim pair to the LLM and ask if they conflict.
2. Budget the contradiction checks tightly (skip if budget < 5 000 remaining).
3. In the synthesis prompt, include the contradiction list in a separate section with source attribution.
4. Write tests using `unittest.mock.patch` to mock the Anthropic client; test budget overflow, empty search results, non-extractable URLs.

**Verify:** Research a question with known conflicting sources (e.g., "is X faster than Y?"); the output shows a Contradictions section. `pytest tests/` passes.

---

## Estimated Effort

**2 Claude Code sessions** (1 session ≈ 3–4 hours of Claude work).

- **Session 1** — Phases 1 + 2: pipeline scaffold, web search, async fetch, claim extraction + verification prompts, synthesis, budget guard. The prompt-engineering for reliable claim extraction is the hard part.
- **Session 2** — Phases 3 + 4: local data via DuckDB, MCP server, contradiction detection, tests. Most time on the MCP wiring and getting DuckDB schema injection into SQL prompts right.

---

## Potential Blockers

1. **DuckDuckGo rate limiting** — The library uses a scraping approach; aggressive parallel queries hit rate limits. Mitigate: cap concurrent search calls to 2 at a time with a semaphore.
2. **trafilatura extraction quality** — Dynamic JS-heavy pages return empty text. Fall back to `httpx` + `html2text` for pages where trafilatura returns None.
3. **Quote substring mismatch** — LLM sometimes paraphrases quotes slightly, causing the fast-path verification to miss. The LLM fallback path handles this, but doubles the token cost for those claims. Set a tight character-match threshold (≥ 0.85 token overlap) before falling back.
4. **Synthesis prompt length** — A research question with 15 sub-queries × 3 sources × 5 claims each = 225 claim objects going into the synthesis prompt. Cap at 50 highest-confidence claims and truncate source text to 300 chars per quote to stay under context limits.

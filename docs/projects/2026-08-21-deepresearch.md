# deepresearch — Claude-Native Deep Research Skill with Local RAG + 3-Way Verification

**Source:** [24601/agent-deep-research](https://github.com/24601/agent-deep-research) · GitHub (new, Aug 2026) · Python, universal agent skill
**Date discovered:** 2026-08-21

## What it is

`agent-deep-research` is a deep research CLI + agent skill built around the Gemini Interactions API. It provides automatic RAG grounding from local files, cost estimation (`--dry-run`), adaptive polling, structured output, and works as a universal skill across Claude Code, Amp, Codex, Gemini CLI, Cline, and 30+ other agents. No Gemini CLI dependency required — it calls the API directly.

The approach: a research query fans out into parallel web searches, grounds results against local file context (RAG), runs a 3-way triangulation pass to verify claims, and returns a structured report with cited passages.

The gap it fills for Claude Code specifically: Claude Code's built-in web search is single-threaded and citation-light. `agent-deep-research` adds parallel multi-source search, local file grounding, and source verification — the same pattern `oh-rid/deep-research` used for code review (3 parallel search backends, primary-source verification).

## Why it fits

- Core interest: **Claude/LLM tooling** — universal skill compatible with Claude Code as primary
- Core interest: **dev productivity** — deep research with verified citations is useful every time you need to evaluate a library, understand an API, or investigate a bug with limited context
- `novel = 1`: the combination of local RAG + parallel multi-source web search + 3-way verification as a single agent skill is not in any prior plan; `agent-deep-research` (24601) is the first project to surface this pattern as a universal cross-agent skill

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | The Claude-native version removes the Gemini dependency; Claude's WebSearch tool + file reader + a 3-pass verification loop is one session |
| fills_gap | 1 | No prior plan addresses multi-source parallel research with local file grounding as a Claude Code skill |
| novel | 1 | Local RAG + 3-way verification + universal skill pattern is genuinely new in the plans directory |
| daily_utility | 1 | Every tech evaluation, API investigation, or "what does this error mean and is there a fix" question benefits |
| **Total** | **4/4** | **VIABLE** |

**Note:** The plan below is a Claude-native adaptation that removes the Gemini dependency. If you prefer Gemini for its grounded citations, use `agent-deep-research` directly — it is production-ready. The plan exists for the Claude-only case where you want a single API key and a skill that works offline against local files.

## Stack Recommendation

```
Language:   Python 3.11+ with uv
Web search: Claude's built-in WebSearch tool (when available) OR local WebSearch MCP
Local RAG:  Simple TF-IDF over local files (sklearn, zero ML server needed)
            Optional upgrade: sentence-transformers embeddings (same as claude-journal Phase 4)
Skill:      .claude/skills/deepresearch/SKILL.md — Claude orchestrates the phases
Output:     Markdown report with cited passages, confidence level per claim
CLI:        deepresearch <query> [--files glob] [--depth 1|2|3] [--dry-run]
```

No external services beyond Claude API. Local RAG runs on files you point it at (`--files "src/**/*.py"`, `--files "docs/*.md"`).

## MVP Scope (1-2 Claude sessions)

One skill, three phases, one output:

1. **Fan-out:** decompose the query into 3-5 sub-questions; run each as a parallel web search
2. **Ground:** for each result, check against local files matching `--files`; annotate with local context if found
3. **Verify:** for each top claim, run a separate search that tries to refute or confirm; mark as `confirmed / plausible / disputed`
4. **Report:** emit a structured markdown report with: summary, claims table (confirmed/plausible/disputed), sources, local file references

The skill prompt defines these four phases. Claude orchestrates them using the Agent tool (sub-agents for parallel search) and returns the finished report.

## Phases

### Phase 1: Query Decomposition + Parallel Search (1.5h)
- SKILL.md: prompt Claude to decompose a research question into 3-5 sub-questions
- Run each sub-question as a parallel web search (Agent or parallel tool calls)
- Collect: title, URL, excerpt, date for each result
- Deduplicate by URL
- Verify: a query about "Claude Code MCP server security in 2026" returns 10+ unique sources across 3 sub-questions

### Phase 2: Local File RAG (1h)
- Python script: index local files matching a glob pattern as TF-IDF vectors
- For each search result excerpt, find the top-3 local file matches by cosine similarity
- Annotate each result with local context: `local_match: path:line_number — excerpt`
- Cache the TF-IDF index in `.deepresearch_cache/` for fast re-runs on the same file set
- Verify: search for a function name in web results — the local RAG finds the corresponding source file

### Phase 3: 3-Way Verification (1h)
- For each top-5 claim in the search results, run one additional agent with prompt: "Try to refute this claim: <claim>. Find contradicting evidence. If you cannot refute it, say plausible."
- Claims with 0 refutations → `confirmed`; 1 attempted refutation but no evidence → `plausible`; evidence found → `disputed`
- Include the refutation attempt's source in the report
- Verify: a claim known to be false is marked `disputed` with the refuting source

### Phase 4: Structured Report Output (0.5h)
- Output format: `report.md` with sections: Summary, Claims (table), Sources (with snippets), Local Context, Confidence Legend
- `--depth 1`: fan-out only (quick); `--depth 2`: + local RAG; `--depth 3`: + 3-way verification
- `--dry-run`: prints estimated token cost and source count without running searches
- Verify: `--depth 3` on a 5-sub-question query produces a report with a claims table where every claim has a confidence level

### Phase 5: Claude Code Skill Integration (0.5h)
- `.claude/skills/deepresearch/SKILL.md` — trigger words: "research", "investigate", "find sources for", "what does the latest say about"
- On trigger: ask for query and optional `--files` glob; run phases 1-4; present report inline
- Add to Claude Code's skills list and verify it fires on "research this topic" prompts
- Optional: `--to-file report-<date>.md` for persistent research archives

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Query decomposition + parallel search | 1.5h |
| Local file RAG | 1h |
| 3-way verification | 1h |
| Structured report output | 0.5h |
| Claude Code skill integration | 0.5h |
| **Total** | **4.5h (one day)** |

## Blockers / Risks

- **WebSearch availability.** Claude Code's built-in WebSearch tool is the cleanest path. If it is unavailable (offline, plan restriction), fallback to a local WebSearch MCP server. The `--depth 1` mode without web search is still useful for RAG-only queries against local files.
- **Token cost for 3-way verification.** A depth-3 run on 5 sub-questions with 10 sources each and 5 top claims = ~25 agent calls. At Haiku pricing this is affordable; at Opus 5 it is not. Default depth to `2` and make `--depth 3` explicit. Always show estimated cost via `--dry-run` before a full run.
- **TF-IDF vs. embeddings.** TF-IDF misses semantic matches ("spending limit" vs. "budget cap"). The Phase 4 upgrade path (sentence-transformers) fixes this but adds ~90MB dependency. Accept the TF-IDF limitation in Phase 2; upgrade to embeddings only if local RAG results are consistently missing relevant context.
- **Refutation quality.** The 3-way verification pass is only as good as the refuting agent's ability to find contradicting evidence. For niche or novel topics, the refuter may simply fail to find anything, making every claim `plausible`. Add an explicit note in the report: `plausible (no contradiction found, not confirmed)` to distinguish absence-of-evidence from evidence-of-correctness.
- **24601/agent-deep-research may already solve this.** If you have a Gemini account, the source repo is production-ready and battle-tested across 30+ agents. Build the Claude-native version only if you want to keep everything on one API or need offline-first local RAG.

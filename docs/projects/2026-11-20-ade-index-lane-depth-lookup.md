# ADE Index → lane-depth lookup for the discovery pipeline

**Source:** <https://adeindex.com> (Show HN, 2026-11-19: "a sourced and ranked index of 975 agentic coding tools")
**Discovered:** 2026-11-20
**Viability:** 3/4

> Most `novel=0` verdicts in this pipeline come from one question: how deep is this lane already? Today the answer takes two or three rounds of rephrased `gh api search/repositories` calls, and a too-narrow phrasing silently returns 0 and reads as a gap. ADE Index already tags about 1,000 agent dev tools by category and capability, with GitHub stars, on server-rendered pages. A ~200-line script can ask it and GitHub together and print one lane-depth line the digest can quote.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

- **weekend_buildable=1:** one stdlib Python script, a cache folder and one extra line in the discovery prompt.
- **fills_gap=1:** the broaden-the-query rule in the run notes has flipped an apparent `novel=1` at least five times (09-03, 09-04, 09-06, 09-07, 09-17, 10-31). Each time the first one or two phrasings returned `total_count=0`. ADE Index's capability pages don't depend on phrasing: `directory?cap=worktree-isolation` returned 97 tools in one request.
- **novel=1:** nothing found that does this. `TMFPink/find-tools` (11-18) and `kvadou/prior-art` (09-17) are generic "research before you build" skills that use web search. Neither gives a count or a curated index.
- **daily_utility=0:** the cron uses it every night, but the user never calls it, and it only helps on candidates that are agent dev tools (roughly half of each day's table). Finance, Flutter and voice lanes aren't in ADE Index.

**Shape:** build a small script. Don't mirror ADE Index; query it live with a polite cache.

---

## Implementation Plan

### Overview

`python3 scripts/lane_depth.py "<one-line thesis>" [--cap <capability>] [--json]` prints:

```
lane-depth "run many claude code sessions in worktrees": gh=412 (phrase) / 1,903 (broadest) · ade=97 (cap:worktree-isolation) · top: herdr 51.6k★, claude-control …, agenthub …
```

The discovery run calls it once per shortlisted candidate before scoring `novel`, and quotes the line in Scoring Notes.

### What was verified on 2026-11-20

| Endpoint | Result |
|----------|--------|
| `robots.txt` | `Allow: /`, disallows `/api/`, `/admin`, `/account`, `/catalog-static/`, `/lb/`. Use only sitemaps, `/directory`, `/tools/*` and `/alternatives/*`. |
| `sitemaps/tools.xml` | 1,000 `<loc>` entries, `https://adeindex.com/tools/<slug>` |
| `sitemaps/alternatives.xml` | 267 entries, `https://adeindex.com/alternatives/<slug>` (`/alternatives/claude-code` links 10 tools) |
| `sitemaps/directory.xml` | category pages (`cat=agent-orchestrator`, `cli-agent`, `ide-extension`, `agent-addon`, …), form pages (`form=terminal-tui`, `remote-mobile`, …) and capability pages (`cap=parallel-agents`, `worktree-isolation`, `task-board`, `multi-agent-orchestration`, `review-diff`, `remote-access`, `team-collaboration`, `multi-provider`) |
| `directory?cat=all&q=<term>` | server-rendered; tool links are `href="/tools/<slug>"`. `worktree` → 49, `usage` → 4, `voice` → 2, `session viewer` → 1. Free-text search is weak, so treat it as a hint, not a count. |
| `/tools/herdr` | 455 KB HTML. JSON-LD `SoftwareApplication` (name, description, license URL, publisher, offers). Visible text has "GitHub stars 51.6k", category, rank, and "4 of 8 capabilities Parallel agents Worktree isolation …". |
| `atrium` | shows up in every free-text query: probably a sponsored slot. Drop it unless it is the only hit. |

### Stack

- Python 3 stdlib only (`urllib.request`, `json`, `re`, `html`, `xml.etree`, `argparse`, `pathlib`, `subprocess`, `time`).
- `gh api` for the GitHub leg. It's authenticated here and avoids the 10/min unauthenticated search limit noted in the run log.
- Cache: `~/.cache/myplanner/ade/` (sitemaps 24 h, tool pages 7 days, directory pages 24 h). **Not in the repo**, which is public and deployed.
- User-Agent: `myplanner-lane-depth/0.1`. Never put the account email in it.

### MVP Scope

In:
1. GitHub leg: `total_count` for the full phrase, then for each 2-word and 1-word subset of the thesis's content words (stopwords removed), with `sleep 2` between calls. Report the phrase count and the broadest count. This writes the broaden-the-query rule into code.
2. ADE leg: free-text `q=` for the 2 or 3 strongest terms, plus `--cap` / `--cat` pages when given. A small keyword → capability map picks a cap automatically (`worktree`→`worktree-isolation`, `phone|mobile|remote`→`remote-access`, `parallel|many sessions`→`parallel-agents`, `review|diff`→`review-diff`, `kanban|board|task`→`task-board`).
3. For the top 5 ADE slugs: fetch the tool page (cached), then pull name, category, GitHub stars and capabilities from JSON-LD plus the visible text.
4. Output: one summary line (default) or `--json` with every count and slug.
5. Exit 0 always. Network errors print `ade=ERR` or `gh=ERR` instead of `0`, so an error never reads as an empty lane.

Out: mirroring all 1,000 tool pages, scores and rankings, any `/api/` use, and voting or submitting.

### Implementation Phases

#### Phase 0: Terms check (10 min)
1. Read `https://adeindex.com/terms` (or the footer's legal link) for anything against automated reads. Stop here if it forbids them.
2. Fetch `/tools/claude-code` and `/tools/herdr`. Write down the exact text patterns for stars ("GitHub stars 51.6k"), category and the capability list. These are the parser contract for Phase 2.

#### Phase 1: GitHub leg with built-in broadening
**Files:** `scripts/lane_depth.py`
1. `content_words(thesis)`: lowercase, strip stopwords and generic filler (`ai`, `tool`, `app`, `agent` unless it's the only word), keep at most 5.
2. Queries: full phrase → each pair → each single word. Run `gh api -X GET search/repositories -f q="<q>" -f per_page=5 --jq '.total_count,[.items[]|.full_name+" "+(.stargazers_count|tostring)]'`.
3. Treat a `{"message": "API rate limit exceeded"}` reply as `ERR`, never as 0.
4. Run a control query once per run (`notes` → thousands). If it returns 0, mark the whole GitHub leg `ERR`.

**Done when:** `lane_depth.py "claude code session history viewer"` shows phrase≈0–3 and broadest in the hundreds, which is the 09-04 case.

#### Phase 2: ADE leg
1. `sitemap_slugs()`: cache `tools.xml` and build a slug set. A candidate whose repo name matches a slug gets `ade=listed` (the tool itself is already indexed).
2. `ade_search(term)` and `ade_cap(cap)`: fetch the page and dedupe `href="/tools/<slug>"` links. Drop `atrium` when there are other hits.
3. `ade_tool(slug)`: cached fetch. Read JSON-LD `SoftwareApplication` for name and license, then regex the visible text for `GitHub stars ([\d.]+k?)` and the capability list.
4. At most 1 request per second. On a cache hit, make no request.

**Done when:** `lane_depth.py "run many coding agent sessions in parallel" --cap parallel-agents` lists herdr with its stars, and a second run makes 0 network calls to adeindex.com.

#### Phase 3: Wire into the discovery run
1. `run-discovery.sh` prompt, Step 3: add "Before scoring `novel`, run `python3 scripts/lane_depth.py '<one-line thesis>'` for each candidate and quote its summary line in Scoring Notes. `ERR` means unknown, not 0."
2. Make the same one-line change in the `ai-discovery` skill/workflow prompt, so manual and cron runs match.
3. Test on 3 rows from past digests with a known verdict: `bough` (09-04, worklog lane), `holdfast` (09-04, PTY MCP lane), `work3` (today, worktree lane). Each should print a non-trivial depth on the first call.

#### Phase 4 (optional): Remember lane depth
- Append each run's summary lines to `~/.cache/myplanner/lane-depth.log`, outside the repo. After a month, grep it before searching a lane again. That replaces the "cite this instead of re-searching" notes in the run log with data.

### Effort Estimate

About one Claude session: Phase 0 10 min, Phase 1 45 min, Phase 2 1 h, Phase 3 30 min.

### Blockers / Risks

- **ADE Index is new and built on Next.js.** Markup can change at any time. Parse JSON-LD first and visible text second, and on a parse failure fall back to the slug count.
- **It covers agent dev tools only** (about 1,000 tools). For finance, Flutter, voice or journaling candidates the ADE leg returns ~0, which is expected. Print `ade=n/a (lane not indexed)` when the thesis has no agent/coding words, so an empty result isn't read as a gap.
- **Free-text search undercounts.** `session viewer` returned 1 hit for a lane that is 8+ repos deep. Capability pages and the GitHub leg carry the count; free-text only adds names.
- **Sponsored listings.** `atrium` appears in every query. Keep a small `SPONSORED = {"atrium"}` set and check it again in Phase 0.
- **Don't spread the load.** Cache aggressively, stay at 1 req/s, and never touch `/api/` (disallowed in robots.txt).

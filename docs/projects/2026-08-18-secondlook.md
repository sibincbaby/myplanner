# secondlook — Watch the Backlog, Because the Backlog Is Racing You

**Source:** [kerem-kaynak/mtok](https://github.com/kerem-kaynak/mtok) · created 2026-08-17, 5★, Go, MIT — shipped yesterday's 4/4 project while it sat unbuilt
**Corroborating today:** [Thomas-E-Lewis/agentleaks](https://github.com/Thomas-E-Lewis/agentleaks) · [bawadou/ai-data-extractor](https://github.com/bawadou/ai-data-extractor) (95★, 38 forks in a day) · this repo's own `state/seen.json`
**Language:** Python 3 stdlib + `gh api` via `subprocess` — no token handling, no dependencies
**License:** original
**Date discovered:** 2026-08-18

## What it is

`state/seen.json` has **454 entries**, of which **382 are pollable GitHub repository URLs**. `docs/projects/` has **125 written implementation plans**. `docs/daily/` has **46 digests**.

Not one of those 454 URLs has ever been read a second time. `seen.json` is used for exactly one thing — an `if url in seen: skip` on the way in — and then never again.

That is a 382-row watchlist that nothing watches.

secondlook re-polls it. One `gh api repos/{owner}/{repo}` call per entry, diffed against last night's snapshot, and it reports three things:

1. **Breakouts** — a repo screened at 0★ and dismissed that is now at 200★. The screen was wrong, and nothing on this box would ever say so.
2. **Deaths** — 404, archived, or six weeks without a push. Half of what gets tabled here is a two-day-old skeleton; most of them die, and knowing *which* is what calibrates tomorrow's `novel` score.
3. **Collisions** — a repo created *after* a project plan was written, whose description overlaps that plan's thesis. Somebody built your idea.

Item 3 is the whole reason this exists. The other two are a nice-to-have star tracker of the kind that already exists a dozen times over.

## Why it matters here

This happened today, and it is not hypothetical.

On 2026-08-17 this pipeline scored **[yield](2026-08-17-yield.md) at 4/4** — read the `usage` blocks in `~/.claude/projects/*.jsonl`, turn them into cost and token numbers, survive the retention cliff. The digest named five prior token-watchers, argued past all of them, and shipped a four-phase plan.

`kerem-kaynak/mtok` was **created on 2026-08-17**. It is a Go TUI that reads the same JSONL, and its README already handles the two traps yield's plan did not mention:

> Streaming writes the *same* API response several times with growing `output_tokens`, resumed sessions copy history into new files, and subagent transcripts repeat parent turns — so rows are deduplicated globally by `message.id` + `requestId`, keeping the copy with the **largest** usage.

> **Retention.** Claude Code deletes transcripts after `cleanupPeriodDays` (default 30) … Once mtok has scanned a file, its rows are carried forward in the parse cache even after the file is deleted, so numbers never move backwards between scans.

Yesterday's plan was preempted inside twenty-four hours. It was found today **by accident** — the same GitHub query happened to surface it. Nothing in this pipeline would have caught it, and if the weekend had been spent building yield, the discovery would have come afterwards.

The same thing nearly happened twice more this morning. A retention/compaction tool was scored 4/4 in draft and died on one paragraph of mtok's README. A leaked-secret scanner was scored 4/4 against **verified local evidence** — 19 distinct secret-shaped strings across 1.78 GB of transcripts, including two AWS access-key IDs and an Anthropic key — and died because `agentleaks` shipped it on 2026-08-17, in Rust, on crates.io.

**Three of today's four candidate projects were preempted by repos created in the same 48-hour window.** The one that survived is the one that watches for exactly that.

| | |
|---|---|
| Entries in `seen.json` | **454** (382 pollable GitHub repos, 72 other URLs) |
| Times any of them has been re-read | **0** |
| Project plans written | **125** |
| Plans checked against later repos | **0** |
| Days of history | 47 (2026-07-01 → today) |
| Rows with a corrupt `date_seen` | **9** (`"no-date-provided"`) |

## Why it fits

- Core interest: **dev productivity** — it runs unattended inside a job that already runs
- Core interest: **Claude/LLM tooling** — the artefact it guards is a directory of Claude-executable plans
- `fills_gap = 1`: 382 rows, never re-read; a documented collision on the very day it was proposed
- `novel = 1`: star-diffing is commodity; matching a repo created after your plan against that plan's thesis is not, and no tool screened in 47 days does it
- `daily_utility = 1`: one more step in the 01:00 cron, output folded into the digest that already gets read every morning

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | ~80 lines of stdlib Python over `gh api`. Phase 1 alone is an hour |
| fills_gap | 1 | A 382-row watchlist nothing watches, and a preemption that landed today |
| novel | 1 | The collision half. Stated honestly: the star half is not novel and is half the code |
| daily_utility | 1 | Runs at 01:00 with the job that writes `seen.json` in the first place |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Poll:      subprocess -> `gh api repos/{owner}/{repo}`   (reuses gh's keyring auth: 5000/hr)
State:     state/watch.json — {url: {stars, pushed_at, archived, description, checked}}
Diff:      plain dict comparison against last night's snapshot
Collide:   token overlap between a plan's one-liner and repo descriptions
           from `gh api search/repositories?q=<keywords>+created:><plan_date>`
Output:    a "## Backlog Watch" section appended to today's digest, omitted when empty
Wiring:    one step in run-discovery.sh, before the agent writes the digest
```

Shelling out to `gh` instead of holding a token is the entire auth design. `gh` is already logged in on this box with two accounts in the keyring; the tool never sees a credential, and unauthenticated polling is not an option anyway — 382 calls against a 60/hour limit takes seven hours.

**Skipped: a database, embeddings for the collision match, a web UI, webhooks, a scheduler of its own. Add embeddings when token overlap has demonstrably missed a real collision — not before.**

## MVP Scope (1-2 Claude sessions)

1. Read `seen.json`, keep the 382 entries matching `github.com/{owner}/{repo}` exactly
2. Poll each with `gh api`, tolerating 404 and 301 — both are signals, not errors
3. Write `state/watch.json`; on the first run there is no diff, and that is fine
4. Diff: stars gained, `pushed_at` gone stale, `archived` flipped, repo vanished
5. Collision pass over `docs/projects/*.md` — for each plan, search repos created after its date and score description overlap
6. Emit markdown; emit nothing at all when nothing moved

## Phases

### Phase 1: Poll and Snapshot (1h)
- Parse `seen.json` with a strict `^https://github\.com/[^/]+/[^/]+/?$` match; everything else is skipped and counted, not guessed at
- `gh api repos/{o}/{r} --jq '{stargazers_count,pushed_at,archived,description}'`, one at a time, failures captured per-URL
- **A 404 is data.** Record `{"gone": true}` rather than dropping the row — a repo that disappeared is the strongest death signal there is
- Tolerate the 9 rows whose `date_seen` is the string `"no-date-provided"`; any date arithmetic must not crash on them
- Verify: `state/watch.json` has 382 entries, the run takes under five minutes, and the count of `gone` entries is printed

### Phase 2: The Diff (1h)
- Compare to the previous snapshot; report only rows that moved
- Thresholds, not raw deltas: a repo going 0★ → 3★ is noise, 0★ → 50★ is the screen being wrong. Start at **+25★ or a 10× multiple**, and tune once a week of real data exists
- Stale = no push in 42 days. Dead = 404 or `archived`
- Print counts even when the report is empty, so a silently-broken poll is visible
- Verify: run twice ten minutes apart and confirm the second run reports nothing

### Phase 3: The Collision Detector (1.5h)
- For each `docs/projects/*.md`, take the H1 line — every plan already has the shape `# name — one-line thesis` — and the date from the filename
- Query `gh api "search/repositories?q=<3-5 keywords>+created:><plan_date>"`, sorted by stars, top 20
- Score by token overlap against the repo description, after stripping a stop-list. **Dumb on purpose**: no model in this loop, because a model deciding whether a repo is "basically your idea" is exactly the unverifiable judgement this pipeline keeps getting wrong
- Report the top 5 above a threshold, as *candidates for a human read*, never as a verdict
- **Hard acceptance test: run it against `docs/projects/2026-08-17-yield.md` and it must surface `kerem-kaynak/mtok`.** If it does not, the matcher is wrong, and that is worth knowing in hour three rather than in six weeks
- Verify: the yield → mtok collision is found, and the false-positive rate across all 125 plans is small enough to read in a minute

### Phase 4: Wire It Into the Night (0.5h)
- Run it in `run-discovery.sh` *before* `claude -p`, writing `state/backlog-watch.md`
- The prompt gains one line: read that file and fold it into the digest under `## Backlog Watch`
- Order matters — the poll must happen before the agent writes, or its findings land a day late
- Verify: tonight's digest contains a Backlog Watch section, or contains none because nothing moved, and `discovery.log` says which

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Poll and snapshot | 1h |
| Diff and thresholds | 1h |
| Collision detector | 1.5h |
| Wiring | 0.5h |
| **Core total** | **4h (an evening)** |

Phase 3 carries the value and has a pass/fail it cannot argue with: find mtok from yield's own plan text.

## Blockers / Risks

- **`gh` is authenticated to two accounts on this box** — `sibinc` (work, active) and `sibincbaby` (personal, which owns this repo). Every call here is a read of a public repo, so the active account does not affect correctness, but it does affect the rate-limit bucket. Do not add token handling to fix a problem that does not exist.
- **382 calls a night, forever, and the list only grows.** At ~15 new URLs a day the list passes 1,000 inside six weeks and the poll starts taking fifteen minutes. Cap it before that: poll everything under 60 days old every night, everything older weekly. Do not build the cap on day one; do write down the number at which it is needed.
- **Star counts are a weak signal and yesterday's digest already said so** — a high star count mostly means the repo is older than it looks. Breakout detection will produce some noise permanently. That is acceptable for a report a human reads over coffee; it would not be acceptable for anything automated, which is why nothing here is automated.
- **The collision detector will have false positives, and that is the correct failure direction.** Five candidates to skim beats one missed preemption. The moment someone tries to make it precise it will need a model, and then it is a model judging novelty — the exact loop that scored yield 4/4 yesterday.
- **It cannot find a collision that is not on GitHub.** Cronloop is a closed-source SaaS; mtok happened to be a public repo. A commercial product shipping your idea is invisible to this tool, and no amount of work inside its current scope changes that.
- **This does not make the screen better, only less wrong afterwards.** The upstream fix is one paragraph in `run-discovery.sh` — before writing a plan, search for the plan's own thesis and make the plan state what already exists. That is a prompt change, not a project, and it should be made tonight regardless of whether this ever gets built.

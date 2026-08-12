# fuelgauge — Let the Agent See Its Own Remaining Budget Before It Spends It

**Source:** [Peaches99/cc-usage-awareness](https://github.com/Peaches99/cc-usage-awareness) · GitHub, created Aug 11 2026, 2★, Python, MIT, stdlib only
**Language:** Python 3.11 stdlib + the official `mcp` SDK
**License:** upstream MIT · plan is a personal build against local session logs
**Date discovered:** 2026-08-13

## What it is

An MCP server that reads Claude Code's own local session logs, works out how much of the rolling usage window has been consumed, and exposes that as a tool the model can call. The agent asks how much fuel is left and gets a percentage back.

**Why it matters here:** three token-cost dashboards shipped in the last three days — tokentab, tokenBar-companion, cc-probeline — and aiusage-tracker (08-07) is already in this backlog. All four render a number for a human to look at. None of them tell the model, which means the one participant in the session who is deciding whether to fan out sixteen subagents is the one participant who cannot see the meter.

The gap is already documented on this machine by the workaround that exists for it. The `ccauto-resume` skill's entire purpose is to restart a session after a usage limit resets overnight. That is a tool for the wall you have already hit. There is nothing for seeing it coming — and the difference matters most exactly where this workflow spends its tokens: a `Workflow` call that spawns a dozen agents is either affordable or it is not, and right now that is discovered at agent seven.

## Why it fits

- Core interest: **Claude/LLM tooling** — an MCP server plus a hook, installed once, active in every session
- Core interest: **dev productivity** — the failure it prevents is a long task dying two thirds of the way through
- `novel = 1`: four usage trackers in the backlog and the window, all human-facing. Exposing the budget *to the model* is a different primitive
- `fills_gap = 1`: `ccauto-resume` handles the aftermath; nothing handles the approach
- `daily_utility = 1`: every session, and every workflow fan-out decision inside it

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | The data is already on disk in JSONL. One parser, one MCP tool, one hook |
| fills_gap | 1 | The existing quota tool on this machine is reactive by design |
| novel | 1 | Four trackers render for humans; none close the loop back to the model |
| daily_utility | 1 | Consulted before every expensive decision, which on this machine is most days |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Language:  Python 3.11, stdlib only for the parser — json, pathlib, datetime, collections
Source:    ~/.claude/projects/**/*.jsonl — assistant records carry message.usage + a top-level ISO timestamp
Server:    the official `mcp` SDK, stdio transport, one tool
Config:    ~/.config/fuelgauge/config.json — per-model weights and the window budget. Must be editable
Surface:   MCP tool + a SessionStart hook line + optionally the statusline
Store:     none. Recompute from the JSONL each call — it is a few hundred files, not a database
```

Stdlib-only for the parser is not minimalism for its own sake: this runs on every session start, so its import time is charged to every session. Keep it under a tenth of a second.

No cache and no database. Reading the JSONL directly means there is no staleness bug to debug and no state to reset when a number looks wrong — and when a budget tool's number looks wrong, it stops being consulted permanently.

## MVP Scope (1-2 Claude sessions)

1. `fuelgauge scan` — walk the JSONL, extract `(timestamp, model, usage)` per assistant message, **deduplicated by `message.id`**
2. Aggregate into a rolling 5-hour window and a rolling 7-day window
3. Apply per-model weights from config to get a single "spend" number for each window
4. MCP tool `budget()` → `{window_pct, window_resets_in, weekly_pct, confidence}`
5. A `SessionStart` hook that prints one line: `fuel: 5h 41% · week 12% · resets 2h14m`

## Phases

### Phase 1: Parser and Rolling Windows (2h)
- Walk `~/.claude/projects/*/*.jsonl`; keep records where `message.usage` exists; read the top-level `timestamp` and `message.model`
- **Deduplicate by `message.id` before summing anything.** This is verified, not theoretical: a sample session file in this repo's project directory holds 25 usage records for 9 distinct message ids. Naive summation overcounts by roughly 2.8×, and the resulting number is not a little wrong — it is wrong enough to make the tool actively harmful
- Sum `input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens` separately; they are not interchangeable and cache reads are the cheapest of the four
- Rolling window means "since now minus 5 hours", not "since the top of the hour". Getting this wrong makes the number jump at boundaries and look broken
- Verify: sum one known session by hand against the tool's output for that file alone, then confirm the deduplicated total matches the distinct-id count

### Phase 2: Calibration (2h)
- Local token counts are **not** plan percentages. The plan limit is enforced server-side and the local logs are the only input available, so the mapping has to be fitted
- Record a `(local_weighted_total, reported_pct)` pair every time `/usage` is checked, in a plain text file. Fit a single scalar per model. Two or three readings across a heavy day is enough for a usable gauge
- Keep the weights and the scalar in `~/.config/fuelgauge/config.json` and **make them editable by hand**. Anthropic changes pricing and limits — the Sonnet pricing update on 2026-08-12 is on today's HN front page — and a tool that requires a code change to recalibrate is a tool that goes stale silently
- Report a `confidence` field alongside every number: `calibrated` once there are three or more readings for that model, `estimated` before then. A gauge that admits it is guessing keeps being trusted; one that guesses silently does not
- Verify: check `/usage`, run `fuelgauge scan`, confirm the two are within ten percentage points

### Phase 3: MCP Tool (1h)
- One stdio tool, `budget()`, returning the four fields and nothing else. Resist adding per-project breakdowns — that is tokentab's job and it already exists
- Response must be a handful of tokens. A budget tool whose own output is expensive is a joke that stops being funny around the third call
- Register in `~/.claude.json`; confirm it appears and returns from a live session
- Verify: call it from a session and check the returned percentage against the hook line from the same moment

### Phase 4: Hook and Thresholds (1.5h)
- `SessionStart` hook emits the one-line summary so the budget is in context from turn one without anyone calling a tool
- Add a threshold line to `CLAUDE.md`: below 25% remaining in the window, call `budget()` before starting any `Workflow` fan-out or any multi-agent dispatch, and say the number out loud when declining
- The right place to spend a warning is **before** an expensive action, not after a cheap one. Do not warn on every turn — a banner that appears constantly is furniture within a day
- Verify: run a deliberately heavy session until the window drops, then confirm the next fan-out decision references the number

### Phase 5 (optional): Hand Off to `ccauto-resume` (1.5h)
- When the window is exhausted, compute the reset time from the oldest record still inside it and hand that timestamp to `ccauto-resume` so the restart schedules itself
- This closes the loop between the two halves — seeing the wall and getting back up after it — and it is the only part of this plan that depends on another tool's interface, so it goes last

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Parser and Rolling Windows | 2h |
| Calibration | 2h |
| MCP Tool | 1h |
| Hook and Thresholds | 1.5h |
| **Core total** | **6.5h (one weekend)** |
| Hand off to `ccauto-resume` (optional) | 1.5h |

Phases 1-2 alone produce a CLI that answers the question, in **4h**. Whether the MCP tool is worth adding is a question the CLI answers.

## Blockers / Risks

- **The duplicate-record trap is the one that decides whether this works at all.** 25 usage records, 9 message ids, in a single real file from this repo. Streaming writes the usage block more than once per message. Deduplicate by `message.id` in Phase 1 or every downstream number is inflated by roughly 2.8× and the tool is worse than nothing, because a gauge that reads high makes you stop early on a budget you still had.
- **Plan percentage is server-side and this is an estimate.** There is no local file with the real number. The calibration scalar makes it usable, and the `confidence` field makes the uncertainty visible — but if the requirement is an exact figure, this plan does not deliver one and no local-only plan can.
- **Pricing and limits move.** Sonnet pricing changed on 2026-08-12; model weights will drift again. Hard-coding them into the source is how this tool becomes wrong three weeks after it is written and nobody notices. Config file, hand-editable, with the last-calibrated date recorded next to each weight.
- **Startup cost is charged to every session.** The hook runs before the first turn. Several hundred JSONL files parsed on every session start is a visible delay — read only files modified within the window's span, which is what `pathlib` `stat().st_mtime` is for, and measure it before shipping Phase 4.
- **Cache-read tokens are not full-price tokens** and this session uses a 1-hour cache TTL. Weighting them the same as fresh input tokens will overstate spend on any long session, which is precisely the session where the number matters. Track the four token classes separately from Phase 1 even though the MVP collapses them — separating them later means reparsing everything.
- **An agent that can see its budget may start optimising for the budget.** The threshold instruction should say "consult before expensive fan-outs", not "minimise spend". The failure mode of the second phrasing is an agent that quietly does less work and does not mention it, which is a far more expensive problem than the one being solved.
- Upstream is 2★ and two days old. The idea is the asset; read its tool schema for shape and write the parser from the JSONL directly.

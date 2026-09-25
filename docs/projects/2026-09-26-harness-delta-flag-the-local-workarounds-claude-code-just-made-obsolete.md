# Harness Delta — Flag the Local Workarounds Claude Code Just Made Obsolete

**Source:** <https://github.com/DMontgomery40/claude-code-prompt-source-map>
**Discovered:** 2026-09-26
**Viability:** 4/4

> The harness ships a new version every day or two. Every one of them can silently turn a hook you wrote, a skill you installed, or a project you planned into dead weight — and nothing on this box tells you when that happens. This repo proves the harness's internals are readable; the missing half is diffing them against *your* setup.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

**Weekend-buildable (1):** one Python file. Read a version string, read three inventory files, fetch one Markdown file, diff, print. No database, no service, no LLM call in the MVP.

**Fills a gap (1):** this is the strongest leg and it is measurable. `/context` and `/skill-doctor` report what your setup *costs right now*; neither knows what changed upstream. `claude --version` knows the number and nothing else. The gap shows up in this repo's own logs: the 2026-09-24 digest killed its only viable candidate because `AskUserQuestion` had quietly become first-party, the 09-07 run killed a candidate that an already-enabled plugin covered, and the 08-17 run killed a whole category because `/context` had shipped. Each of those was caught by *remembering to go read the changelog by hand*. The box is on **2.1.274** (read out of the newest transcript) while upstream is on **2.1.282** — eight versions of drift, unreviewed, right now.

**Novel (1):** five phrasings of the thesis (`claude code system prompt extract diff`, `claude code changelog watcher notify version`, `llm harness system prompt snapshot diff`, `claude code version upgrade report what changed`, `system prompt tracker history diff ai cli`) returned zero repos; four control queries in the same minute returned 37, 13, 8 and 2, so the tooling was healthy and the empty result is real. The adjacent lanes are both static: **extraction dumps** (`x1xhlol/system-prompts-and-models-of-ai-tools` 143.8k★, `asgeirtj/system_prompts_leaks` 68.3k★, today's `claude-code-prompt-source-map`) publish what the harness contains, and **upstream aggregators** (`alcatraz727373/digestClaudeUpdates`, 0★) republish release notes. Neither reads your machine, and nothing joins the two.

**Daily utility (1):** 2.1.274 → 2.1.282 happened inside a week. The report is one paragraph on quiet days and the most valuable thing you read on loud ones, and it drops straight into the daily discovery run where `fills_gap` gets scored.

---

## Implementation Plan

## Overview

Three moving parts:

1. **A snapshot** of what this box runs: harness version, enabled plugins, loose skills, hook event names, MCP server names. Written to `state/harness/<version>.json` the first time a new version is seen.
2. **A changelog slice**: fetch the upstream `CHANGELOG.md`, keep the entries strictly between the last snapshotted version and the current one.
3. **A match pass**: score each new changelog entry against (a) the local inventory names and (b) the titles and theses of `docs/projects/*.md`. Anything that overlaps gets printed under **"may now be first-party"**; everything else is printed as a plain list.

The match pass is deliberately dumb — token overlap, no model call. Its job is to put four entries in front of you, not to be right about them.

## Stack Recommendation

**Python 3 standard library only.** This runs from `run-discovery.sh` before the discovery leg, and from cron, where `claude` is not on `PATH`.

| Concern | Choice | Why |
|---|---|---|
| Language | Python 3 (`python3` on the box) | `json`, `re`, `pathlib`, `urllib` is the whole import list |
| Current version | newest `~/.claude/projects/**/*.jsonl` → any line's `"version"` field | verified present (`"version":"2.1.274"`); survives `claude` not being on `PATH` under cron, which it is not here |
| Version fallback | `claude --version` if no transcript is found | fresh box only |
| Inventory | `~/.claude/settings.json`, `~/.claude/plugins/config.json`, `ls ~/.claude/skills/` | all three exist; 32 loose skills today |
| Upstream notes | `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md` via `urllib` | plain text, no auth, no rate limit; confirmed reachable from this box today |
| Snapshot store | one JSON file per version under `state/harness/` | the diff *is* the product; keeping every version costs a few KB |
| Matching | token-set overlap against inventory names + plan titles | no model call, no embeddings, no index |
| Output | Markdown to stdout, `--write` appends to `docs/harness/<date>.md` | reads in the terminal, publishes in VitePress |
| Check | one `test_delta.py` with `assert` over two canned snapshots + a canned changelog | the version-range slice and the matcher are the only logic that can be wrong |

Excluded on purpose: no binary parsing (the source-map repo's territory — brittle across versions, and the changelog says enough), no npm registry polling, no daemon, no notification channel, no diffing of the system prompt text itself.

## MVP Scope

**In:**

1. `harness_delta.py` resolves the current version, loads the newest snapshot under `state/harness/`, and exits quietly when they match — the common case, and it must cost nothing.
2. On a change: build the new snapshot, diff the inventories (plugins/skills/hooks/MCP servers added or removed), and slice the changelog to the versions in between.
3. Score each new changelog bullet: overlap against inventory names, then against every `# ` heading and blockquote thesis in `docs/projects/*.md`.
4. Print three sections — **Version** (old → new, N entries), **May now be first-party** (scored hits, each with the plan file it collides with), **Everything else** (flat list).
5. `--write` appends the same report to `docs/harness/<date>.md`.
6. Write the new snapshot last, only after a successful report, so a crash mid-run does not swallow the delta.

**Out of v1:** no severity ranking, no LLM summarisation, no watching Codex/Cursor/Gemini release notes, no auto-editing of plan docs, no PushNotification wiring.

## Phases

**Phase 1 — Snapshot and no-op path (45 min).** Version resolution from transcripts, inventory read, `state/harness/<version>.json` written, second run prints nothing and exits 0. Ship this alone and it is already the thing that tells you the box drifted eight versions.

**Phase 2 — Changelog slice (45 min).** Fetch, parse `## <version>` sections, order them with a tuple-of-ints comparison (string sort puts `2.1.9` after `2.1.282`), slice the open interval, cache the raw file under `state/harness/changelog.md` so a network failure degrades to the last copy instead of an empty report.

**Phase 3 — The matcher (1 h).** Token sets, stopword list, a threshold you can move with one env var. Build the stopword list *from* the corpus: the 100 commonest words across `docs/projects/*.md` are worthless as signals. Verify by hand against three known-good cases from the logs — `AskUserQuestion` vs the 09-24 What's Next plan, `/context` vs the 08-17 context-accounting kill, `AGENTS.md` (2.1.277) vs the `agents-context-router` note in today's digest.

**Phase 4 — Report and wiring (45 min).** Markdown output, `--write`, one line in `run-discovery.sh` ahead of the discovery step, one `test_delta.py`.

**Phase 5 (optional, later) — Reverse direction (30 min).** Same matcher, other input: score *today's candidate rows* against the last 30 days of changelog entries, so the `fills_gap` check runs itself instead of depending on someone remembering the rule.

**Total effort:** 3–4 hours, comfortably one session. Phase 1 alone is 45 minutes and already pays.

## Blockers and Known Ceilings

- **The changelog is the only upstream source, and it is terse.** One-line bullets sometimes hide a feature that kills a whole lane (`/context` in 08-17 got one line). The matcher will miss those. Accepted: the fallback is that the entry still appears in *Everything else*, which you read.
- **Token overlap will produce false positives.** Intentional. The upgrade path, only if noise is actually bad: send the shortlist through one `claude -p` call for a yes/no. Not in v1 — a model call per version bump makes the quiet path expensive.
- **`claude` is not on `PATH` in non-interactive shells on this box** (verified today). Transcript-derived version is the primary path for that reason; a fresh box with no transcripts falls back to the binary and, failing that, reports "unknown" and snapshots nothing.
- **`cleanupPeriodDays` defaults to 30**, so transcripts — and with them the version history — get deleted. Irrelevant for the current version (newest transcript is minutes old) but it means the tool cannot reconstruct *past* versions retroactively. Snapshots are the record; that is why they are written per version.
- **Version ordering must be numeric.** `2.1.9` vs `2.1.282` sorts wrong as a string, which would silently produce an empty slice — the exact class of silent-empty failure this repo's logs are full of. That is the one thing the test must cover.

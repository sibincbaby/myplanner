# Agent Receipts → nightly cron run verifier

**Source:** <https://github.com/hmzamlla21/Agent-Reciept> (MIT, Python, created 2026-11-12)
**Discovered:** 2026-11-14
**Viability:** 3/4

> The nightly `claude -p` jobs in this repo regularly claim success after a step silently did nothing. Agent Receipts already turns a Claude Code session log into a structured receipt (commands, files changed, risky actions, tests). Add the repo's own on-disk checks on top and every run gets a pass/fail verdict without anyone re-checking it by hand.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

- **weekend_buildable=1:** one Python script (~200 lines) plus a few lines in `run-discovery.sh`. Agent Receipts does the transcript parsing.
- **fills_gap=1:** the run-discovery cron (01:00 IST) and run-idea-discovery cron (01:33) have shipped incomplete commits that looked fine: a digest that was never written, seen.json not updated, project pages missing from the sidebar, a literal `date +%F` commit message, fabricated HN item IDs. Today those checks only happen when a later interactive session re-runs them by hand.
- **novel=0:** Agent Receipts is installable today, so this is an integrate-and-extend plan, not a rewrite.
- **daily_utility=1:** it runs after every nightly job.

**Shape:** integrate. Install Agent Receipts as-is and don't fork it. Build only the repo-specific verifier and the cron wiring.

---

## Implementation Plan

### Overview

After `claude -p` exits in `run-discovery.sh` (and `run-idea-discovery.sh`):

1. Find the session file that run produced in `~/.claude/projects/-home-sibin-my-works-myplanner/`.
2. Run `agent-receipts --file <session> --format json` to get a machine-readable receipt.
3. Run `scripts/verify_run.py`, which combines that receipt with on-disk checks and prints a one-line verdict plus details.
4. Append the verdict to `discovery.log` and save the full report **outside the repo**, because the repo is public and deployed to Vercel.

### Stack Recommendation

- Python 3 stdlib only for `scripts/verify_run.py` (`json`, `re`, `glob`, `subprocess`, `pathlib`, `argparse`). No new deps in the repo.
- `agent-receipts` installed with `pipx install git+https://github.com/hmzamlla21/agent-reciept.git` (or `uv tool install …`). Pin to a commit SHA after Phase 0.
- Bash wiring in the existing `run-discovery.sh` / `run-idea-discovery.sh`.
- Reports go to `~/.local/state/myplanner/health/<date>-<job>.{json,txt}`.

### MVP Scope

In:
1. Session-file discovery by mtime window (cron start → exit).
2. Receipt in JSON via `--file` (not `--project`, because both cron jobs run in the same folder).
3. On-disk checks for the discovery job (list below) and a smaller set for the ideas job.
4. A one-line verdict in `discovery.log`: `[2026-11-15] VERIFY PASS 14/14` or `VERIFY FAIL 12/14: sidebar-missing docs/projects/…; seen-dups 2`.
5. Exit code 0/1 from the verifier. The cron script must not abort on it (`|| true`).

Out: auto-repair, notifications, a dashboard, `agent-receipts install` (the `/receipt` command files aren't needed headless).

### Checks to implement (discovery job)

| id | check |
|----|-------|
| `digest-exists` | `docs/daily/$DATE.md` exists, is non-empty and contains `## Candidates Screened` |
| `digest-rows` | the candidates table has ≥ 1 row; count N rows |
| `sidebar-sets` | set of `link: '/(daily\|projects)/…'` in `docs/.vitepress/config.ts` == set of `docs/{daily,projects}/*.md` stems (ignore the nav entries `'/'`, `'/daily/'`, `'/projects/'`) |
| `sidebar-labels` | no sidebar label changed vs `git show HEAD~1:docs/.vitepress/config.ts` (catches the regen that turned `MCP` into `Mcp`) |
| `seen-dups` | `state/seen.json` has 0 duplicate URLs |
| `seen-today` | entries with `date_seen == $DATE` ≥ N, and every digest-table URL is in seen.json |
| `seen-resurfaced` | no digest-table URL has an earlier `date_seen` than `$DATE` |
| `seen-diff` | `git diff --numstat HEAD~1 -- state/seen.json` shows 0 deletions (catches the `ensure_ascii` rewrite) |
| `plans-linked` | every `/projects/$DATE-*` link in the digest resolves to a file |
| `hn-ids` | every `news.ycombinator.com/item?id=` in the digest is numeric |
| `commit-msg` | `git log -1 --format=%s` matches `^chore: daily discovery $DATE — \d+ viable project\(s\)$` and the viable count equals the ✅ rows |
| `receipt-wrote-digest` | the receipt's files-changed list includes the digest path |
| `receipt-risky` | the receipt has no `high` items other than the expected `git push` |
| `receipt-email` | the account email does not appear in any command in the receipt (see the open Claude Code email-leak issue) |

### Implementation Phases

#### Phase 0: Try it by hand (15 min, before writing code)
**Goal:** confirm Agent Receipts parses a real `claude -p` cron transcript.

1. `pipx install git+https://github.com/hmzamlla21/agent-reciept.git` and `agent-receipts doctor`.
2. `agent-receipts list --project myplanner`, then `agent-receipts --project myplanner --since 1d --format json -o /tmp/r.json`.
3. Read `/tmp/r.json`. Write down the exact keys for files changed, commands and risk items, since Phase 2 depends on them. Check that headless (`-p`) sessions show up at all.
4. Read the source under `src/` for any network calls before trusting "offline". Do **not** run `agent-receipts install`.

**Done when:** you have the JSON shape written down, or a note that `-p` sessions aren't parsed. If they aren't, `receipt-*` checks become a direct JSONL scan (count `tool_use` blocks with `name in {Write, Edit}` and their `file_path`), and the rest of the plan stays the same.

#### Phase 1: On-disk verifier
**Goal:** `python3 scripts/verify_run.py --job discovery --date 2026-11-14` prints PASS/FAIL per check against today's committed state.

**Files:**
- `scripts/verify_run.py`: `argparse` (`--job discovery|ideas`, `--date`, `--receipt PATH`, `--report-dir`). Write one function per check, each returning `(id, ok, detail)`.

**Steps:**
1. Implement the table above, minus the `receipt-*` rows.
2. Run it against today's commit and the last 7 days (`--date` for each). Old days with known failures (e.g. 2026-08-11 sidebar drift, if you check out that commit) should FAIL, and recent clean days should PASS.
3. Output: one summary line on stdout, plus the full JSON report written to `--report-dir`.

#### Phase 2: Receipt integration
**Goal:** `--receipt /tmp/r.json` adds the `receipt-*` checks.

1. Load the receipt JSON using the keys from Phase 0.
2. `receipt-wrote-digest`: digest path ∈ files changed.
3. `receipt-risky`: list high-risk items, with `git push` to the configured personal remote allowed.
4. `receipt-email`: regex the account email across the receipt's commands. On a hit, report "hit", never the matched text.

#### Phase 3: Cron wiring
**Goal:** every nightly run ends with a verdict line.

In `run-discovery.sh`, around the existing `claude … -p` call:
```bash
START=$(date +%s)
/home/sibin/.local/bin/claude --dangerously-skip-permissions -p "…"   # existing
SESSION=$(find "$HOME/.claude/projects/-home-sibin-my-works-myplanner" -name '*.jsonl' -newermt "@$START" -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
HEALTH="$HOME/.local/state/myplanner/health"; mkdir -p "$HEALTH"
if [ -n "$SESSION" ]; then
  "$HOME/.local/bin/agent-receipts" --file "$SESSION" --format json -o "$HEALTH/$DATE-discovery-receipt.json" || true
fi
python3 scripts/verify_run.py --job discovery --date "$DATE" \
  --receipt "$HEALTH/$DATE-discovery-receipt.json" --report-dir "$HEALTH" || true
```
1. The script uses `set -euo pipefail`, so every new line must be fail-safe (`|| true`, and `find` on a missing dir must not abort).
2. Use the absolute pipx bin path, since the cron PATH is minimal.
3. Do the same for `run-idea-discovery.sh` with `--job ideas` (fewer checks: `docs/ideas/$DATE.md` exists, sidebar sets, `state/` file grew, commit message).
4. Use `-newermt "@$START"` so the 01:33 ideas job doesn't pick up the 01:00 session.

#### Phase 4: Make failures visible (optional)
- At the start of each interactive session in this repo, `tail -1` the latest health file. A SessionStart hook would work, but it's opt-in. Don't touch `~/.claude/settings.json` without asking, because it holds a live token inside the hook commands.
- Or add the verdict line to the next day's digest under `## Sources` as "Last run: PASS/FAIL". That needs only the summary line, never the report.

### Effort Estimate

About one Claude session. Phase 0 takes 15 min, Phase 1 about 1.5 h, Phase 2 30 min, Phase 3 30 min.

### Blockers / Risks

- **Does Agent Receipts parse `claude -p` sessions?** Its README says Claude Code is "checked against a real session", which may only mean interactive ones. Phase 0 decides this, and the fallback is a direct JSONL scan.
- **Never commit receipts or reports.** The repo is public and deployed. Receipts list commands and paths, and the hook commands in `~/.claude/settings.json` hold a live token. Agent Receipts redacts by default; keep it that way and never pass `--no-redact`.
- **The tool is 2 days old (1★).** Pin a commit and review the diff before upgrading.
- **The verifier can't catch bad judgement**, only missing files and broken bookkeeping. Scoring quality still needs a human read.

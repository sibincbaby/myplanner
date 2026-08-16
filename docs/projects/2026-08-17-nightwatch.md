# nightwatch — Make `Done` Mean the Run Actually Worked

**Source:** [alexander-akhmetov/grafana-agento11y-hermes](https://github.com/alexander-akhmetov/grafana-agento11y-hermes) · Show HN Aug 16 2026 (25 points), 34★, Python, Apache-2.0 — **created 2026-04-29, not new**
**Corroborating today:** [fayzan123/rungraph](https://github.com/fayzan123/rungraph) · [SohamRatnaparkhi/agmux](https://github.com/SohamRatnaparkhi/agmux) · [waku.sh](https://waku.sh)
**Language:** Python 3.11 stdlib, invoked from the existing bash wrappers
**License:** original
**Date discovered:** 2026-08-17

## What it is

`run-discovery.sh` ends like this:

```bash
git push git@github-personal:sibincbaby/myplanner.git master 2>&1
echo "[$DATE] Done"
```

`Done` is printed when `claude -p` exits 0 and the push succeeds. It is not conditional on anything the run was actually for. The digest may not exist. The sidebar may not link it. `state/seen.json` may not have grown. The commit message may contain the literal string `date +%F`. All four have happened, and on every one of those mornings the log said `Done`.

nightwatch is an acceptance test for an unattended agent run: a list of assertions about what must be true **on disk** afterwards, checked by the wrapper script, exiting non-zero and saying which one failed.

Four agent-observability tools were screened this week — Grafana traces for agent runs, a graph visualiser, a tmux supervisor, a native Rust window. Every one shows you *what the agent did*. None of them knows what the run was supposed to produce, so none of them can tell you it didn't.

**Observability describes the run. nightwatch decides whether to accept it.**

## Why it matters here

The failures are not hypothetical. They are the changelog of this repo:

| Date | Failure | What the log said |
|------|---------|-------------------|
| 2026-08-03 | Commit message committed as `chore: daily discovery date +%F — 0 viable` | `Done` |
| 2026-08-09 | Dedup read returned `[]`; already-seen URLs re-surfaced as new | `Done` |
| 2026-08-11 | `docs/daily/2026-08-11.md` written, never added to `config.ts` — unreachable on the site for a day | `Done` |
| 2026-07-09 | `write-digest` made **zero tool calls**; the digest was never created, and the sidebar step then silently omitted it | `Done` |
| 2026-08-15 | Dedup disabled again; 4 seen URLs re-appended with today's date; `seen.json` had accumulated **14 duplicates** | `Done` |
| 2026-08-16 | `seen.json` rewritten with `ensure_ascii=True`, mangling em-dashes in 400+ existing titles into `—` | `Done` |

Every one was caught by a human reading files the next morning, and the checks that caught them are already written down as prose. Turning that prose into assertions is the entire project:

1. `docs/daily/<date>.md` exists and is over some floor of bytes
2. The set of `docs/daily/*.md` stems equals the set of `daily/` links in `config.ts` — and the same for `projects/`, because the 08-11 drift was invisible to a check that only looked at today
3. `state/seen.json` parses, has zero duplicate URLs, and grew by roughly the number of rows in today's table
4. No URL in today's digest appears in `seen.json` with an earlier `date_seen`
5. `git log -1` matches `^chore: daily discovery \d{4}-\d{2}-\d{2} — \d+ viable`, and the date is today's
6. `git diff HEAD~1 --stat state/seen.json` shows insertions and **zero deletions**

Six assertions, roughly forty lines, run twice a night against two jobs that between them spend eight-figure token counts. `set -euo pipefail` is already at the top of both wrapper scripts, so a non-zero exit is all it takes to stop `Done` from being printed.

## Why it fits

- Core interest: **dev productivity** — this is the one that runs every day without being asked
- Core interest: **Claude/LLM tooling** — the failure mode being tested for is specifically "the agent responded instead of doing the file operation"
- `fills_gap = 1`: six documented silent failures, checks already written in prose, nothing running them
- `novel = 1`: every agent tool this week guards the *input* or narrates the *run*; none asserts on the artifact
- `daily_utility = 1`: fires at 01:00 and 01:33 tonight, and every night

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | ~40 lines of stdlib Python plus two lines in each wrapper. Closer to an evening than a weekend |
| fills_gap | 1 | Six real silent failures; the checklist exists only as prose |
| novel | 1 | Pre-execution guards and run visualisers exist; a post-run acceptance gate for an unattended agent does not |
| daily_utility | 1 | Two cron jobs, every night, unattended |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Checks:   checks.py — one function per assertion, each returns (ok, message)
Config:   nightwatch.json — per job: expected files, sidebar dirs, commit regex
Runner:   python3 checks.py --job discovery --date $DATE  → exit 0 or 1
Wiring:   two lines in run-discovery.sh and run-idea-discovery.sh
Alert:    notify-send when DISPLAY is set; the non-zero exit is the real signal
```

A `--fix` flag is deliberately absent. The failures here are an agent doing the wrong thing; a script that repairs them quietly re-creates the exact problem — a run that looks like it worked. Report, exit non-zero, stop.

**Skipped: a plugin architecture, a check DSL, retries, a web dashboard, healthchecks.io pings. Add the ping when this box stops being the only consumer of the output.**

The sidebar check has one trap worth encoding on the first pass: `config.ts` contains nav entries (`{ text: 'Home', link: '/' }`, `'/daily/'`, `'/projects/'`) that are not sidebar items. Extract links matching `/(daily|projects)/<stem>` only, and compare **sets**, not counts.

## MVP Scope (1-2 Claude sessions)

1. `checks.py` with the six assertions above, each a small function taking the repo root and the date
2. `nightwatch.json` describing both jobs — discovery writes `docs/daily/` plus `docs/projects/`, idea-discovery writes `docs/ideas/`
3. A runner that prints one line per check (`PASS` / `FAIL` plus the reason) and exits 1 if any failed
4. Two lines added to each wrapper script, before `echo Done`
5. Run it against the last ten days of history and confirm it flags 08-11 and 08-03 retroactively
6. `notify-send` on failure when a desktop session is available

## Phases

### Phase 1: The Six Checks, Against History (2h)
- Write each check to take `(repo, date)` and return `(ok, message)` — no printing inside, no `sys.exit` inside
- **Run them against past commits before wiring anything.** `git stash` is not needed: check out each of the last ten daily commits into a temp worktree and run the suite against it
- The suite must fail on the 08-11 commit (sidebar drift) and on the 08-03 commit (`date +%F` in the message), and pass on the rest. **If it does not reproduce those two, the checks are wrong, and finding that out now costs nothing**
- Verify: ten historical runs, two expected failures, eight passes, and the failure messages name the actual problem

### Phase 2: Config and Runner (1h)
- `nightwatch.json` keyed by job name; the discovery job and the idea job differ only in which directories they write
- Exit code is the interface. Text output is for the human reading `discovery.log` tomorrow
- Print every check's result, not just failures — a suite that prints nothing on success is a suite nobody notices has stopped running
- Verify: `python3 checks.py --job discovery --date $(date +%F)` today prints six PASS lines and exits 0

### Phase 3: Wire Into Both Wrappers (0.5h)
- Insert before the final `echo`, so `Done` becomes conditional:
  ```bash
  python3 nightwatch/checks.py --job discovery --date "$DATE" || { echo "[$DATE] FAILED acceptance"; exit 1; }
  echo "[$DATE] Done"
  ```
- **Put it before `git push`, not after.** A run that fails acceptance should not be pushed to a public site; the commit is local and amendable until it leaves the machine
- `set -euo pipefail` is already on, so the explicit `|| { ...; exit 1; }` exists only to write a distinguishable line into the log
- Verify: temporarily rename today's digest, run the wrapper, confirm it prints `FAILED acceptance` and does not push; restore and confirm it passes

### Phase 4: Make a Failure Reach a Human (1h)
- `notify-send` when `DISPLAY` or `DBUS_SESSION_BUS_ADDRESS` is set — the existing crontab already exports `DBUS_SESSION_BUS_ADDRESS` for another job, so the pattern is on this box already
- At 01:33 nobody is looking, so the durable signal is the log line and the absent push, not the toast
- A `--report` mode that prints the last N nights' verdicts, for the morning read
- Verify: force a failure with the desktop session open and confirm the notification arrives; force one with `DISPLAY` unset and confirm it still exits 1 without an exception

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Six checks + historical replay | 2h |
| Config and runner | 1h |
| Wiring | 0.5h |
| Notification and report mode | 1h |
| **Core total** | **4.5h (an evening)** |

Phase 1 is the load-bearing one, and it has a hard pass/fail of its own: reproduce the 08-11 and 08-03 failures from history, or the checks are not measuring what they claim.

## Blockers / Risks

- **The checks encode today's pipeline and will drift when the pipeline changes.** If the digest format changes, check 1 breaks and the run fails for the wrong reason. Keep every assertion structural — the file exists, the sets match, the JSON parses, no duplicates — and never assert on prose or on a heading. A brittle check that cries wolf gets commented out within a week, and a commented-out check is worse than none.
- **A false failure blocks the push, which is the point and also the cost.** The commit stays local and the site goes stale for a day. That is strictly better than publishing a broken digest, but it means the morning read still matters — `--report` exists so that read is one command.
- **The `seen.json` growth check needs a tolerance, not an equality.** Today's digest tables have run 12 to 15 rows and a legitimate run may append a different count. Assert "grew by at least 5 and gained no duplicates", not "grew by exactly N" — the duplicate check is the one that has actually caught things.
- **This does not verify the digest is any good.** It verifies the run produced the artifacts it claimed. A digest full of hallucinated repos passes every check. That is the correct scope: the star-count and `created_at` verification against the GitHub API belongs in the pipeline that writes the digest, not in the gate that accepts it.
- **Two jobs write the same `state/seen.json` thirty-three minutes apart.** If the 01:00 run ever overruns, the checks could read a file mid-write by the 01:33 run. The scripts already skip when today's digest exists, which mostly covers it; a `flock` on the repo is the honest fix if the overlap ever actually happens, and not before.
- **The lazy version of this project is forty lines of Python and no repository.** It should stay that way. The moment it grows a plugin system it has become the kind of thing that itself needs a test, and the failure it was built to catch — a script that reports success without doing the work — is exactly the failure it would then be capable of.

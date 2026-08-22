# attribution-guard — Deterministic Enforcement of the No-AI-Attribution Rule

**Source:** [dlhck/strip-clanker-attribution](https://github.com/dlhck/strip-clanker-attribution) · GitHub (2★, created 2026-08-21, JavaScript, MIT)
**Date discovered:** 2026-08-23

## What it is

A `commit-msg` hook that strips agent attribution out of commit messages before the commit lands. It removes agent co-author trailers (`Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`, `Co-authored-by: Cursor <cursoragent@cursor.com>`), attribution trailers (`Made-with:`, `Generated-by:`, `Codex-Session-Id:`), and signature lines (`🤖 Generated with [Claude Code](...)`). Human co-authors survive, and body text that merely mentions the tools survives.

Two other repos do the same thing: [Zingzy/no-claude-coauthor](https://github.com/Zingzy/no-claude-coauthor) (0★, 2026-07-16) and [Otitodev/nocoauthor](https://github.com/Otitodev/nocoauthor) (0★, 2026-08-01). None has traction. The idea is a few lines of `sed` behind git's native `commit-msg` hook.

## Why it fits

The user's global `CLAUDE.md` carries an explicit rule:

> NEVER add a `Co-Authored-By: Claude ...` trailer (or any AI attribution line) to git commit messages

That rule is enforced **by instruction only**, and instruction-only enforcement has already failed measurably in this very repository:

```
$ git log --format='%h|%ad|%s' --date=short --grep='Co-Authored-By' --all
a9dfb54|2026-08-02|chore: daily discovery 2026-08-02 — 4 viable project(s) [cloud]
938e7a7|2026-07-27|chore: daily discovery 2026-07-27 — 3 viable project(s) [cloud]
32aae58|2026-07-06|chore: daily discovery 2026-07-06 — 4 viable project(s) [cloud]
cdf6218|2026-07-02|chore: daily discovery 2026-07-02 — 5 viable project(s) [cloud]
```

Four violations, **all four from `[cloud]` runs**. The local runs are clean. The cloud agent does not load the user's global `CLAUDE.md`, so the rule silently does not apply there — and nothing catches it. The harness running *this* session is itself instructed to append `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`, in direct conflict with the user's rule. A hook is the only layer that resolves that conflict deterministically.

- Core interest: **dev productivity** — every commit, in every repo, with zero attention cost
- `fills_gap = 1`: measured, not hypothetical — 4 dirty commits are in `master` right now
- `daily_utility = 1`: the user commits daily; the pipeline alone commits every day

`~/.git-hooks` already exists and is wired up globally (`core.hooksPath=/home/sibin/.git-hooks`), but contains only a `post-checkout` hook. There is no `commit-msg` hook. The fix drops into infrastructure that is already in place.

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | A `commit-msg` hook is well under one session — this is minutes, not hours |
| fills_gap | 1 | 4 measured violations in `master`; global `hooksPath` exists with no `commit-msg` hook |
| novel | 0 | Three repos already do it, and git's native `commit-msg` hook makes it a few lines of `sed` |
| daily_utility | 1 | Fires on every commit in every repo |
| **Total** | **3/4** | **VIABLE** |

**Size disclaimer, stated up front:** this is a ~15-line hook plus a one-time history cleanup. It is on this page because it scores 3/4 honestly and because the gap is measured, not because it is a weekend's work. Do not install the npm package — `npm install --save-dev @dlhck/strip-clanker-attribution` adds a dependency and a `node_modules` round trip to something `sed` does natively, and it only covers repos that use husky. The global hook covers every repo at once.

## Stack Recommendation

```
Language:  POSIX sh (already how ~/.git-hooks/post-checkout works — bash shebang)
Mechanism: git-native commit-msg hook in the existing core.hooksPath
Deps:      none — sed only. No node, no npm, no husky.
Scope:     global (~/.git-hooks/commit-msg) so it covers cloud runs, local runs, and every other repo
Backfill:  git filter-branch --msg-filter (or git-filter-repo if installed) for the 4 existing commits
```

## MVP Scope (well under one session)

One file, `~/.git-hooks/commit-msg`:

```sh
#!/usr/bin/env bash
# Strip AI attribution trailers/signatures. The user's CLAUDE.md forbids them;
# cloud agents don't read CLAUDE.md, so enforce it here instead of by instruction.
sed -i -E \
  -e '/^[Cc]o-[Aa]uthored-[Bb]y:.*(anthropic\.com|cursor\.com|openai\.com|claude|codex|copilot)/Id' \
  -e '/^(Made-with|Generated-by|Codex-Session-Id|Assisted-by):/Id' \
  -e '/^🤖 Generated with/d' \
  -e '/^Co-Authored-By: Claude/Id' \
  "$1"
# Collapse any trailing blank lines the deletions left behind
printf '%s\n' "$(cat "$1")" > "$1"
```

That is the entire deliverable. Everything below is verification and cleanup.

## Phases

### Phase 1: The hook (10 min)
- Write `~/.git-hooks/commit-msg`, `chmod +x`
- Confirm `git config --get core.hooksPath` still returns `/home/sibin/.git-hooks` (it does today)
- Verify: `git commit --allow-empty -m "$(printf 'test\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')"` then `git log -1 --format=%B` — the trailer is gone, the subject survives

### Phase 2: The negative tests (15 min)
The failure mode that matters is over-matching. Write one `test_hook.sh` with assertions:
- A **human** co-author trailer survives untouched (`Co-authored-by: sibin c <sibincbaby219@gmail.com>`)
- Body prose mentioning "Claude Code" or "generated by the agent" survives
- A commit message that is *only* a subject line is unchanged and does not lose its newline
- Multiple stacked trailers are all removed in one pass
- Verify: `./test_hook.sh` exits 0; each case asserts on exact output, not on exit status

### Phase 3: Backfill the 4 dirty commits (20 min)
- The 4 commits are local history on `master` in a personal repo, so rewriting is low-risk — but confirm the remote state first (`git log origin/master --grep='Co-Authored-By'`) because this repo **is** pushed to `github-personal`
- `git filter-branch --msg-filter 'sed -E "/^Co-Authored-By: Claude/Id"' -- --all` (or `git-filter-repo --message-callback` if installed — cleaner, no refs/original litter)
- Force-push is required after a history rewrite. If that is unacceptable, skip this phase — the hook stops the bleeding regardless, and 4 historical commits are cosmetic
- Verify: `git log --grep='Co-Authored-By' --all` returns empty

### Phase 4: Make the cloud runs safe (15 min)
The 4 violations all came from `[cloud]` runs, which don't get `~/.git-hooks`.
- Add the same `sed` to `run-discovery.sh` right before its `git commit`, so the cloud path is covered by the script it actually runs
- Or better: have `run-discovery.sh` set `core.hooksPath` for the checkout it operates on
- Verify: grep the next cloud commit for the trailer — the 2026-08-24 `[cloud]` run should land clean

## Effort Estimate

| Phase | Time |
|-------|------|
| The hook | 10 min |
| Negative tests | 15 min |
| Backfill 4 commits | 20 min |
| Cloud-path coverage | 15 min |
| **Total** | **~1h** |

## Blockers / Risks

- **Over-matching is the whole risk.** A regex broad enough to catch `Co-Authored-By: Claude Sonnet 4.6` can also eat a legitimate human trailer if a collaborator is named Claude. The pattern above anchors on vendor domains and known agent names rather than on the word "Claude" alone, and Phase 2 asserts the human-trailer case explicitly. Do not widen the regex without adding a negative test first.
- **History rewrite requires a force-push.** This repo pushes to `git@github-personal:sibincbaby/myplanner.git`. Phase 3 is genuinely optional; the 4 commits are cosmetic and the hook prevents new ones. Skip it rather than force-push something shared.
- **`sed -i` is not portable to BSD sed.** This box is Linux, so GNU sed is fine. If the hook ever moves to macOS it needs `sed -i ''`. Not worth solving today.
- **A hook is not a guarantee.** `git commit --no-verify` bypasses it, and so does any agent that constructs the commit object directly. This closes the accidental path, which is the one that actually fired 4 times — not an adversarial one.

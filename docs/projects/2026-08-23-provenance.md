# provenance — Is This Repo the Original, or a Fresh Clone Wearing Its Stars?

**Source:** [Leutenegger/claudish-to-english](https://github.com/Leutenegger/claudish-to-english) (580★, created 2026-08-21) vs [gvzdv/claudish-to-english](https://github.com/gvzdv/claudish-to-english) (2082★, created 2026-08-10) · surfaced by this pipeline's own `sort=stars` search
**Date discovered:** 2026-08-23

## What it is

Not a repo someone shipped — a hole this pipeline fell into today and caught by accident.

Today's GitHub sweep ranked `Leutenegger/claudish-to-english` near the top: 580★, created 2026-08-21, squarely inside the 48-hour window, exactly on-profile (a Claude Code plugin). It would have entered the digest as a legitimate new find. The `created_at` check that memory mandates *passed* — the repo really was created on 08-21.

What caught it was a second check. The README is byte-identical to a repo created 11 days earlier:

```
$ gh api repos/Leutenegger/claudish-to-english/readme --jq .content | base64 -d | md5sum
09cd4600c8b85e000e97115c96ca467e  -
$ gh api repos/gvzdv/claudish-to-english/readme       --jq .content | base64 -d | md5sum
09cd4600c8b85e000e97115c96ca467e  -
```

Same md5. The 580★ repo is a verbatim copy of the 2082★ original, and the description carries no attribution to it.

The account is worth a look on its own:

| Repo | Stars | Created | Forks |
|------|------:|---------|------:|
| book-to-skill | 1227★ | 2026-08-13 | 145 |
| watermarks-remover | 933★ | 2026-08-19 | 95 |
| vanity-eth | 803★ | 2026-08-21 | 91 |
| coldcard-airgap | 608★ | 2026-08-20 | — |
| claudish-to-english | 580★ | 2026-08-21 | — |
| headroom | 0★ | 2026-08-11 | — |

Account created 2026-03-05, 6 public repos, **7 followers**, ~4,150 stars accumulated across repos created in the last ten days. One repo — `headroom` — has zero. Stating only what is provable: one repo is a verbatim copy of an older, higher-starred original, and the star accumulation on this account is not a pattern that ordinary organic growth produces. Two of the six are crypto-wallet utilities (`vanity-eth`, `coldcard-airgap`), which is the category where installing a stranger's "offline" key generator has the sharpest consequences.

## Why it fits

- Core interest: **Claude/LLM tooling** — the cloned repo is a Claude Code plugin; the account also ships `book-to-skill`, a Claude Code skill generator
- Core interest: **dev productivity** — the user runs 26 plugins and 168 skills; provenance is the check nobody runs before installing one
- `fills_gap = 1`: **this pipeline is the consumer.** It ranks by `sort=stars` every single day and nearly wrote a clone into today's digest as a real find. Nothing in the toolkit checks originality
- The existing tools miss this specific check: [real-stars](https://github.com/serenakeyitan/real-stars) (4★) and [fake-star-radar](https://github.com/clawwangcai-dev/fake-star-radar) (0★) do star-burst statistics (StarGuard/StarScout MAD detection); [repoguard](https://github.com/unaltuzun/repoguard) (0★) does typosquats; [cc-audit](https://github.com/ryo-ebata/cc-audit) (23★) and [plugin-auditor](https://github.com/secawa-com/plugin-auditor) do static security scanning of skill *content*. None asks "is this a copy of an older, more-starred repo?"
- SkillWorks ([skillworks.kynth.studio](https://skillworks.kynth.studio), found in the same sweep) scores 503,570 listings nightly on Works / Maintained / Adopted / Documented. Originality is explicitly not one of its four components — and "Adopted" is scored *from stars*, which is the exact signal being gamed

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Two `gh api` calls and an md5 — the discriminating check already ran today, by hand |
| fills_gap | 1 | This pipeline ranks by stars daily and had no originality check; SkillWorks scores adoption *from* stars |
| novel | 1 | Existing tools do star-burst stats, typosquats, or content security — not clone-vs-original |
| daily_utility | 0 | Honest zero. Plugin installs are occasional, not daily |
| **Total** | **3/4** | **VIABLE** |

**Size disclaimer:** the core check is a shell function, not an application. The plan below is small on purpose, and Phase 1 alone captures most of the value. Do not build a scanning service; there are already two of those and they measure something else.

## Stack Recommendation

```
Language:  POSIX sh + gh (already authenticated here as sibinc and sibincbaby, 5000/hr)
Core:      md5 of README, compared against same-named / same-description repos ranked by stars
Signals:   (1) README identical to an older repo   — decisive
           (2) stars-per-day since creation        — flags, doesn't decide
           (3) account age vs follower count       — flags, doesn't decide
Output:    exit 0 clean / exit 1 suspicious, one line of reasoning per signal
Wiring:    a shell function + a call inside the discovery sweep before a repo enters the digest
```

## MVP Scope (one short session)

`provenance <owner>/<repo>` — prints a verdict and exits non-zero if the repo looks derivative:

1. Fetch the repo: `created_at`, `stargazers_count`, `description`, owner
2. Hash its README
3. Search `search/repositories` for the repo *name* and for the first 8 words of its description
4. For every result older than this repo with more stars: hash its README, compare
5. Print `CLONE OF <older repo>` on an md5 match; otherwise print the soft signals (stars/day, account age vs followers) and exit 0

## Phases

### Phase 1: The clone check (45 min)
- `provenance.sh <owner>/<repo>` implementing steps 1–5 above
- Normalize before hashing — strip trailing whitespace and collapse blank lines, so a one-newline diff doesn't defeat the match
- Verify against today's two known cases: `Leutenegger/claudish-to-english` must report `CLONE OF gvzdv/claudish-to-english`; `gvzdv/claudish-to-english` must come back clean. Both answers are already known, so this is a real test, not a smoke test

### Phase 2: Near-miss detection (45 min)
A clone that edits one line defeats md5.
- Fall back to a similarity ratio on the normalized README (`difflib.SequenceMatcher` in a few lines of Python — stdlib, no dependency)
- Flag at ≥0.90 similarity, report the ratio rather than a boolean
- Verify: append a line to a local copy of the README and confirm it still flags at ~0.99 where md5 no longer matches

### Phase 3: Wire it into the discovery sweep (30 min)
This is where it earns its keep.
- Call `provenance` on every GitHub candidate before it enters the digest table
- A flagged repo isn't dropped — it's annotated in the candidates table with what it's a copy of, which is more useful than silence
- Verify: re-run today's sweep and confirm the `Leutenegger` row comes back annotated automatically

### Phase 4: Soft signals, reported not enforced (30 min)
- stars/day since creation; account age vs follower count; fork-to-star ratio
- Report these as context lines, never as a verdict. Note the counter-evidence from today: the flagged account's fork ratios (145 forks / 1227★) look *ordinary*, so forks are a weak signal and a naive threshold on them would produce false positives
- Verify: run it over 10 known-good repos from `state/seen.json` and confirm zero hard failures

## Effort Estimate

| Phase | Time |
|-------|------|
| Clone check | 45 min |
| Near-miss similarity | 45 min |
| Wire into discovery sweep | 30 min |
| Soft signals | 30 min |
| **Total** | **~2.5h** |

## Blockers / Risks

- **False accusation is the real cost.** Legitimate forks, vendored templates, and `awesome-*` lists share READMEs for honest reasons. The output must say "identical to `<older repo>`" — a fact — and never "fraud", an inference. Phase 4 exists precisely to keep the soft signals out of the verdict.
- **A one-line edit defeats md5.** That is what Phase 2 is for, and even the similarity ratio loses to a rewritten README over identical code. Hashing source files rather than the README would be more robust and much slower; not worth it for a pre-install check.
- **Search API rate limit.** Each check costs 1–2 `search/repositories` calls, and search is 30/min authenticated. Wiring it into a sweep over ~15 candidates is fine; wiring it into a sweep over 300 is not. Cache verdicts by repo in `state/`, and note that this is the same rate-limit trap that silently returned 0 results on 2026-08-15 and 08-16 — a failed provenance call must be loud, never a silent "clean".
- **This check would not have caught the thing it is named after.** `gvzdv/claudish-to-english` (the original, 2082★) is genuinely popular and genuinely unvetted; provenance says nothing about whether its code is safe. This tool answers "is this the original?" and nothing else. `cc-audit` answers the security question and already exists — use both, and don't grow this one into that one.

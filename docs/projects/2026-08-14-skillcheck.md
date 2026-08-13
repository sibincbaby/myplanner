# skillcheck — Lint the Forty Skills You Load Every Session, and Find the Two That Collide

**Source:** [xyiqq/skilldoctor](https://github.com/xyiqq/skilldoctor) · GitHub, created Aug 13 2026, 26★, TypeScript, MIT, 2 forks
**Language:** Python 3.11, stdlib only
**License:** upstream MIT — install it, then build only what it does not do
**Date discovered:** 2026-08-14

## What it is

skilldoctor is a quality gate for Agent Skills: `lint` checks the spec, `audit` flags unsafe instructions, `compat` checks whether one `SKILL.md` works across Claude Code, Cursor, Codex and OpenCode, and `scan` walks a repo for all of them. Its own pitch is the sharpest line in today's digest: *"Vercel's `npx skills` installs skills. skilldoctor decides whether you should keep them."*

**Why it matters here:** thirty-two skill entries in this backlog and every one of them is a producer — book-to-skill, reverse-skill, evidence-to-skill, awesome-claude-code-toolkit (135 agents, 176 plugins), flutter-llm-toolkit. Nothing has ever checked the output. The state of this machine, measured rather than guessed:

```
1029  SKILL.md files on disk under ~/.claude
 517  in plugins/cache · 479 in plugins/marketplaces · 31 loose in skills/
  30  enabled plugins in settings.json
 14   files with no parseable name or description
147k  characters of description text across all of them (~37k tokens if it all loaded)
  8×  the name `tdd-workflow` appears, across cached plugin versions
```

The `ccplug` skill already exists on this machine to switch plugins off for startup cost. That is a treatment prescribed without a measurement: nothing reports what any individual skill costs, and nothing reports which two descriptions are close enough that the model has to guess between them. Both questions are answerable from files already on disk, and neither is what skilldoctor answers.

## Why it fits

- Core interest: **Claude/LLM tooling** — a CLI over `~/.claude`, no server, no API key
- Core interest: **dev productivity** — the failure it catches is a skill that never triggers, which is invisible by definition
- `novel = 1`: thirty-two authoring tools in the backlog, zero validators; skilldoctor is the first, one day old, and stops before cost and collisions
- `fills_gap = 1`: `ccplug` decides what to switch off with no data underneath it
- `daily_utility = 0`: honestly, this runs when skills change, not every day. It clears the bar on the other three legs

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Walk a directory, parse two frontmatter keys, count, compare. No dependencies |
| fills_gap | 1 | Forty skills load every session and nothing measures or checks them |
| novel | 1 | The whole category produces skills; one tool inspects them and it shipped yesterday |
| daily_utility | 0 | Run on change, not on schedule |
| **Total** | **3/4** | **VIABLE** |

## Stack Recommendation

```
Language:  Python 3.11, stdlib only — pathlib, re, json, argparse, difflib
Input:     ~/.claude/skills/**, ~/.claude/plugins/cache/**, ./.claude/skills/** + enabledPlugins
Parse:     hand-rolled frontmatter reader for `name` and `description` only
Similarity: token-set Jaccard over descriptions. No embeddings, no model call
Output:    human table by default, --json for hooks and CI
```

Stdlib only, and that includes the frontmatter. PyYAML is not stdlib and this needs exactly two scalar keys out of the top-level block — a regex over the text between the first two `---` lines is fifteen lines and cannot fail in a way that matters. <!-- ponytail: two-key regex, not a YAML parse; switch to PyYAML only if a rule ever needs nested metadata -->

Jaccard over description terms and not embeddings, for the same reason: the goal is a ranked list of pairs to look at by eye, not a similarity score anyone will trust to three decimals. A model call here would add an API key, a latency budget and a failure mode to a tool whose entire job is telling you the truth about local files.

## MVP Scope (1-2 Claude sessions)

1. **Install skilldoctor first and run it.** `npx --yes github:xyiqq/skilldoctor scan` over `~/.claude`. If its `lint` and `audit` are good, those two commands are done and this project is only the other two
2. `skillcheck cost` — every skill that is actually *loaded*, ranked by description size, with the total in tokens
3. `skillcheck collide` — pairs of loaded skills whose descriptions overlap above a threshold, most similar first
4. `skillcheck lint` — only the mechanical rules: missing or empty `name`/`description`, name not matching its directory, unparseable frontmatter, description over ~500 characters
5. `--json` on all three

## Phases

### Phase 1: Find the Skills That Actually Load (1.5h)
- Three roots: `~/.claude/skills/`, the enabled plugins' `skills/` under `plugins/cache/`, and `.claude/skills/` in the project
- **The distinction between present and loaded is the entire tool.** 1029 `SKILL.md` files are on this disk; roughly 130 appear in a session listing. `plugins/marketplaces/` is a catalogue of things not installed, and `plugins/cache/` holds multiple versions of the same plugin — hence `tdd-workflow` appearing eight times. Counting files instead of reading `enabledPlugins` from `settings.json` produces a number that is off by 25× and a report nobody can act on
- Resolve version conflicts by taking the version the settings actually enable, not the newest directory on disk
- Verify: the tool's loaded count and names match a real session's skill listing, item for item

### Phase 2: Cost (1h)
- Sum description characters across loaded skills, report `chars // 4` as an estimate and **say the word estimate in the output**. There is no tokenizer in the stdlib and a ranked list does not need one
- Two columns that mean different things: description size is paid on *every* session; body size is paid only when the skill is invoked. Collapsing them into one number is how a 40-line skill with a 900-character description gets ranked as cheap
- Current worst offender on this machine is a 906-character description; the mean is 144. That spread is the report's whole point
- Verify: total against a manual `wc -c` over the same file list

### Phase 3: Collisions (2h)
- Lowercase, split on non-word characters, drop a small stopword list plus the words that carry no signal here (`skill`, `use`, `when`, `user`, `agent`, `claude`), then Jaccard each loaded pair
- Report the top 15 pairs with both descriptions printed side by side. A number alone is not actionable; the judgement is the human's and it takes two seconds once the text is in front of them
- **Expect false positives and design for them.** Six `vercel:*` skills legitimately share vocabulary. A `--ignore` list of pairs in `~/.config/skillcheck.json`, appended to as pairs are dismissed, is what keeps the report worth reading on run three
- Real collision to check the tool against: several skills on this machine describe "verification before completion", "gate checking" and "specifying gates" — if the tool cannot rank those together it is not working
- Verify: hand-pick two skills with knowingly overlapping descriptions, confirm they surface in the top five

### Phase 4: Lint and Wiring (1h)
- Mechanical rules only: unparseable frontmatter, missing `name`, missing `description`, name ≠ directory, description over 500 characters. Fourteen files on this machine already fail rule one
- **Do not build a description-quality judge.** "Would this trigger correctly" is a model's opinion, it needs an API key, and it makes a linter into something that gives different answers on different days
- Exit non-zero on errors so it can be a pre-commit hook in any repo that carries skills
- Verify: run over the 14 known-bad files and confirm each is reported with its path

### Phase 5 (optional): Prune Suggestions (1h)
- Cross-reference loaded skills against invocation records in `~/.claude/projects/**/*.jsonl` — a skill loaded for two months and never once invoked is a candidate for `ccplug disable`
- Suggest, never act. This is one line of output feeding a tool that already exists

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Find the skills that actually load | 1.5h |
| Cost | 1h |
| Collisions | 2h |
| Lint and wiring | 1h |
| **Core total** | **5.5h (one weekend)** |
| Prune suggestions (optional) | 1h |

Phases 1-2 are **2.5h** and answer the question `ccplug` currently guesses at. Phase 3 is the half nothing else does. If skilldoctor's `lint` turns out to be good, Phase 4 is deleted rather than written — which is the correct outcome of Phase 0.

## Blockers / Risks

- **Building all four commands when upstream already ships two of them is the main way this wastes a weekend.** skilldoctor is MIT, 26★, and one `npx` away. Run it before writing a line. This project is `cost` and `collide`; the rest is a fallback if upstream disappoints.
- **Present ≠ loaded, by a factor of 25.** 1029 files on disk, ~130 in a session. Any report built on `rglob('SKILL.md')` is measuring the marketplace catalogue and the version cache, and its numbers will be confidently wrong. Read `enabledPlugins` from both `settings.json` and `settings.local.json` — this machine uses both, with a different list in each.
- **Similarity is not collision.** Jaccard will flag genuinely-distinct skills that share a domain vocabulary, and a report that is mostly false positives is deleted after two runs. The `--ignore` list is not a nicety; ship it in the same phase as the ranking.
- **The token number is an estimate and must be labelled as one.** `chars // 4` is fine for ranking and wrong for budgeting. Presenting it as exact invites a decision it cannot support.
- **The layout under `~/.claude` is not a stable interface.** `plugins/cache/<marketplace>/<plugin>/<version>/skills/` is a directory convention that can change with any release. Keep discovery in one function, and make it fail loudly with the paths it tried rather than quietly reporting zero skills.
- **Skills arrive from the internet and can carry instructions.** That is what skilldoctor's `audit` is for, and it is a real concern with 479 marketplace skills sitting on this disk — but do not read skill *bodies* into a model as part of any of this. The linter reads them as text and never as instructions.
- Upstream is one day old with 26★ and 2 forks. It may well grow `cost` and `collide` itself, at which point the right move is to file an issue and delete this.

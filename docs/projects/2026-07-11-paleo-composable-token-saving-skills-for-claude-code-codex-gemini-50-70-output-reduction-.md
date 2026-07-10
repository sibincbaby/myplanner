# paleo — Composable Token-Saving Skills for Claude Code / Codex / Gemini (~50-70% Output Reduction)

**Source:** <https://github.com/mocasus/paleo>
**Discovered:** 2026-07-11
**Viability:** 3/4

> Claude/LLM tooling + dev-productivity skill pack directly usable in the user's Claude Code workflows; conceptually adjacent to the seen token-diet project but a fresh, composable-skills take.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

This is a pure prompt/skill-level toolkit (six markdown-defined skills for terse output, context trimming, token budgeting, compression, etc.) with no API deps or code changes, so a focused MVP of the core few skills is trivially achievable in a single Claude session — weekend_buildable=1. The user's profile is saturated with Claude/LLM tooling (openclaw, claw-desk, ccplug, and heavy per-project context-cost management like the ccplug skill they already use), and given they run daily discovery workflows burning tokens constantly, a token-reduction skill layer fills a real gap and would plausibly be invoked every day — fills_gap=1, daily_utility=1. It scores 0 on novel: this is a well-trodden space (existing Claude Code output-style/terse presets, context-editing, prompt-compression tools like LLMLingua) and the user already has ccplug/skillOverrides tooling doing adjacent context-cost work, so it is not meaningfully distinct from mature alternatives. Total 3 → viable, but it is more of a build-your-own-preset weekend project than a novel breakthrough.

---

## Implementation Plan

I have enough detail to write a Claude-executable plan for building a paleo-style skill pack.

## Overview

`paleo` is a pack of six pure-prompt "skills" — Markdown files with YAML frontmatter that Claude Code loads and activates via natural-language triggers — that cut agent output/context tokens by a median ~53% with no code, no API calls, and no system-prompt edits. This plan builds a personal reimplementation: a `skills/` tree of `SKILL.md` files (terse output, context trimming, hard token budgeting, conversation compression, tool-output summary, JSON minification), a Claude Code plugin manifest so they install into your workflow, a lightweight benchmark harness to quantify the reduction, and an installer. Because it is entirely prompt-level, the hard work is prompt authoring and measurement rigor, not engineering. It slots directly into your token-heavy daily-discovery workflows alongside `ccplug`.

## Stack Recommendation

- **Skill format:** Markdown + YAML frontmatter (`name`, `description`) per `skills/<name>/SKILL.md` — the Claude Code / Agent Skills convention. No runtime.
- **Packaging:** `.claude-plugin/plugin.json` (Claude Code plugin marketplace format) so `claude` picks the skills up per-project; optional `gemini-extension.json` for cross-agent parity.
- **Benchmark harness:** Node.js 20 + `@anthropic-ai/tokenizer` (or `tiktoken` as a proxy) for token counting; a small script that runs paired prompts (paleo-on vs paleo-off) and reports median % reduction. Use the `gateway-endpoint`/`devgate` skill so benchmarks hit a local OpenAI-compatible endpoint instead of burning real API keys during development.
- **Installer:** POSIX `sh` script (`install.sh`) that copies skill dirs into `~/.claude/skills/` or a project `.claude/skills/`, matching your existing repo's shell conventions.
- **Docs:** `README.md`, `INSTALL.md`, `BENCHMARK.md`.

Rationale: the reference project is prompt-only; adding a JS/Python runtime would be over-engineering. Node is only for the optional benchmark, where accurate tokenization matters and the Anthropic tokenizer is authoritative.

## MVP Scope

**In:** Three highest-value skills authored and installable into Claude Code — `paleo` (terse output), `paleo-summary` (compress tool output/logs/diffs), `paleo-json` (minify JSON). Plugin manifest + `install.sh`. A minimal benchmark proving >40% reduction on a sample set.

**Out (fast-follow):** `paleo-trim-context`, `paleo-budget`, `paleo-converse` (these depend on the agent actually acting on mid-conversation instructions and are harder to benchmark deterministically); Gemini/40-agent cross-compat; marketplace publishing.

Success = in a real Claude Code session, saying "paleo mode" measurably shortens subsequent responses without dropping code/identifiers, and the benchmark script prints a median reduction number.

## Implementation Phases

### Phase 1: Repo scaffold + core `paleo` skill
**Goal:** A repo with the three MVP `SKILL.md` files present, correctly frontmattered, and loadable by Claude Code.
**Files to create/modify:**
- `skills/paleo/SKILL.md` — terse-output skill: cut prose ~50-70%, preserve code/identifiers/numbers verbatim, triggers "paleo mode", "be brief", "save tokens".
- `skills/paleo-summary/SKILL.md` — compress tool output, logs, diffs into bullet summaries; triggers "tldr", "summarize output".
- `skills/paleo-json/SKILL.md` — emit minified JSON (no whitespace, no trailing prose) when structured output is requested; triggers "minify json", "compact json".
- `README.md` — one-paragraph overview + skill table.
- `.gitignore` — Node `node_modules/`, benchmark artifacts.
**Key steps:**
1. `mkdir -p skills/{paleo,paleo-summary,paleo-json}` at repo root.
2. Author each `SKILL.md` with frontmatter `---\nname: <skill>\ndescription: <one-line, trigger-phrase-rich>\n---` followed by <30 lines of terse rules. For `paleo`, encode explicit invariants: never abbreviate code, file paths, error messages, CLI flags, numbers, or API names; drop hedging/preamble/restating the question; prefer tables/bullets over paragraphs.
3. Keep each skill body itself terse (dogfood the concept — the skill file is loaded into context, so its own size counts).
4. Write `README.md` with a 3-row skill table and the "never touches system prompts" note.
**Verify:** `ls skills/*/SKILL.md` lists 3 files; `grep -l "^name:" skills/*/SKILL.md` returns all 3; each frontmatter parses with `python3 -c "import yaml,sys; yaml.safe_load(open(f).read().split('---')[1])"` for each file.

### Phase 2: Claude Code plugin manifest + installer
**Goal:** The skills install into a Claude Code project (or `~/.claude/skills/`) and appear as available skills.
**Files to create/modify:**
- `.claude-plugin/plugin.json` — plugin manifest declaring name, version (`0.1.0`), and skill paths.
- `install.sh` — copies skill dirs to a target skills folder; supports `--global` (→ `~/.claude/skills/`) vs default project (`.claude/skills/`).
- `INSTALL.md` — per-target instructions (plugin vs manual copy).
**Key steps:**
1. Inspect an existing local skill layout to match the exact expected manifest schema: `ls ~/.claude/skills` and read one nearby plugin's `.claude-plugin/plugin.json` if present (e.g. under `~/.claude/plugins`) to copy the real field names rather than guessing.
2. Write `plugin.json` referencing the `skills/` directory per that schema.
3. Write `install.sh` using `cp -r`, with an arg parse for `--global`, creating the target dir with `mkdir -p`, and echoing what it copied. Make it idempotent (overwrite existing).
4. `chmod +x install.sh`.
5. Document both the `npx skills add`-style and manual-copy paths in `INSTALL.md`.
**Verify:** `sh install.sh --global` then `ls ~/.claude/skills/paleo/SKILL.md` succeeds; start `claude` in a scratch dir and confirm the skill names appear in the available-skills list (or `claude` loads without manifest errors).

### Phase 3: Benchmark harness
**Goal:** A script that measures token reduction on a fixed prompt set and prints a median % figure.
**Files to create/modify:**
- `bench/prompts.jsonl` — 8-12 representative tasks (explain code, summarize a diff, return JSON, describe an error) with a `paleo` flag column.
- `bench/run.mjs` — Node script: for each prompt, call the model twice (baseline vs paleo-instruction prepended), tokenize both outputs, compute per-prompt reduction and overall median.
- `BENCHMARK.md` — methodology + how to reproduce.
- `package.json` — deps `@anthropic-ai/tokenizer`, run script `bench`.
**Key steps:**
1. `npm init -y`; `npm i @anthropic-ai/tokenizer`.
2. Set up a dev LLM endpoint via the `gateway-endpoint` skill (devgate) so `run.mjs` calls a localhost OpenAI-compatible URL — avoids real API keys during dev.
3. In `run.mjs`, read `prompts.jsonl`, for each: request baseline completion, then request with the `paleo` skill body prepended as a system/context preamble; count output tokens for each; store `(baseline, paleo, pct)`.
4. Compute and print median reduction and a per-skill breakdown table; exit nonzero if median < 40% (regression guard).
5. Record the run's numbers and method in `BENCHMARK.md`.
**Verify:** `node bench/run.mjs` prints a table and a line like `median reduction: 5X%`; exit code 0 when ≥40%.

### Phase 4: Remaining three skills + dogfood tuning
**Goal:** All six skills present, and the pack self-tested against the benchmark to confirm no accuracy loss on code/identifiers.
**Files to create/modify:**
- `skills/paleo-trim-context/SKILL.md` — proactively summarize old conversation turns; trigger "trim context".
- `skills/paleo-budget/SKILL.md` — enforce a hard token cap ("budget 2000"), summarize/refuse-verbose when exceeded.
- `skills/paleo-converse/SKILL.md` — condense old turns, merge duplicate messages; trigger "condense chat".
- `bench/prompts.jsonl` — add cases that stress identifier/number preservation.
**Key steps:**
1. Author the three remaining `SKILL.md` files, each terse, with explicit trigger phrases in `description` so natural-language activation works.
2. Add an accuracy check to `bench/run.mjs`: assert that any code fence, file path, or numeric literal present in the baseline output also appears verbatim in the paleo output; fail the run on mismatch.
3. Iterate on skill wording where the accuracy check fails (e.g. tighten "preserve verbatim" clauses).
4. Update `README.md` table to six rows.
**Verify:** `ls skills/ | wc -l` = 6; `node bench/run.mjs` passes both median-reduction and identifier-preservation checks; manual smoke test in `claude`: "paleo mode, summarize this diff" yields a short, code-accurate response.

## Estimated Effort

**2-3 Claude Code sessions.**
- **Session 1:** Phases 1-2 — scaffold, author the three MVP skills (prompt-authoring is the real work here), write the plugin manifest against the real local schema, and the installer. Ends with skills installable into Claude Code.
- **Session 2:** Phase 3 — stand up the devgate endpoint, build the benchmark harness, and produce a first credible reduction number. This is the session most likely to eat time (tokenizer/endpoint wiring, prompt-set design).
- **Session 3 (optional):** Phase 4 — remaining three skills plus accuracy-guard tuning and docs polish. Can be folded into Session 2 if the benchmark comes together fast.

## Potential Blockers

- **Plugin manifest schema drift:** The exact `.claude-plugin/plugin.json` field names / skill-discovery mechanism may differ from what's assumed. Mitigation: Phase 2 step 1 reads a real installed plugin's manifest locally instead of guessing; if no local example exists, fall back to plain manual copy into `~/.claude/skills/` (which needs no manifest).
- **Benchmark needs model calls:** Measuring reduction requires actual LLM outputs. Real Anthropic/OpenAI keys would cost tokens and add auth friction. Mitigation: use the `gateway-endpoint`/`devgate` skill for a keyless local endpoint during dev; only swap to a real key if final published numbers must use a specific production model.
- **Tokenizer fidelity:** `@anthropic-ai/tokenizer` may lag the current model's tokenizer, making absolute counts approximate. This is fine for *relative* reduction (baseline vs paleo counted the same way); document the tokenizer version in `BENCHMARK.md` and don't over-claim absolute token totals.
- **Mid-conversation skills are hard to benchmark:** `paleo-trim-context`, `paleo-budget`, and `paleo-converse` act on live conversation state, which a single-shot benchmark can't fully exercise. Mitigation: benchmark them via synthetic multi-turn transcripts, and treat their validation as primarily manual smoke-testing in a real `claude` session.
- **Accuracy regressions:** Aggressive terseness can silently drop an error code, flag, or number. The Phase 4 identifier-preservation assertion is the guardrail; without it, this is the most likely way the pack quietly harms output quality.
- **Non-interactive MCP auth (this environment only):** The `claude.ai HyperFrames` and `Whimsical` MCP servers need authorization and are unavailable here; irrelevant to this build but noted since they surfaced at session start.

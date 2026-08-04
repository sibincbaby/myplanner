# adhd-skill — ADHD-Friendly Coding Agent Output Formatter

**Source:** [github.com/ayghri/i-have-adhd](https://github.com/ayghri/i-have-adhd)  
**Stars:** 16,310 (+5,012 this week) · **Language:** Markdown/JSON · **License:** MIT  
**Date discovered:** 2026-08-04

## What it is

A Claude Code / Codex / Gemini skill that reformats AI responses to be immediately actionable. It enforces 10 communication rules: no preamble, lead with the answer, use numbered steps, show concrete next action, cut explanatory tangents.

The project adapts ADHD productivity principles from clinical research (_The Adult ADHD Tool Kit_) and applies them to AI output formatting. "ADHD-friendly output. No ADHD diagnosis needed!"

This is the smallest viable unit of the interest profile: a SKILL.md file you install once that makes every future Claude Code session more direct.

## Why it fits

- Core interest: **dev productivity** — the single biggest friction in Claude Code sessions is wading through preamble to find the actionable step
- Core interest: **Claude/LLM tooling** — improves the Claude Code experience without any API changes
- Weekend-buildable: the reference implementation already exists; building your own custom ruleset is 30 minutes
- Daily utility: every Claude Code session benefits immediately after install

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Install reference skill (minutes), or write your own ruleset in one sitting |
| fills_gap | 1 | No native Claude Code setting controls response verbosity at this granularity |
| novel | 1 | Applying clinical ADHD formatting heuristics to LLM output is a novel framing |
| daily_utility | 1 | Installed once, improves every session permanently |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
SKILL.md — single Markdown file with formatting rules
JSON config — optional per-project override
Claude Code skills directory (~/.claude/skills/)
```

No code, no dependencies. The skill is a set of natural-language instructions Claude follows.

## MVP Scope (1 Claude session)

Write a custom SKILL.md tuned to your own communication preferences:

1. Identify your top 5 frustrations with Claude Code outputs (verbose intros, repeated context, long explanations before the fix)
2. Write one rule per frustration in imperative form ("Start with the exact file and line number")
3. Add 3 positive rules (what you want MORE of — code blocks, numbered steps, confidence level)
4. Install as a Claude Code skill, test with 10 real prompts
5. Iterate: any rule that doesn't improve output gets rewritten or dropped

## Phases

### Phase 1: Install Reference Skill (30min)
- Clone `ayghri/i-have-adhd` or copy SKILL.md contents
- Place in `~/.claude/skills/adhd/SKILL.md`
- Verify Claude Code picks it up: `/skills list`
- Run 5 prompts you normally use, note which responses improve

### Phase 2: Personalise Ruleset (1-2h)
- Remove rules that conflict with your workflow
- Add rules specific to your stack (e.g., "For Python errors, always show the full traceback first")
- Add a rule for multi-step tasks ("Always show a numbered checklist of remaining steps at the end of each response")
- Keep total rules under 15 to avoid conflicts

### Phase 3: Project-Specific Overrides (1h)
- Create a `SKILL.md` in individual project `.claude/skills/` folders
- Project-specific rules override global (e.g., "This is a Flutter project; prefer Dart idioms over generic examples")
- Test project skill doesn't conflict with global skill

### Phase 4: Measure and Prune (ongoing)
- After 2 weeks of use, identify any rule that generated worse outputs
- Prune or rewrite; keep a `CHANGELOG.md` in the skill folder
- Share your tuned version publicly if it diverges significantly from upstream

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Install Reference | 0.5h |
| Personalise Ruleset | 1-2h |
| Project Overrides | 1h |
| Measure + Prune | ongoing |
| **Total** | **2.5-3.5h (1 session)** |

This is the fastest viable build on this list — fully usable in under an afternoon.

## Blockers / Risks

- Over-constraining rules can break complex tasks — add a "for debugging sessions, relax rules 3 and 7" escape hatch
- Some rules conflict: "be brief" + "show full traceback" needs a priority ordering
- The reference skill targets ADHD formatting; adapt language if your primary need is brevity, not neurodivergent-specific patterns
- Skills interact with other installed skills — if you have a verbose SKILL.md elsewhere, rules may cancel each other out; test in isolation first

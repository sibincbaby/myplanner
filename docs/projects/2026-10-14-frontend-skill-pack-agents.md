# frontend-design-pro — AI Agent Skill Pack with Machine-Enforced Frontend Quality Gates

**Source:** GitHub — https://github.com/Krishna-Modi12/frontend-design-pro  
**Install:** `npx skills add Krishna-Modi12/frontend-design-pro`  
**Discovered:** 2026-10-14

---

## Why it fits

Claude Code generates frontend code that works but often ignores accessibility, bundle size, and component-structure conventions. frontend-design-pro injects 19 on-demand skills (covering design systems, landing pages, React performance, and agent operations) and enforces 61 machine-checked constraints (17 AST + 44 regex) so the agent self-validates before presenting output. It plugs into Claude Code, Cursor, Codex, and Gemini CLI without changing your workflow — just `skills add` once and skills are referenced automatically. The constraint-enforcement approach is novel: most skill packs are prompts; this one has a validator that rejects non-conforming output before it reaches you.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | `npx skills add` installs in one command; extending with custom skills is additive Markdown + JSON |
| fills_gap | 1 | No quality-gated frontend skill pack in current toolkit; agent-generated UI code routinely misses accessibility and performance basics |
| novel | 1 | Machine-enforced constraint checking at skill level is a new pattern; not a YAGNI/generic prompt pack |
| daily_utility | 1 | Every frontend session with Claude Code benefits; reduces the review cycle for agent-generated component code |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **skills.sh** / `npx skills add` — the distribution mechanism; works on Claude Code 2.0+, Cursor, Codex, Gemini CLI
- **frontend-design-pro** (Krishna-Modi12) — the pack itself: 19 skills, 61 constraints
- Optional: fork the repo to add custom skills for your own design system tokens and component library

## MVP Scope

1. Install the pack into Claude Code via `npx skills add Krishna-Modi12/frontend-design-pro`
2. Run a real frontend task (e.g., "build a responsive pricing table component with dark mode and keyboard navigation") and observe which skills load and which constraints fire
3. Review the constraint report and verify it catches missing `aria-label`, improper key usage, or unminified assets

Not in MVP: writing your own skills, integrating with a custom design system, publishing a fork.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Install: `npx skills add Krishna-Modi12/frontend-design-pro`; inspect installed skill files in `~/.claude/skills/` | 20 min |
| 2 | Test on a real task: ask Claude Code to generate a complete React component (e.g., a modal with keyboard trap and focus management) | 1 h |
| 3 | Examine constraint output: how many of the 61 constraints fired? Were any false positives? | 30 min |
| 4 | Author one custom skill for your own design system (e.g., "always use `tokens.ts` spacing values, never hardcode px") | 1 h |
| 5 | Evaluate ROI: does the extra latency from constraint checking justify keeping the pack loaded by default? | 20 min |

**Total estimate:** ~3 h (1 Claude session)

## Blockers

- `npx skills add` requires Node.js 18+ and access to skills.sh registry; verify network access first
- The 61-constraint figure comes from a third-party aggregator (toolcenter.ai); actual constraint count and coverage should be verified in the repo's README or `constraints/` directory
- Some AST constraints may require `@babel/parser` or `typescript` as peer deps — check if they're auto-installed
- Machine-checked constraints increase agent response latency; may need to selectively disable heavy checks for quick tasks

## References

- GitHub: https://github.com/Krishna-Modi12/frontend-design-pro
- Original HN Show HN post: https://news.ycombinator.com/item?id=49396937
- skills.sh ecosystem: https://skills.sh
- Related: obra/superpowers (102k stars) for general agent skills methodology

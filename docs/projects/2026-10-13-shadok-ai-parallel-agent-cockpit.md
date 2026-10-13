# shadok-ai — Browser Cockpit for Parallel Claude Code Agents

**Source:** EveryDev.ai listing — https://www.everydev.ai/tools/shadok-ai  
**Tagline:** "Run multiple Claude Code sessions in parallel worktrees from a single browser UI"  
**Discovered:** 2026-10-13

---

## Why it fits

Running Claude Code in parallel means managing multiple terminal windows, tracking which agent is on which branch, and manually monitoring outputs. shadok-ai replaces that with a single browser cockpit: each agent gets its own git worktree and branch so writes never collide, parent agents are notified the instant a child finishes or blocks, and optional Telegram integration turns approvals into inline buttons. It uses your existing Claude subscription (no API key), installs with a single `npx shadok-ai` command, and is AGPL-3.0.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 0 | The tool runs in minutes (`npx shadok-ai`) but building a comparable cockpit from scratch is multi-week |
| fills_gap | 1 | No current tool provides a web UI for scheduling, monitoring, and coordinating parallel Claude Code sessions |
| novel | 1 | Worktree-per-agent + parent-child notification + scheduling in a single `npx` tool is a unique combination |
| daily_utility | 1 | Any day with more than one Claude Code task benefits directly from parallelism with oversight |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **shadok-ai** — `npx shadok-ai` (Node 20+, no database, no accounts)
- **Claude Code 2.1+** — existing subscription, no extra API key
- **Git worktrees** — created automatically per agent
- **Telegram bot** (optional) — for mobile approval/notification; the `configure-telegram` skill handles this

## MVP Scope

Install shadok-ai into one active project. Launch two parallel agents on the same codebase: one implementing a feature, one reviewing an existing module. Monitor from the cockpit. Evaluate whether the worktree isolation and completion notifications change the daily workflow.

Not in MVP: scheduled prompts, multi-user access, Telegram integration, sub-agent spawning.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | `npx shadok-ai` in a project repo; verify the browser cockpit opens and shows one idle agent | 30 min |
| 2 | Launch two parallel agents on different tasks; confirm worktree isolation (no file conflicts) | 1 h |
| 3 | Configure a scheduled prompt (e.g., daily lint+test run at 7 AM) using the v0.7.0+ cron feature | 1 h |
| 4 | Add Telegram bot for mobile notifications/approvals on a blocking prompt | 1 h |
| 5 | Assess fit: does the cockpit replace manual terminal juggling? Decide on permanent setup | 30 min |

**Total estimate:** ~4 h (1 Claude session)

## Blockers

- Node 20+ required
- No direct GitHub URL confirmed in public listings — install via `npx shadok-ai` and verify the correct package
- AGPL-3.0 license — cannot use in a proprietary product without releasing modifications
- v0.10 beta as of Aug 2026; expect rough edges
- Multi-user access noted in the listing but may require separate config

## References

- EveryDev.ai listing: https://www.everydev.ai/tools/shadok-ai
- llms.txt (API surface): https://www.everydev.ai/tools/shadok-ai/llms.txt
- Telegram skill reference: https://www.vibeindex.ai/skills/yeachan-heo/oh-my-claudecode/configure-telegram

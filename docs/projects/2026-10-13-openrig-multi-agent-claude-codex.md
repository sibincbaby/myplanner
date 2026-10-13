# OpenRig — Multi-Agent Harness for Claude Code + Codex

**Source:** GitHub — https://github.com/mvschwarz/openrig  
**Tagline:** "Run Claude Code and Codex as one coordinated multi-agent system"  
**Discovered:** 2026-10-13

---

## Why it fits

Running Claude Code and Codex as separate sessions is manual overhead: you switch tabs, copy context, re-explain state, and manually reconcile output. OpenRig treats them as a single programmable system — a dev pod (implementor + QA + frontend), a review pod (adversarial Claude vs Codex), and an orchestrator pair, all driven by YAML/Markdown config rather than hand-typing. The author published a Show HN in early October 2026 and it trended on GitHub continuously for two weeks, which is unusual for a harness this early-stage.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 0 | The harness is installable, but spinning up a working multi-agent pod still requires a few hours of config tuning |
| fills_gap | 1 | No current tool in the toolkit orchestrates Claude Code and Codex together with shared workspace and task handoffs |
| novel | 1 | Unified Claude + Codex coordination with a YAML pod model is a new pattern; not yet a template others clone |
| daily_utility | 1 | Every coding session that involves review, testing, or parallel workstreams benefits directly |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **OpenRig** (npm package, `mvschwarz/openrig` — check npm for the current install command)
- **Claude Code 2.1+** and **Codex CLI 0.144+** — both must be authenticated
- **YAML/Markdown** pod config — no database, no cloud accounts
- **Git worktrees** — each agent gets its own checkout so parallel writes don't collide

## MVP Scope

Configure one two-agent pod: Claude Code as implementor, Codex as reviewer. Feed a real feature task, let the pods run, review the handoff transcript. Don't build a custom orchestrator — use OpenRig's YAML config as-is.

Not in MVP: multi-pod scheduling, Telegram/Slack integration, custom handoff hooks.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Install OpenRig via npm; read the README and the Show HN thread; understand pod config syntax | 1 h |
| 2 | Create a minimal two-agent pod YAML (implementor + reviewer) for an existing project | 1 h |
| 3 | Run a real task: a small refactor or a new feature, let both agents run, capture the transcript | 2 h |
| 4 | Review quality of cross-agent handoffs; adjust config, try a QA sub-agent | 1 h |
| 5 | Evaluate daily workflow fit; decide whether to promote to default Claude Code setup | 30 min |

**Total estimate:** ~5.5 h (1 Claude session + manual review time)

## Blockers

- Both Claude Code and Codex CLI must be locally authenticated — separate subscriptions or API keys
- The YAML config layer described by the author may be ahead of the shipped version; check the README before assuming full coverage
- Early alpha: the author notes the config layer "is ahead of what's shipped," so expect gaps
- No community support yet; debugging requires reading source directly

## References

- GitHub: https://github.com/mvschwarz/openrig
- Show HN: https://hn.svelte.dev/item/47772935
- Coverage: https://aitoolly.com/ai-news/article/2026-09-30-openrig-launches-as-an-open-source-multi-agent-framework-unifying-claude-code-and-codex-into-one-sys

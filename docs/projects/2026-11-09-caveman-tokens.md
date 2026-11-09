# caveman — Token-Reduction Wrapper for Coding Agents

**Source:** [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) (GitHub, TypeScript/Python/Go, Apache-2.0 + MIT, 118k★, started April 2026)
**Score:** 3/4 (WB 1 · FG 1 · N 0 · DU 1)
**Shape:** install-and-tune. caveman is a mature, well-documented tool (118k stars). The value is installing it for your Claude Code workflow, running it for a week, and measuring actual token savings before deciding whether to build a custom variant.

## Why this one

Claude Code sessions cost real money, and verbose model responses (long explanations, repeated context, bloated tool output) account for a significant fraction of that cost. caveman attacks this from two angles: making the model say less (a terse "caveman" response style) and compressing what the model reads (tool output, logs, JSON, test results).

The project reports 33.2% fewer input tokens and 54% lower cost with Auto (model routing) across whole sessions. Those numbers come from caveman's own benchmarks, not independent audits, but the mechanism is straightforward enough to verify: run with and without it on the same task.

**Why FG=1:** Token costs and verbose responses are a real daily frustration. After headroom (79.2k★, already seen), caveman is the second-most-starred tool in this space and focuses more on response brevity than headroom does.

**Why N=0:** headroom was seen earlier this week and targets the same problem. caveman has more stars and broader language support, but the core pitch (use fewer tokens) is not novel in this context.

**Why WB=1:** Install is `npm install -g @caveman-ai/cli` or `npx caveman`. Add it to Claude Code's config. The initial setup is under 10 minutes. If you want a custom variant, the core "inject terse style prompt" is a one-hour build.

**Why DU=1:** Every Claude Code session that generates verbose output benefits.

## Stack recommendation

- **caveman CLI** (`@caveman-ai/cli`, npm, Node.js 22.13+) — the tool itself
- **Claude Code** — configure via CLAUDE.md or `~/.claude/settings.json`
- **caveman wrap** — the launcher command for Claude Code integration

## MVP scope

Install, configure, and baseline:
1. `npm install -g @caveman-ai/cli`
2. `caveman wrap claude` — this sets `ANTHROPIC_BASE_URL` to caveman's local proxy and launches Claude Code
3. Run three representative coding tasks with and without caveman; compare token counts in the Claude Code usage summary
4. If savings are real, add `caveman wrap` as your default alias for `cc`

Out of scope (MVP): Caveman Cloud (tracing + evals), custom compressors, Auto model routing (requires a caveman account).

## Phases

1. **Install and baseline (30 min).** Install caveman, run `caveman wrap claude`, complete one real task. Check token usage in Claude Code's `/cost` command. Record baseline with and without caveman on the same task.
2. **Configure compressors (30 min).** Edit `~/.caveman/config.yaml` to tune which compressors run (JSON, code, logs). Disable any that produce garbled output for your typical codebase.
3. **Custom terse prompt (1 session, optional).** Fork the terse-style system prompt to match your preferences. The default caveman voice may be too abbreviated for tasks that require clear reasoning steps. Add a switch in your alias: `ccv` for caveman mode, `cc` for standard mode.
4. **Measure over a week (ongoing).** Check the daily cost from `~/.claude/stats` (or equivalent). After 7 days, compare vs. the baseline week. If savings < 15%, decide whether to continue.

## Effort

Install + baseline: 1 hour. Full configuration: 1 session.

## Blockers / risks

- **Output quality degradation:** some tools require verbose model responses to function correctly (e.g., multi-step planning). The terse style prompt may break these. Mitigate with a per-project CLAUDE.md that overrides the caveman style for planning-heavy tasks.
- **Node.js version:** requires Node.js 22.13+. Run `node --version` before installing.
- **caveman Cloud dependency:** Auto model routing requires a caveman account. The free tier exists; the full routing product requires a paid plan. Use caveman without Auto for a purely local setup.
- **Interaction with billion-context:** if you run both billion-context (which also proxies the API) and caveman (which also proxies the API), you need to chain the proxies. Test carefully; some proxy pairs conflict.

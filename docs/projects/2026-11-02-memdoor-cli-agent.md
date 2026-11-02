# memdoor — model-agnostic coding agent: single binary, SSH access, YAML workflows

**Source:** [guregodevo/memdoor](https://github.com/guregodevo/memdoor) (HN: 325 points, Nov 1, 2026; Go CLI, Apache-2.0)
**Score:** 3/4 (WB 0 · FG 1 · N 1 · DU 1)
**Shape:** install-first. The memdoor binary is already built; the plan is to deploy it against real workflows and evaluate whether its YAML workflow engine replaces ad-hoc Claude Code sessions.

## Why this one

Memdoor is a lightweight coding and automation agent that ships as a single Go binary. Unlike Claude Code (Anthropic-only, interactive), memdoor is:

- **Model-agnostic:** works with Anthropic, OpenAI, Gemini, Ollama, llama.cpp, LM Studio, OpenRouter
- **Deterministic workflows:** YAML files that define steps, parallel branches, and human-approval gates — not just open-ended agent sessions
- **Remote-first:** run the gateway on any server over SSH; phone access over an E2E-encrypted link
- **Headless:** `memdoor run <workflow.yaml>` runs a task from CI, cron, or a script without a terminal UI

**Why FG=1:** Claude Code covers interactive coding sessions well, but memdoor fills two gaps: (a) scheduled/headless automation (nightly tasks, CI hooks) without requiring a human to babysit a session, and (b) multi-model workflows where some steps are cheap (Haiku) and some need full reasoning (Opus).

**Why N=1:** Deterministic YAML workflows that coordinate multiple LLM steps with a graph engine and human-approval gates are genuinely different from the "open-ended session" model of Claude Code and Cursor. Most coding agents are interactive; memdoor is scriptable.

**Why DU=1:** Daily automation candidates: nightly codebase health check, auto-PR-review summary, dependency update workflow, test-failure triage. All runnable headlessly on a schedule.

**Why WB=0:** The binary itself is built. But configuring providers, writing a first non-trivial YAML workflow, setting up the GitHub Action, and testing the remote SSH gateway is a full-day install project, not a half-day one.

## Stack

- **Runtime:** Go 1.25 single binary (`memdoor`)
- **Providers:** Anthropic, OpenRouter (all major models), Ollama, llama.cpp, LM Studio, Google, OpenAI
- **Workflow engine:** `mario` graph engine — YAML steps, parallel branches, `check:` exit conditions, `gate:` human approvals
- **Remote access:** E2E-encrypted link for phone; SSH for headless server
- **GitHub Action:** pre-built action for PR review, security review, test writing, release notes

## MVP scope

1. Install memdoor binary and configure the Anthropic provider
2. Run a first interactive session: `memdoor` in a real project, verify tool use (file read/write, shell)
3. Write a 3-step YAML workflow: read failing tests → diagnose cause → open a GitHub issue with the summary
4. Run it headlessly with `memdoor run diagnose-tests.yaml`
5. Evaluate: is the YAML workflow better than an equivalent Claude Code session for this task?

Out of scope (MVP): SSH gateway, phone link, multi-provider workflows, GitHub Action.

## Phases

1. **Install and provider setup (1h).** Download the binary, set `ANTHROPIC_API_KEY` (or OpenRouter key), run `memdoor --help`. Verify the provider config format from the README.
2. **First interactive session (1h).** Run `memdoor` in a project directory with a real task ("add docstrings to all public functions"). Verify file edit tools work and the session receipt is generated.
3. **First YAML workflow (1 session).** Write `diagnose-tests.yaml`: step 1 runs the test suite and captures output, step 2 asks the LLM to identify root causes, step 3 opens a GitHub issue. Run with `memdoor run`. Adjust the `check:` exit conditions until reliable.
4. **GitHub Action (1 session).** Add the pre-built PR review action to one repository. Let it run on an open PR. Compare its review quality to manual Claude Code review.
5. **Remote gateway (optional, 1 session).** Install memdoor on a VPS or Raspberry Pi. Access it from a phone via the E2E link. Test a task initiated from the phone.

## Effort

Install through first workflow: 1 day. GitHub Action integration: 2nd session. Full remote setup: 3rd session.

## Blockers / risks

- **YAML workflow learning curve:** The `mario` graph engine has its own syntax. Expect to spend time reading examples before the first workflow runs cleanly. The README's workflow examples are the best starting point.
- **Go binary trust:** Single-binary tools that make network requests and run shell commands deserve a code audit before connecting to sensitive repos. Check the Apache-2.0 source before giving it write access.
- **Model cost at scale:** Headless workflows that run on a schedule accumulate token costs quickly. Set spend limits on the OpenRouter account before enabling nightly cron jobs.
- **Session context limits:** Long coding tasks will hit context limits mid-workflow. The YAML `gate:` construct can pause for human review, but automatic context hand-off between steps is unverified. Test with a real long task before relying on it.

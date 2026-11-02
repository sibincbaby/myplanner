# Orkas — local-first desktop OS for a team of 16 specialist AI agents

**Source:** [Orkas-AI/Orkas](https://github.com/Orkas-AI/Orkas) (trending Nov 1–2, 2026; local-first desktop; MIT)
**Score:** 3/4 (WB 0 · FG 1 · N 1 · DU 1)
**Shape:** install-first. Orkas ships as a desktop application. The plan is to install it, connect it to local or Anthropic models, and evaluate it as a local alternative to cloud-based multi-agent products like Devin.

## Why this one

Orkas is a local-first desktop application that presents a "team" of 16 specialist AI agents — a planner, a coder, a reviewer, a debugger, a docs writer, a test writer, etc. — each with a defined role and tool access. You assign a project-level task; Orkas orchestrates the agents to complete it, keeping all execution on your machine.

**Why FG=1:** Cloud coding agents (Devin, SWE-agent-as-a-service) send your code to remote infrastructure and charge per task. Orkas runs locally with your own API keys. The current toolkit has no comparable local multi-agent coordinator — the closest is manually opening multiple Claude Code sessions and copying context between them.

**Why N=1:** A desktop-native, local-first multi-agent team with specialist roles and a visual agent-coordination UI is distinct from both the CLI tools (claude-mem, memdoor) and the cloud orchestrators (optio) in the current toolkit. The persistent desktop presence and local execution model are genuinely different.

**Why DU=1:** A complex project — e.g., "add OAuth2 to this app, write tests, update docs, open a PR" — currently requires multiple manual Claude Code sessions. Orkas would drive that end-to-end autonomously while you watch.

**Why WB=0:** Building Orkas from scratch is too complex. But installing and evaluating it is a half-day task.

## Stack (Orkas internals, from README/trending summaries)

- **UI:** Desktop app (likely Electron or Tauri)
- **Agent coordination:** 16 specialist agents with defined roles and inter-agent messaging
- **Model backends:** integrates with coding LLMs (exact provider list to be confirmed from README)
- **Local execution:** all file operations, shell commands, and agent loops run on-machine
- **Task assignment:** single natural-language task → planner agent → subtask allocation → specialist agents

## MVP scope

1. Install Orkas, connect to Anthropic API (or a local Ollama model)
2. Assign a real but bounded task: "add input validation to all POST endpoints in this Express app and write tests for each"
3. Watch the agent team execute: note which specialist agents activate, how they hand off work, and where they get stuck
4. Measure: how does the output quality compare to a single Claude Code session for the same task?

Out of scope (MVP): custom agent roles, multi-project, CI integration.

## Phases

1. **Install and setup (1h).** Clone or download the Orkas desktop app. Connect API keys. Browse the 16 agent roles to understand the team structure. Read the task assignment format.
2. **First task — bounded scope (1 session).** Pick a real codebase and a task that touches 3–5 files. Assign it to Orkas. Observe without intervening; take notes on agent handoffs and any failures.
3. **Evaluation vs. Claude Code (1 session).** Run the same task with a standard Claude Code session. Compare: output quality, time-to-complete, number of human interventions needed, token cost.
4. **Complex task — end-to-end (1 session).** Assign a multi-domain task: feature + tests + docs + PR. Note where Orkas succeeds and where it stalls.
5. **Integration decision.** Decide: does Orkas replace ad-hoc multi-session Claude Code work for complex tasks? If yes, set it up as the primary tool for greenfield features.

## Effort

Install + first evaluation: 1 day. Full comparative evaluation: 2 sessions.

## Blockers / risks

- **Model quality at 16-agent scale:** Coordinating 16 agents amplifies errors. One specialist agent's bad output propagates to dependents. Early evaluation will reveal whether the coordinator handles this gracefully or spirals.
- **Local resource requirements:** Running 16 agent calls in parallel with large context windows is expensive in API costs and time. Check whether Orkas uses a scheduling strategy to minimize concurrent calls.
- **Maturity:** Trending on Nov 1 suggests it's recently active, but the project may still be rough. Check the issue tracker for crash reports or incomplete agent implementations before investing time.
- **Privacy:** "Local-first" means code stays on your machine, but Orkas still calls the LLM API. If your codebase contains sensitive IP, confirm that no data is sent to any Orkas infrastructure (only the LLM provider).

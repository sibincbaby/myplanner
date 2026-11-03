# T3 Code — Unified Multi-Agent Control Plane

**Source:** [t3-oss/t3-code](https://github.com/t3-oss/t3-code) (GitHub trending Nov 1–2, 2026; 930→3094★ on Nov 2; MIT)
**Score:** 3/4 (WB 0 · FG 1 · N 1 · DU 1)
**Shape:** install-first. T3 Code is a polished, production-ready app from Theo Browne and the T3 team. Install it as your unified launcher for all agent CLIs and use it for a week before evaluating whether it replaces individual terminal sessions.

## Why this one

The "parallel coding agents" workflow is now common but fragmented: Claude Code in one terminal, OpenCode in another, Codex in CI, Gemini CLI for long context tasks. Each has its own terminal window, its own session state, and no shared visibility. T3 Code provides a unified desktop + web + mobile interface for launching, monitoring, and switching between all of them — using your own API subscriptions.

The desktop app is the primary interface; the mobile companion lets you monitor long-running agent tasks and approve permissions from your phone when away from your desk.

**Why FG=1:** The current friction is real: switching between agent terminals is disorienting, there's no single view of "what are all my agents doing right now," and approving a permission prompt on a remote machine requires SSH. T3 Code addresses all three.

**Why N=1:** opcode wraps Claude Code specifically. agent-deck and agent-of-empires are TUI-first. T3 Code is the only one that covers desktop + web UI + mobile companion across all major agent CLIs in a single MIT-licensed product from a credible team.

**Why WB=0:** T3 Code is a full-featured app; the user installs and uses it.

**Why DU=1:** If you run agents every day, the unified dashboard becomes your daily cockpit.

## Stack recommendation

T3 Code is self-contained:
- **Desktop app** (Electron or Tauri — confirm in repo): primary interface
- **Web companion** (Next.js, self-hosted or cloud): access from any browser
- **Mobile companion** (React Native or PWA): approval/monitoring from phone
- **Agent integration:** uses existing CLI installations (Claude Code, Codex, OpenCode, Cursor, Grok); T3 Code launches and monitors them, not replaces them
- **Own subscriptions:** T3 Code uses your existing Anthropic/OpenAI/Google API keys — no new billing relationship

## MVP scope

1. Install T3 Code from GitHub releases or `npm install -g t3-code`
2. Add your existing agent CLIs (Claude Code, Codex) to the app's CLI discovery settings
3. Run a Claude Code session from T3 Code's launch panel — verify it works identically to running `claude` directly
4. Launch a second agent (OpenCode or Codex) in parallel — confirm both sessions appear in the dashboard simultaneously
5. Try the mobile companion: open the web interface from your phone during a session, verify you can see session status

Out of scope (MVP): custom keybindings, agent-to-agent messaging, CI integration.

## Phases

1. **Install + first session (30 min).** Install and launch T3 Code. Add Claude Code as the first agent. Run a real task. Compare the experience to a raw terminal session.
2. **Parallel agents (1 session).** Set up two concurrent agent sessions for a real feature: Claude Code for implementation, OpenCode or Codex for tests. Monitor both from the T3 Code dashboard.
3. **Mobile monitoring (1 session).** Configure the web companion. Run a long background task (e.g., a refactor taking 20 minutes). Monitor and approve permissions from your phone. Evaluate whether this replaces the existing phone-based solution.
4. **Week-long evaluation (ongoing).** Run T3 Code as your primary agent launcher for a week. Note: what does it improve? What does it miss? Decide whether it replaces individual terminals or complements them.

## Effort

Install + first session: 30 minutes. Parallel agent setup: 1 session. Mobile companion: 1 session.

## Blockers / risks

- **CLI discovery:** T3 Code needs to know where each agent CLI is installed. If CLIs are in non-standard paths (e.g., inside a specific nvm version, or via mise), configure the binary paths manually in settings.
- **Session isolation:** T3 Code launches agent CLIs as subprocesses. Some agent CLIs assume they're running in an interactive terminal and behave differently as subprocess children. Test with a complex task (file edits + permission prompts) before relying on it.
- **Overlapping with opcode:** both T3 Code and opcode manage Claude Code sessions. If you're evaluating both, test them separately (one week each) rather than simultaneously — config conflicts are likely.
- **Repo URL uncertainty:** some sources attribute the repo to `pingdotgg/t3-code`, others to `t3-oss/t3-code`. Verify the canonical URL on GitHub before installing. The MIT license and Theo Browne authorship are confirmed across multiple sources.

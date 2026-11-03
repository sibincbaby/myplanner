# opcode — Tauri 2 Desktop GUI for Claude Code

**Source:** [winfunc/opcode](https://github.com/winfunc/opcode) (GitHub, updated Aug 28, 2026; surfaced via XDA article Nov 2026; MIT)
**Score:** 3/4 (WB 0 · FG 1 · N 1 · DU 1)
**Shape:** install-first. Download and run opcode as your primary interface for Claude Code sessions. The custom agent feature is the reason to install it — build one project-specific custom agent in the first week.

## Why this one

The current Claude Code workflow for power users involves multiple terminal windows, manual CLAUDE.md management, and no visibility into background agents running in other worktrees. opcode is a Tauri 2 + React 19 desktop app that wraps Claude Code with a proper GUI layer: sessions panel, custom agent builder, background agent management, and usage/cost tracking.

The custom agent feature is the standout: you define an agent's persona, tools, skill files, and default task in the UI. Each agent gets its own configuration, separate from `~/.claude/`. This lets you maintain distinct agents for distinct contexts (a "code reviewer" agent with strict mode, a "prototyper" agent with permissive settings).

**Why FG=1:** Claude Code has no native GUI. The terminal UX is fine for single sessions but becomes unwieldy when running 3+ agents in parallel or managing custom configurations per project. opcode fills this gap without requiring a web subscription.

**Why N=1:** Other Claude Code GUIs exist (claudecodeui, CCManagerUI) but opcode combines session management + custom agents + background agents + cost tracking in a single Tauri 2 app. The custom-agent builder with its own config namespace is the differentiating feature.

**Why WB=0:** opcode is a full desktop app. The user installs and uses it, not builds it.

**Why DU=1:** If you run Claude Code every day, opcode replaces the terminal for session management. Custom agents you configure once run daily.

## Stack recommendation

- **opcode** (Tauri 2 + React 19, MIT): primary interface; download from GitHub releases
- **Claude Code** (existing): opcode wraps it, so Claude Code must be installed and authenticated
- **Custom agents:** configured in opcode's UI; stored in `~/.opcode/agents/`
- **Usage tracking:** opcode logs token spend per session; check weekly to stay within budget

## MVP scope

1. Download and install opcode from GitHub releases
2. Launch it and verify it finds your existing Claude Code installation
3. Create one custom agent: a "code reviewer" agent configured with `--strict` mode and a specific review skill
4. Run a real code review session via the custom agent
5. Enable background agent mode for one long-running task; monitor from the sessions panel

Out of scope (MVP): multi-machine sync, team sharing, custom themes.

## Phases

1. **Install + first session (30 min).** Download opcode, verify Claude Code is found, run one session from the GUI. Confirm sessions panel shows status correctly.
2. **Custom agent setup (1 session).** Build one custom agent in the UI. Name it "reviewer", configure it with your standard review skill file and strict permissions. Test it on a branch that needs review.
3. **Background agent experiment (1 session).** Launch a longer task (e.g., "refactor module X") as a background agent via opcode. Switch to a different task in the foreground. Monitor background progress from the panel.
4. **Cost baseline (ongoing).** After two weeks, review the usage panel. Identify which task types cost the most. Adjust agent configurations to use cheaper models for routine tasks.

## Effort

Install + first session: 30 minutes. Custom agent build: 1 session. Background agent workflow: 1 session.

## Blockers / risks

- **Claude Code auth:** opcode uses the existing `~/.claude/` authentication. If Claude Code is not authenticated, opcode won't start agents. Authenticate via `claude login` first.
- **Tauri 2 runtime requirements:** requires WebView2 (Windows) or WebKit (macOS/Linux). On Linux, make sure `webkit2gtk` is installed.
- **Custom agent isolation:** agents in opcode share the same Claude Code binary and billing account. "Separate agents" means separate configs, not separate billing. Cost tracking is per-session inside opcode, not per-agent in Anthropic's dashboard.
- **Background agent resource use:** running multiple agents in the background concurrently consumes API quota fast. Start with one background agent at a time; set a per-session token budget in opcode's settings.

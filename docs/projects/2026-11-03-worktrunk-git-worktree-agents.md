# worktrunk — Git Worktree CLI for Parallel AI Agents

**Source:** [max-sixty/worktrunk](https://github.com/max-sixty/worktrunk) (GitHub trending Nov 1–2, 2026; Rust, MIT)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** install-first + extend. Install worktrunk, configure the Claude Code plugin, and use it as your default worktree manager for the next week. Then extend the commit-message prompt to match your codebase conventions.

## Why this one

Running parallel AI agents on the same repo is the single biggest workflow improvement available right now, but the friction is high: manually `git worktree add`, keeping track of which branch is in which directory, cleaning up after merged branches, and remembering to commit before switching. worktrunk automates the full lifecycle.

The Claude Code plugin is the key feature: `wt switch -c -x claude feat` creates a worktree and launches a Claude Code session inside it in one command. When the session ends, `wt remove` handles cleanup.

**Why FG=1:** The current workflow is: open a second terminal, manually `git worktree add ../feature-x feature-x`, cd into it, run claude, done. worktrunk replaces three error-prone manual steps with one command. The LLM-generated commit messages are a secondary win — agents often leave vague messages.

**Why N=1:** There are general worktree managers (git-worktree-utils, etc.), but none are purpose-built for AI agent workflows. The LLM commit-message generation and the Claude Code plugin are novel features for this space.

**Why WB=1:** Install takes under five minutes (Homebrew: `brew install max-sixty/worktrunk/wt && wt config shell install`). Extending the Claude Code plugin or writing a custom hook for project-specific conventions is a 1-session task.

**Why DU=1:** If you run even one Claude Code session per day, worktrunk becomes the default entry point. The cleanup and commit automation compound daily.

## Stack recommendation

- **worktrunk CLI** (Rust, available via Homebrew, Cargo, winget): core worktree management
- **Claude Code plugin** (built in to worktrunk): launches Claude inside the created worktree
- **LLM commit messages:** uses local model or API; configure in `~/.config/worktrunk/config.toml`
- **Hooks (optional):** project-level hooks that run after create or before remove — useful for copying `.env` files or running migrations

## MVP scope

1. Install worktrunk and run `wt config shell install` to add shell completion
2. Create your first agent worktree: `wt switch -c -x claude feat/my-feature`
3. Work on the feature in the Claude Code session
4. After the session: `wt commit` to auto-generate a commit message, then `wt remove feat/my-feature` to clean up
5. Configure LLM commit message generation to use Claude via the API

Out of scope (MVP): custom hooks, multi-repo coordination, CI integration.

## Phases

1. **Install + first worktree (30 min).** Install via Homebrew. Create one worktree for an in-progress feature. Verify the Claude Code plugin launches correctly. Confirm `wt list` shows the worktree and `wt remove` cleans it up.
2. **LLM commit messages (1 session).** Configure worktrunk to generate commit messages via Claude API. Tune the prompt template in the config file to match your preferred commit style (e.g., Conventional Commits, short imperative).
3. **Custom hooks (1 session, optional).** Write a `post-create` hook that copies `.env.local` into the new worktree and runs `npm install`. This removes the manual setup step for each new feature branch.
4. **Parallel workflow experiment (ongoing).** For the next real feature, open two worktrees: one for implementation (Claude Code) and one for tests (Claude Code). Merge in sequence. Measure actual time saved vs. single-branch workflow.

## Effort

Install + configure: 30 minutes. LLM commit extension: 1 session. Custom hooks: 1 session.

## Blockers / risks

- **Merge conflicts:** parallel worktrees on the same repo can produce conflicts if agents touch the same files. Mitigate by assigning clear file-system boundaries per agent (feature A owns `src/api/`, feature B owns `src/ui/`).
- **Shell compatibility:** `wt config shell install` adds shell integration for bash/zsh/fish. If using an unusual shell, the completion and `cd` shorthand won't work. Manual alias setup is documented.
- **LLM commit message API cost:** generating a commit message via Claude adds ~$0.001 per commit. Negligible for personal use, but configure a spending cap.
- **Windows support:** available via winget, but the Claude Code plugin is macOS/Linux first. Windows users should use WSL2.

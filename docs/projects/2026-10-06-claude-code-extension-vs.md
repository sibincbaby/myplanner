# ClaudeCodeExtension — Visual Studio .NET Extension for Claude Code

**Source:** <https://github.com/dliedke/ClaudeCodeExtension>
**Discovered:** 2026-10-06
**Viability:** 4/4

> A Visual Studio (.NET IDE, not VS Code) extension that provides a first-class interface for Claude Code, Codex CLI, Cursor Agent, OpenCode, Devin, Pi, Antigravity, and Reasonix. Features image/file paste directly into prompts, an inline diff viewer, automated post-completion actions, usage token tracking, full session history, and a quick-open shortcut. MIT license.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

VS Code has an excellent Claude Code integration; Visual Studio .NET does not. .NET/C# developers working in Visual Studio (enterprise backends, ASP.NET, WPF, MAUI) are stuck copy-pasting between a terminal and their editor. ClaudeCodeExtension closes this gap with features VS Code's integration doesn't even have: image paste into prompts, diff view, session history replay, and multi-agent support across 8 tools in one extension. Weekend-buildable because it's a download-and-install Extension Gallery item. Daily utility because every coding session improves.

---

## Implementation Plan

**One install** (no Claude Code session needed) plus a short configuration pass.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Install | Visual Studio Extension Marketplace | Standard VSIX install, auto-updates |
| Backend | Claude Code CLI (existing) | Extension shells out to Claude Code |
| Config | Extension settings panel | API key, tool selection, shortcut |
| Image workflow | Paste from clipboard into prompt | Drag-and-drop or Ctrl+V in prompt field |

---

## MVP Scope

1. Install ClaudeCodeExtension from Visual Studio Marketplace (search "ClaudeCodeExtension")
2. Set Claude Code path + Anthropic API key in extension settings
3. Open a .NET solution, use quick-open shortcut to launch the Claude Code panel
4. Ask Claude to explain a complex LINQ expression — verify inline diff view works
5. Paste a screenshot of an error and ask Claude to fix it — verify image paste works

Out of scope for MVP: multi-agent sessions, session history export, Codex/Devin routing.

---

## Implementation Phases

### Phase 1: Install + basic configuration

**Goal:** Extension installed, Claude Code wired up, quick-open shortcut active.

**Steps:**
1. In Visual Studio: Extensions → Manage Extensions → search "ClaudeCodeExtension" → Install
2. Restart Visual Studio (required for VSIX install)
3. Tools → Options → ClaudeCodeExtension: set `Claude Code Path` (e.g., `%APPDATA%\npm\claude.cmd`), `API Key`, `Default Model`
4. Bind keyboard shortcut: Tools → Options → Keyboard → search "ClaudeCode.OpenPanel" → assign `Ctrl+Shift+C`
5. Test: open a C# file, press shortcut → Claude Code panel should open in a tool window

---

### Phase 2: Image paste + diff viewer

**Goal:** Image paste and diff viewer working for real tasks.

**Steps:**
1. Copy a screenshot of a failing test output to clipboard
2. In the Claude Code panel prompt field, press Ctrl+V — screenshot should appear as an attached image
3. Ask: "This test is failing — what's wrong?" → confirm Claude Code receives the image
4. Ask Claude to refactor a method → accept suggestion → confirm inline diff opens showing before/after
5. Accept or reject the diff directly from the panel (no manual file edits needed)

---

### Phase 3: Session history + usage tracking

**Goal:** Session history and token usage visible across a day's work.

**Steps:**
1. After 2-3 conversations: ClaudeCodeExtension → Session History → browse prior sessions
2. Replay a session: click a past session → view the full conversation in read-only mode
3. Usage panel: check today's token count and estimated API cost
4. Export: Sessions → Export → JSON (for personal analytics or cost review)
5. Optional: set usage alert threshold in settings to get a notification when approaching a daily limit

---

## Estimated Effort

30 minutes install + configuration; zero build time.

- **10 min:** Extension install + VS restart
- **15 min:** Settings configuration + shortcut binding
- **5 min:** Smoke test with a real .NET file

## Potential Blockers

- **VS 2022 only:** The extension targets Visual Studio 2022. Visual Studio 2019 is not supported. Check `Help → About` before installing.
- **Claude Code CLI path:** The extension shells out to the Claude Code CLI. You need `claude` available in PATH or configure the absolute path in extension settings. Run `where claude` in a VS developer terminal to confirm.
- **VSIX trust prompt:** Visual Studio will ask to trust the extension on first install (not marketplace-signed). Review the source at the GitHub repo if your org has a signing policy.
- **Multi-agent routing:** The extension supports routing to 8 different agents (Claude Code, Codex, Devin, etc.). Start with Claude Code only; enabling multiple agents adds config complexity that isn't worth it until you've confirmed the basic flow.

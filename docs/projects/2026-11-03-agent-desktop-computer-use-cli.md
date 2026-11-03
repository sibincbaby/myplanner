# agent-desktop — Computer-Use CLI for Agents via Accessibility Trees

**Source:** [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) (GitHub trending Nov 1–2, 2026; Apache-2.0)
**Score:** 3/4 (WB 1 · FG 1 · N 1 · DU 0)
**Shape:** build-first. Don't use agent-desktop as an end product — use it as the foundation for a specific automation you've been doing manually. The most useful first build is a Claude-driven script for a desktop task you repeat weekly.

## Why this one

Computer-use for agents has two approaches: screenshot-based (Claude screenshots the screen, identifies UI elements, clicks) and accessibility-tree-based (the agent reads the native AT-SPI2/Accessibility API, gets structured element refs, acts on stable identifiers). Screenshot-based is easier to set up but brittle — UI element positions shift, icons get redesigned, retina vs. non-retina scaling creates coordinate errors.

agent-desktop takes the accessibility-tree approach: structured JSON snapshots of the UI with stable element refs. A ref for "the Save button in the Figma toolbar" stays stable across app updates as long as the button exists. Scripts written today work in six months.

**Why FG=1:** The main workaround today is using Claude's built-in computer-use (screenshot-based) or manually writing AppleScript/xdotool. agent-desktop provides a stable, programmatic CLI that any agent can call via `exec()`.

**Why N=1:** The structured-JSON + stable-refs approach is architecturally different from all screenshot-based tools. The npm global install + CLI interface makes it easily accessible to agents without native dependencies.

**Why WB=1:** `npm install -g agent-desktop` and then writing a 20-line script that snapshots an app, clicks a specific element, and waits for a state change is a well-scoped single session.

**Why DU=0:** Desktop automation is task-specific. You build a script once and run it repeatedly, but you don't build new automation scripts every day.

## Stack recommendation

- **agent-desktop CLI** (Node.js, Apache-2.0, global install): core accessibility-tree interaction
- **Claude Code + exec() call**: have Claude Code invoke `agent-desktop snap <app>` to get the AT snapshot, then call `agent-desktop click <ref>` to act
- **JSON output parsing**: the snapshot is structured JSON; Claude can navigate it to find the right ref without coordinates
- **Claude API (optional)**: for fully autonomous scripts, have a Claude call interpret the snapshot and decide the next action

## MVP scope

Build a single automation: pick one desktop task you do manually at least once a week (e.g., exporting a Figma frame, archiving processed emails, capturing a screenshot of a running app into a specific folder). Build the agent-desktop script for that one task.

The script structure:
1. `agent-desktop snap <AppName>` → JSON snapshot of current app state
2. Claude identifies target element ref from the snapshot
3. `agent-desktop click <ref>` → performs the action
4. Verify state change (repeat snap, check element state)

Out of scope (MVP): multi-app workflows, error recovery loops, Windows/Linux (macOS first via AT-SPI2 equivalent).

## Phases

1. **Install + first snapshot (30 min).** Install and run `agent-desktop snap Safari` (or any open app). Read the JSON output. Identify a button or input field ref in the snapshot. Click it via `agent-desktop click <ref>`.
2. **Target automation design (1 session).** Pick the real automation target. Write the script manually (no Claude yet): snap → find ref → act → verify. Make it work reliably 5 times in a row.
3. **Claude-driven version (1 session).** Replace the hardcoded ref logic with a Claude call: pass the JSON snapshot to Claude, ask it to identify the action element and return the ref, then execute. This makes the script resilient to UI changes — Claude re-identifies the element even if the ref changes.
4. **Claude Code integration (1 session, optional).** Add the automation as a custom tool in your Claude Code sessions. E.g., a `@capture_browser_state` tool that snaps the current browser and returns it as context for the coding session.

## Effort

First working script: 1 session. Claude-driven version: 1 session. Claude Code integration: 1 more session.

## Blockers / risks

- **macOS permissions:** accessibility tree access requires enabling "Accessibility" for the terminal app in System Preferences → Privacy. First-run setup takes 2 minutes but fails silently if missed.
- **App compatibility:** not all apps expose full accessibility trees. Electron apps (VS Code, Figma) have excellent coverage. Native Swift apps vary. Web apps via Safari are accessible. Check your target app before committing to it.
- **Ref stability:** the "stable refs" claim holds for most UI changes but breaks when apps rebuild their entire component tree (major version upgrades). Plan for re-mapping refs after major app updates.
- **Async state:** some actions trigger async state changes (file saves, network requests). The script needs explicit wait loops (`agent-desktop wait <ref> --state=enabled`) rather than fixed timeouts.

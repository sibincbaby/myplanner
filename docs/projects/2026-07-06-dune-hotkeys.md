# Dune Hotkeys — Context-Aware Claude Hotkey Daemon (Software)

**Inspired by:** [projectmirage.ai — Dune Keypad](https://www.projectmirage.ai/) (TechCrunch, Jul 2026)  
**Source:** Product Hunt Jul 2026 (46 upvotes) + TechCrunch hardware review  
**Interest score:** 3/4 (Claude/LLM tooling + agent UIs + dev productivity)

## What It Is

The Dune Keypad is a $119 CNC-aluminium 3-key MacBook peripheral that detects the foreground app and reconfigures its keys to trigger context-aware Claude MCP workflows. The "Build with Claude" mode lets users describe an action in plain English and the keypad generates an agentic trigger for it — no programming required.

## Why Build Your Own

You don't need $119 hardware to get the same core idea. A **software daemon that watches the active macOS application and rebinds system-wide hotkeys to Claude Code / MCP commands** delivers 80% of the Dune experience at zero cost. Global hotkeys already exist in every OS — the gap is the context-aware dispatch layer and the Claude integration. Owning the stack means: unlimited "keys" (any hotkey combo), custom commands per app that Dune's marketplace never ships, and a private workflow store.

## Stack Recommendation

- **Swift + `NSWorkspace` + `Carbon` (RegisterEventHotKey)** — watch frontmost app, register global hotkeys without accessibility permissions
- **`Claude API (claude-haiku-4-5)` (fast, cheap)** — turn a user's plain-English description into a structured MCP tool call when setting up a new shortcut
- **JSON config** — store `{app_bundle_id → [{hotkey, mcp_call}]}` mappings; hot-reload on change
- **Claude Code MCP client / `claude` CLI** — execute the mapped command when a hotkey fires
- **SwiftUI menubar app** — show active profile, edit bindings, display last command result

## MVP Scope

A menubar Swift app that watches `NSWorkspace.didActivateApplicationNotification` to know the frontmost app, registers up to 3 global hotkeys, and dispatches a configured `claude -p "<prompt>"` command when a hotkey fires. A JSON config file defines which hotkeys map to which prompts per app bundle ID. A "describe it" text field lets you type what you want a hotkey to do; Claude reformulates it into a structured prompt and saves it to the config.

---

## Implementation Phases

### Phase 1 — Global Hotkey Registration + App Watching
**Goal:** Press Cmd+Shift+1 in any app and see the active app's bundle ID logged to the console.

**Files:**
- `DuneHotkeys/AppDelegate.swift` — menubar agent, `NSWorkspace` observer
- `DuneHotkeys/HotkeyManager.swift` — `Carbon` `RegisterEventHotKey` wrapper; fires a callback on press

**Key steps:**
1. Request no special permissions — `Carbon` global hotkeys work without accessibility access
2. Observe `NSWorkspace.shared.notificationCenter` for `didActivateApplicationNotification`
3. On activation, update `activeApp` (bundle ID + name); log it
4. Register three fixed hotkeys (Cmd+Shift+1/2/3); on press, print `{hotkey, activeApp}`

**Verify:** Switch between Terminal and VS Code; press Cmd+Shift+1 in each — console shows the correct bundle ID for each app.

---

### Phase 2 — JSON Config + Command Dispatch
**Goal:** Hotkey fires a configured shell command for the active app, with a fallback global default.

**Files:**
- `DuneHotkeys/ConfigLoader.swift` — watch `~/Library/Application Support/DuneHotkeys/config.json` with `DispatchSource.makeFileSystemObjectSource`
- `DuneHotkeys/Dispatcher.swift` — resolve hotkey+app → command; run via `Process`
- `config.json` schema: `{global: {…}, apps: {"com.apple.Xcode": {…}}}`

**Key steps:**
1. JSON shape: `{"1": {"prompt": "Explain the selected code", "mode": "claude-cli"}}` per hotkey index
2. Merge: app-specific config wins over global fallback
3. Dispatcher spawns `claude -p "<prompt>"` as a background `Process`; captures stdout to show in a brief notification
4. Hot-reload config on file change — no restart needed

**Verify:** Add a VS Code mapping for hotkey 1 → "list changed git files"; switch to VS Code, press Cmd+Shift+1 → a notification shows the output of `claude -p "list changed git files"`.

---

### Phase 3 — Plain-English Shortcut Builder
**Goal:** Describe what you want in a text field; Claude writes the prompt and saves it to config.

**Files:**
- `DuneHotkeys/SetupView.swift` — SwiftUI form: app selector, hotkey picker, description field, Save button
- `DuneHotkeys/PromptBuilder.swift` — sends description to Claude API; returns a refined prompt string

**Key steps:**
1. User selects the target app from a list of running apps, picks hotkey 1/2/3, types "summarise what I was just working on"
2. Send to `claude-haiku-4-5`: "Convert this user description into a concise Claude Code prompt (≤ 20 words, imperative): {description}"
3. Show the refined prompt for approval, then write it to config.json
4. Display a preview: "When you press Cmd+Shift+2 in Xcode, Claude will: 'Summarise recent file changes in this repo'"

**Verify:** Type "tell me what this function does" for VS Code hotkey 2 → Claude refines to "Explain the selected function's purpose and parameters" → saved to config → fires correctly.

---

### Phase 4 — Result Overlay
**Goal:** Show command output as a non-intrusive floating overlay instead of a system notification.

**Files:**
- `DuneHotkeys/OverlayWindow.swift` — borderless, click-through `NSPanel` anchored to top-right

**Key steps:**
1. After `claude` exits, pipe stdout to the overlay; animate it in (0.2s fade), auto-dismiss after 8s or on keypress
2. If output > 300 chars, truncate with "⌘ click to expand in Terminal"
3. Clicking expands a full NSPanel with scrollable output and a copy button

**Verify:** Fire a hotkey that runs a query returning multi-line output → overlay appears within 1s, shows the first ~300 chars, dismisses cleanly.

---

### Phase 5 — Profile Import / Export
**Goal:** Share hotkey profiles as single JSON files; browse a community library.

**Files:**
- `DuneHotkeys/ProfileManager.swift` — import/export profile JSON; validate schema before applying
- Optional: `profiles/` directory of bundled starter profiles (Xcode, VS Code, Finder, Terminal)

**Starter profiles to ship:**
- Xcode: Explain selected code / Run tests / Commit with AI message
- VS Code: Explain file / List TODOs / Generate PR description
- Terminal: Explain last command / Fix last error / Summarise git log

**Verify:** Export profile, delete config.json, import profile → all hotkeys restore correctly.

---

## Estimated Effort

**1.5 Claude sessions.** Phase 1+2 (hotkeys + dispatch) are the trickiest: ~2 hours to get Carbon hotkey registration right on modern macOS. Phase 3 (Claude builder) is ~45 min. Phase 4 (overlay) is ~1 hour. Phase 5 is ~30 min.

## Potential Blockers

- **Carbon hotkey conflicts**: `RegisterEventHotKey` will silently fail if another app owns the combo. Detect the failure and offer fallback combos (Ctrl+Opt+1 etc.) rather than crashing.
- **Sandboxing**: a Mac App Store build cannot use Carbon global hotkeys without special entitlements. Distribute as a direct download `.app`, not via the App Store.
- **`claude` CLI path**: `Process` inherits a minimal env; hard-code or auto-detect the path to the `claude` binary (`/usr/local/bin/claude` or `~/.claude/local/claude`).
- **Command output latency**: Claude calls take 2–5s. Run the dispatch async and show a spinner in the overlay immediately on hotkey press so the UX doesn't feel broken.
- **Prompt injection via app title**: if the active app's window title is included in the prompt, a malicious website title could hijack the command. Never embed untrusted text directly in prompts.

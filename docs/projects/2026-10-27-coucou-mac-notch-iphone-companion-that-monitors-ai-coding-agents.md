# coucou — Mac notch + iPhone companion that monitors AI coding agents

**Source:** <https://github.com/Louis-CFM/coucou>
**Discovered:** 2026-10-27
**Viability:** 3/4

> Persistent ambient monitoring of Claude Code sessions without context-switching. Addresses the agent UI and dev productivity interest areas directly. The iPhone companion side aligns with the Flutter/mobile background.

## Viability Scores

| Criterion | Score | Reasoning |
|-----------|-------|-----------|
| Weekend-buildable | ❌ 0 | Two distinct native platform targets (Swift macOS + Flutter iOS) with real-time LAN sync — MVP realistically needs 3-4 focused sessions, not 1-2 |
| Fills gap | ✅ 1 | User runs long Claude Code sessions; a persistent ambient view of cost, token burn, and "waiting on input" state directly addresses their daily workflow without context-switching |
| Novel | ✅ 1 | Agent-specific notch monitoring with iPhone mirror is a fresh concept; no mature well-maintained alternative for AI-agent status dashboards |
| Daily utility | ✅ 1 | Anyone running multiple concurrent Claude Code sessions every day would open this constantly |

**Total: 3/4 — Viable**

---

## Overview

A two-target project: a macOS menubar/notch-overlay app that reads Claude Code and Codex session data from local files, and a Flutter iPhone companion that receives live updates over a local WebSocket. The Mac side does all the heavy lifting (file watching, parsing, serving); the iPhone side is a read-only display client. Communication is LAN-only via Bonjour discovery + WebSocket — no cloud account needed.

---

## Stack Recommendation

- **Mac app**: Swift 5.9 + SwiftUI + AppKit — `NSPanel` borderless overlay positioned at the notch + `NSStatusItem` fallback for non-notch Macs. `FSEventStream` for file watching. `Network.framework` for WebSocket server + Bonjour advertisement.
- **Agent data source**: Claude Code writes JSONL to `~/.claude/projects/<hash>/`. Codex writes to `~/.codex/`. Both are file-system observable with no IPC needed.
- **iPhone companion**: Flutter 3.x with `web_socket_channel` + `multicast_dns` (or hardcoded IP fallback). Single-screen live dashboard.
- **IPC format**: JSON over WebSocket. Schema shared as a plain struct file on both sides.

---

## MVP Scope

- Mac app reads Claude Code session files and shows: current task description, cumulative cost (USD), token counts (input/output), and a "waiting" indicator when the agent is blocked on tool approval or user input.
- iPhone app connects over LAN and mirrors exactly those four fields.
- No authentication, no cloud relay, no multi-user. Single active session at a time for MVP.

---

## Implementation Phases

### Phase 1: Agent Data Extraction (Mac CLI)

**Goal:** A command-line Swift script that prints the current Claude Code session's task, cost, and token usage to stdout by parsing `~/.claude/` JSONL files.

**Files to create/modify:**
- `mac/Sources/SessionParser.swift` — reads and parses Claude Code JSONL session files
- `mac/Sources/AgentMonitor.swift` — finds the most-recently-modified session directory, returns an `AgentSession` struct
- `mac/Sources/main.swift` — CLI entry point that prints a JSON snapshot and exits
- `mac/Package.swift` — Swift package manifest, executable target, no external deps

**Key steps:**
1. Run `ls -lt ~/.claude/projects/` to understand the directory layout; each subdirectory is a project keyed by a hash of the path. Inside each project dir, session files are `.jsonl` with one JSON object per line.
2. In `SessionParser.swift`, scan lines for objects with `"type": "assistant"` containing `usage` fields (`input_tokens`, `output_tokens`, `cache_read_input_tokens`) and `"type": "tool_use"` lines to infer the current task.
3. Cost calculation: Claude Sonnet 4 is $3/$15 per MTok in/out. Apply token counts with a hardcoded rate table keyed on the `model` field found in JSONL.
4. Detect "waiting on input" by checking if the last non-empty line has `"type": "tool_result"` or `"type": "human"` with no subsequent `"type": "assistant"`.
5. In `main.swift`, call `AgentMonitor().snapshot()` and print as JSON: `{"task":"...","cost_usd":0.12,"input_tokens":1200,"output_tokens":340,"waiting":true}`.

**Verify:** `swift run coucou-cli` prints a valid JSON object. If no session exists, prints `{"active":false}`.

---

### Phase 2: Mac Notch Overlay Window

**Goal:** A persistent transparent window sits in the notch area and live-updates every 5 seconds with session data.

**Files to create/modify:**
- `mac/Sources/App/AppDelegate.swift` — creates the notch window and status item, starts the polling timer
- `mac/Sources/App/NotchWindow.swift` — `NSPanel` subclass: borderless, `NSWindowLevel.statusBar + 1`, positioned at notch rect
- `mac/Sources/App/NotchView.swift` — SwiftUI view showing task label, cost badge, token counts, pulsing dot for "waiting"
- `mac/Sources/App/AgentMonitor.swift` — now publishes an `@Published var session: AgentSession` on a 5-second `Timer`

**Key steps:**
1. In `NotchWindow.swift`, set `styleMask = .borderless`, `backgroundColor = .clear`, `isOpaque = false`, `hasShadow = false`, `collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]`.
2. Detect notch: `NSScreen.main?.safeAreaInsets.top > 0` — if true, use notch-center position; otherwise fall back to `NSStatusItem`.
3. `NotchView` uses a `ZStack` with `Color.black.opacity(0.85)`, width ~280pt, height ~28pt. SF Mono 10pt for numbers, SF Pro 11pt for task name (truncated to 25 chars).
4. Use `NSApp.setActivationPolicy(.accessory)` — no Dock presence.
5. Add `NSStatusItem` with right-click menu: Quit, Show Details (future), Preferences (future).

**Verify:** Launch the app. Notch area shows session data. No Dock icon appears.

---

### Phase 3: Local WebSocket Server + Bonjour

**Goal:** The Mac app exposes session data on `ws://0.0.0.0:7734` and advertises via Bonjour as `_coucou._tcp.`

**Files to create/modify:**
- `mac/Sources/App/WebSocketServer.swift` — `NWListener` on port 7734, broadcasts `AgentSession` JSON every 5 seconds
- `mac/Sources/App/BonjourAdvertiser.swift` — `NWListener` with `_coucou._tcp.` service registration
- `mac/Sources/Shared/AgentSession.swift` — `Codable` struct: `{active, task, cost_usd, input_tokens, output_tokens, waiting, model, session_id, updated_at}`

**Key steps:**
1. In `WebSocketServer.swift`, use `NWListener(using: .webSocket, on: 7734)`. Accept connections into a `[NWConnection]` array protected by a serial `DispatchQueue`.
2. The `AgentMonitor`'s timer callback calls `webSocketServer.broadcast(session.jsonData)` in addition to updating `@Published`.
3. In `BonjourAdvertiser.swift`, use `NWListener.Service(name:, type: "_coucou._tcp.")`.
4. Add `com.apple.security.network.server` entitlement.

**Verify:** `swift run`, then `websocat ws://localhost:7734` — JSON frames arrive every 5 seconds.

---

### Phase 4: Flutter iPhone Companion

**Goal:** The Flutter app discovers the Mac over LAN via Bonjour, connects to the WebSocket, and displays a live session dashboard.

**Files to create/modify:**
- `flutter/pubspec.yaml` — add `web_socket_channel: ^2.4.0`, `multicast_dns: ^0.3.2`, `provider: ^6.1.0`
- `flutter/lib/services/discovery_service.dart` — browses `_coucou._tcp.` and returns resolved IP + port
- `flutter/lib/services/agent_service.dart` — `ChangeNotifier`; holds `WebSocketChannel`, parses JSON frames, reconnects on disconnect
- `flutter/lib/models/agent_session.dart` — Dart counterpart of the Swift struct
- `flutter/lib/screens/home_screen.dart` — `Consumer<AgentService>`: task card, stat chips, pulsing dot for waiting
- `flutter/ios/Runner/Info.plist` — `NSLocalNetworkUsageDescription` + `NSBonjourServices` with `_coucou._tcp.`

**Key steps:**
1. In `discovery_service.dart`, use `MDnsClient` to follow PTR → SRV → A chain to get IP and port. Cache result and re-discover every 30 seconds.
2. In `agent_service.dart`, `WebSocketChannel.connect(Uri.parse('ws://$ip:7734'))`. On stream close, wait 3 seconds and retry.
3. Waiting indicator: `AnimatedContainer` pulsing opacity via `AnimationController(duration: Duration(seconds: 1))..repeat(reverse: true)`.
4. Display cost as `\$${session.costUsd.toStringAsFixed(4)}` in green. Tokens as `${session.inputTokens}↑ ${session.outputTokens}↓` in monospace.
5. Add manual IP input `TextField` as Bonjour fallback for simulator testing.

**Verify:** `flutter run` on a physical iPhone on the same Wi-Fi. Session data appears within 10 seconds. Killing Claude Code causes "No active session" within 10 seconds.

---

### Phase 5: Multi-Session Support + History Strip

**Goal:** Track all active agent sessions simultaneously, cycle through them in the notch, show a 10-item recents list on iPhone.

**Files to create/modify:**
- `mac/Sources/App/AgentMonitor.swift` — scan all project directories, return `[AgentSession]` sorted by last-modified
- `mac/Sources/App/NotchView.swift` — horizontal swipe gesture to cycle sessions; session count badge
- `mac/Sources/App/WebSocketServer.swift` — broadcast `{sessions: [...]}` array
- `flutter/lib/screens/home_screen.dart` — `PageView` for multiple sessions; "Recents" section from in-memory ring buffer

**Key steps:**
1. `FileManager.default.contentsOfDirectory(at: claudeProjectsURL)`, filter dirs modified in last 24h, parse each with `async let`.
2. Notch: `@State var sessionIndex = 0` + `DragGesture` with `onEnded` that increments/decrements modulo `sessions.count`.
3. Update wire format to `{"sessions": [...], "updated_at": "..."}`.
4. Codex support via `~/.codex/` parsing as stretch goal.

**Verify:** Open two Claude Code terminals. Both appear in notch (swipe between them). Both appear in iPhone recents. Closing one drops from active but stays in recents.

---

## Estimated Effort

**4 Claude Code sessions**

- **Session 1** — Phases 1–2: Agent file parsing + Mac notch window. JSONL schema reverse-engineering and notch positioning are the tricky parts.
- **Session 2** — Phase 3: WebSocket server + Bonjour. Network.framework entitlement wiring for sandboxed apps eats time.
- **Session 3** — Phase 4: Flutter app, Bonjour discovery, live WebSocket display. Physical device testing for iOS local network permissions required.
- **Session 4** — Phase 5 + polish: Multi-session scanning, notch swipe UX, Codex support, app icon, notarization setup.

---

## Potential Blockers

- **macOS sandbox + file access**: A sandboxed `.app` cannot read `~/.claude/` without entitlements. Use `com.apple.security.temporary-exception.files.home-relative-path.read-only` with path `/.claude/` — rejected by App Store but fine for Developer ID distribution.
- **JSONL schema is undocumented**: Claude Code's session file format is internal and may change across CLI versions. The parser must be defensive (skip malformed lines, handle missing fields). Pin CLI version in docs.
- **iOS local network permission**: `NSLocalNetworkUsageDescription` must be set; Bonjour does not work in simulators — manual IP fallback in Phase 4 is essential for development.
- **Notch positioning on external displays**: `NSScreen.main?.safeAreaInsets.top` is 0 on non-notch displays. Test the `NSStatusItem` fallback carefully; failing to detect this correctly puts the overlay window off-screen.
- **Codex session format**: OpenAI Codex CLI may store state in SQLite rather than JSONL. Scope Codex to a stretch goal if the session structure is not obvious from `~/.codex/` inspection.

# hermes-mobile-app — Native Android App for Hermes Agent

**Source:** [omarqaterge/hermes-mobile-app](https://github.com/omarqaterge/hermes-mobile-app) (discovered via GitHub Trending oct-23 list)  
**Tagline:** "Control Hermes Agent from your Android phone — no cloud, just Termux."  
**Discovered:** 2026-10-26 (cloud backup)

---

## Why it fits

Hermes is a powerful on-device AI coding agent but it's terminal-only — you need a laptop in front of you to use it. hermes-mobile-app bridges that gap: a native Android app that connects to a Hermes Agent instance running in Termux on the same device or on a remote machine via local network.

The user profile calls out **Agent UIs** (custom agent interfaces) and **Flutter/web AI apps** (mobile-first AI-powered tools). This is the intersection: a mobile UI for an on-device agent, built for Android, with no cloud dependency.

Nothing in seen.json is a native mobile frontend for a terminal-based AI agent. The closest is BasedHardware/omi (screen + voice) but that's screen overlay + voice, not a clean control surface for a coding agent.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| Weekend-buildable | ✅ | A React Native / Flutter mobile frontend connecting to a Hermes Termux session over local WebSocket is a realistic 1-2 session MVP. |
| Fills gap | ✅ | No mobile-first Hermes or Claude-agent controller in seen.json. |
| Novel | ✅ | Native mobile UI for a Termux-based AI agent is a novel combination. |
| Daily utility | ✅ | Using your phone to issue tasks to a background agent while away from desk is high daily value. |

**Total: 4/4**

## Shape

Two paths:

**A — Adopt upstream (fast):** Clone hermes-mobile-app, set up Hermes in Termux on your Android device, and use it directly.

**B — Build a Flutter equivalent (richer):** A Flutter app with a clean chat UI connecting to Hermes over a local WebSocket. This is the more user-interest-aligned build: Flutter + mobile-first + AI agent UI. MVP scope is smaller than it sounds — the agent does all the heavy lifting; the app just needs a message input, a message list, and a WebSocket connection.

## Stack (Option B — build)

- Flutter (Dart) — cross-platform; Android first, iOS later
- WebSocket client to Hermes' local socket
- Shared Preferences for storing connection config (IP, port)
- Optional: background isolate for keeping the socket alive when the app is backgrounded

## MVP scope (Option B)

1. Set up Hermes in Termux on an Android device (or a dev machine reachable on local network).
2. Confirm Hermes exposes a WebSocket or HTTP interface (check README / docs).
3. Build a Flutter chat screen: multiline input + message list + send button.
4. Connect to Hermes' socket; pipe messages in and display responses as they stream.
5. Persist the last-used connection config in SharedPreferences.

## Phases

1. **Research (30 min).** Verify Hermes' API surface (WebSocket, REST, or stdio wrapper needed?). If stdio-only, plan a small Node/Python bridge.
2. **Flutter scaffold (1 h).** Chat screen with mock data. Confirm the UI renders well on a phone.
3. **WebSocket integration (2 h).** Real connection to Hermes. Test send/receive. Handle reconnect on drop.
4. **Polish (1 h).** Loading state, error display, keyboard behaviour, dark mode.
5. **(Later) Background tasks.** Keep socket alive in a background isolate; show a notification when Hermes completes a task.
6. **(Later) Task history.** Persist sessions in local SQLite so you can review what the agent did.

## Effort

~4 h to a working chat UI connected to Hermes. ~2 h more for polish and background handling.

## Blockers / risks

- **Hermes API surface unknown:** If Hermes is stdio-only (not WebSocket), you'll need a thin local bridge process running in Termux. That adds ~1 h but is not a blocker.
- **Termux reliability:** Termux sessions can be killed by Android's battery optimizer. Testing on a real device (not emulator) is essential; you'll likely need to whitelist Termux from battery optimisation.
- **iOS later:** Termux is Android-only, so the iOS path would need a macOS host running Hermes and a SSH tunnel. Leave iOS out of MVP scope.

# PrivateAgent — Flutter Android Automation Agent

**Inspired by:** [github.com/orailnoor/private-agent](https://github.com/orailnoor/private-agent)  
**Source:** GitHub Search / Flutter AI agent (v1.0.0 released June 26 2026, 67 stars)  
**Interest score:** 4/4 (Flutter apps + agent UI + daily phone automation + novel local approach)

## What It Is

An Android automation agent built with Flutter that lets you issue natural-language commands (typed, spoken, or sent via Telegram) and have an AI execute multi-step tasks on your phone. It reads the Android Accessibility tree to understand what's on screen, sends that context to an LLM, receives tap/type/scroll instructions, and executes them — repeat until task complete.

## Why Build Your Own

The original uses DeepSeek and has no iOS support. Building your own means you wire in Claude (better at understanding screen layouts), you add iOS Accessibility support (Flutter + accessibility_service on iOS), and you design your own "skills" library for your most-used apps (e.g. auto-pay a bill, log a purchase to your expense tracker, set reminders). One session gets you a working MVP.

## Stack Recommendation

- **Flutter** (stable) — cross-platform UI + Dart logic
- **accessibility_service** Flutter plugin — Android Accessibility tree capture
- **Claude API** — vision + text reasoning for action decisions
- **speech_to_text** plugin — voice command input
- **flutter_telegram_bot** or `http` — optional Telegram remote control
- **shared_preferences** — persist skill shortcuts and API key locally

## MVP Scope

User types "open WhatsApp and message John that I'm running late" → app captures current screen hierarchy → Claude identifies the next UI action → app executes the tap/type → loop until WhatsApp message sent. No Telegram integration in MVP.

---

## Implementation Phases

### Phase 1 — Screen Capture + Accessibility Setup
**Goal:** Capture live Android accessibility tree and display it as structured JSON.

**Files:**
- `android/src/main/AndroidManifest.xml` — add `BIND_ACCESSIBILITY_SERVICE` permission
- `lib/services/accessibility_service.dart` — wrapper around `accessibility_service` plugin
- `lib/screens/debug_screen.dart` — display raw screen tree JSON for debugging

**Key steps:**
1. `flutter create private_agent && cd private_agent`
2. Add `accessibility_service: ^0.5.0` to `pubspec.yaml`
3. Create `AccessibilityService` singleton that calls `FlutterAccessibilityService.getWindowTree()`
4. Build a debug screen that calls this on a button tap and shows the raw JSON
5. Request Accessibility permission from user on first launch with `openAccessibilitySettings()`

**Verify:** Launch on real Android device, grant Accessibility permission, tap "Capture Screen" — see full XML/JSON dump of the current app's UI tree.

---

### Phase 2 — Claude Action Loop
**Goal:** Send screen tree + command to Claude and receive a structured action (tap/type/swipe).

**Files:**
- `lib/services/claude_service.dart` — Messages API call + JSON action parsing
- `lib/models/agent_action.dart` — `{type: "tap"|"type"|"swipe", target: String, value: String?}`
- `lib/services/action_executor.dart` — executes `AgentAction` via accessibility_service

**Key steps:**
1. Add `http` and `flutter_dotenv` to pubspec; store Claude key in `.env`
2. In `ClaudeService.decide(String command, String screenTree)`:
   - System: "You are an Android automation agent. Given a screen UI tree and a user command, return JSON: {action: 'tap'|'type'|'swipe', target: '<element description>', value: '<text if type>'}"
   - User: `"Command: ${command}\n\nScreen:\n${screenTree}"`
3. Parse JSON response into `AgentAction`
4. `ActionExecutor.run(AgentAction)` calls `accessibility_service` node tap by matching `target` text in the tree

**Verify:** Open the phone calculator app, type command "tap 7 then tap plus then tap 3 then tap equals", watch Claude navigate to `=` and you see `10`.

---

### Phase 3 — Voice Command Input
**Goal:** Issue commands by voice instead of typing.

**Files:**
- `lib/widgets/voice_command_bar.dart` — mic button with listening animation
- Updated `lib/screens/home_screen.dart`

**Key steps:**
1. Add `speech_to_text: ^6.0.0` to pubspec
2. Request microphone permission via `permission_handler`
3. On mic tap: start listening, stream transcript into the command text field in real time
4. Auto-submit when speech ends (silence detection)

**Verify:** Hold mic, say "Open Settings and go to Bluetooth", see command populate and agent start executing.

---

### Phase 4 — Multi-Step Loop + Task Memory
**Goal:** Agent loops automatically until task is complete or stuck (max 10 iterations).

**Files:**
- `lib/services/agent_loop.dart` — orchestrates capture → decide → execute → repeat
- `lib/models/task_run.dart` — tracks step history and current status

**Key steps:**
1. `AgentLoop.run(String command)` executes steps in a `while (!done && steps < 10)` loop
2. After each action, re-capture screen tree and pass full history to Claude with "what's next or are we done?"
3. Claude responds with next action or `{action: "done", reason: "..."}` to stop
4. Display step-by-step log in UI with timestamps

**Verify:** Command "Go to Play Store and search for Signal" — agent opens Play Store, taps search, types "Signal", and reports done.

---

### Phase 5 — Telegram Remote Control
**Goal:** Send commands to your phone via Telegram bot when not physically using it.

**Files:**
- `lib/services/telegram_bot.dart` — long-polling Telegram Bot API
- Background isolate or `flutter_background_service` plugin

**Key steps:**
1. Create Telegram bot via BotFather, store bot token in `.env`
2. Background service polls `getUpdates` every 3 seconds
3. On new message from your user ID: run `AgentLoop.run(message.text)`
4. Send progress updates back as Telegram messages after each step

**Verify:** From another device, message your bot "Turn on WiFi" — phone Wi-Fi toggles on, bot replies "Done".

---

## Estimated Effort

**1.5 Claude sessions.** Phases 1–2 (~2.5 hrs) give a fully working automation agent. Phase 3 adds 30 min. Phases 4–5 are 45 min each.

## Potential Blockers

- **Android Accessibility permission**: users must manually enable in Settings → Accessibility. Provide a clear deep-link on first launch.
- **iOS accessibility**: `accessibility_service` plugin is Android-only. A SwiftUI `AXUIElement` wrapper would be a separate project.
- **Claude API latency**: each loop iteration takes 1–3 seconds. Add a visible "thinking" indicator so users don't cancel mid-task.
- **Element matching**: UI trees use resource IDs, content descriptions, and text — Claude may mis-target. Prompt engineering and a fallback "try the next similar element" step help.
- **Background execution on Android**: Xiaomi/Samsung may kill background services. Use `flutter_background_service` with a sticky foreground notification.

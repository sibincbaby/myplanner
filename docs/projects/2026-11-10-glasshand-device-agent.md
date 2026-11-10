# Glasshand — Agent with Real Device Access (iPhone + Mac)

**Source:** [producthunt.com/posts/glasshand](https://www.producthunt.com/posts/glasshand) (Product Hunt, Nov 5 2026)
**Score:** 3/4 (WB 0 · FG 1 · N 1 · DU 1)
**Shape:** build-the-macOS-half. Glasshand is a Product Hunt launch that gives an agent a real iPhone and Mac. The iOS half requires Apple developer credentials. Build the macOS half: a local computer-use agent that takes screenshots, reads screen text, and controls apps via AppleScript and Accessibility APIs.

## Why this one

Computer use for personal automation — not code-writing, but real OS interaction — is the next frontier for agentic workflows. Existing tools (Claude computer use, vercel-labs/agent-desktop) target cloud or Rust environments. A macOS-native agent that uses Claude vision + AppleScript + Accessibility APIs to interact with any app would automate tasks that have no API: booking calendar events in legacy apps, filling out web forms, triaging system notifications.

**Why FG=1:** The user's current agents are all headless (CLI, API). None can interact with GUI apps. A macOS computer-use agent would unlock automation for apps that don't expose APIs.

**Why N=1:** Claude computer use (Anthropic's reference implementation) requires a Docker container. vercel-labs/agent-desktop is Rust. A pure Python + AppleScript + Claude vision macOS agent, designed for personal use with no container overhead, doesn't exist as a polished open-source tool.

**Why WB=0:** The AppleScript + Accessibility API bridge requires macOS permissions (Screen Recording, Accessibility, Automation) and careful scoping. This is not a 1-session build. Plan for 3-4 sessions, with the first session just getting permissions and screenshots working reliably.

**Why DU=1:** Daily tasks: "Book a dentist appointment by navigating to their portal", "Fill in this expense report form", "Reply to this Slack message based on these instructions". Once the agent can see the screen and click, it automates any GUI task.

## Stack recommendation

- **Python** — orchestration layer
- **Claude claude-sonnet-5-5 vision** — screenshot analysis and action planning
- **`pyautogui`** — cross-platform mouse/keyboard control
- **`pytesseract` + `Pillow`** — OCR for identifying UI elements in screenshots
- **AppleScript via `subprocess`** — higher-level macOS app control (Finder, Calendar, Mail)
- **macOS Accessibility APIs via `pyobjc-framework-ApplicationServices`** — read UI element tree

## MVP scope

A macOS agent that completes a single defined task via screenshot + action loops:

1. **Screenshot pipeline:** take a full-screen screenshot, crop to the active window, send to Claude vision with the prompt "What is on screen? List the UI elements and their approximate positions."

2. **Action planner:** Claude vision returns a plan ("click the 'Book' button at position 450, 320"). Parse the plan into a list of actions (click, type, scroll, wait).

3. **Action executor:** `pyautogui` executes each action. After each action, take a new screenshot. Claude evaluates whether the action succeeded and what to do next.

4. **Task loop:** continue until Claude says "task complete" or the step limit is reached.

Out of scope (MVP): iOS integration, voice input, multi-step memory across tasks, app-specific plugins.

## Phases

1. **Screenshot + permissions (1 session).** Request Screen Recording permission in System Settings. Write a Python script that takes a screenshot every 2 seconds and saves it. Verify it captures the correct screen on a multi-monitor setup. Write a Claude vision call that describes what's on screen.

2. **UI element detection (1 session).** Add OCR with pytesseract to extract text and approximate bounding boxes from the screenshot. Build a simple "clickable elements" parser: buttons, links, input fields. Overlay bounding boxes on a debug screenshot to verify accuracy.

3. **Action executor (1 session).** Implement `click(x, y)`, `type(text)`, `scroll(direction, amount)`, `press_key(key)` via pyautogui. Add a 0.5s delay between actions (macOS UI needs time to respond). Test on a simple task: open Safari, navigate to a URL, extract the page title.

4. **Task loop + Claude planner (1 session).** Build the main loop: screenshot → Claude plan → execute action → screenshot → Claude evaluate → repeat. Add a step limit (max 20 actions) and a failure condition ("if 3 consecutive actions have no visible effect, stop and report failure"). Test on booking a calendar event.

5. **AppleScript integration (1 session, optional).** For well-known apps (Calendar, Mail, Finder), replace the screenshot-based approach with direct AppleScript commands, which are faster and more reliable. Fall back to screenshot-based approach for unknown apps.

## Effort

MVP (phases 1–4): 3–4 sessions. Not a weekend build; plan as a 1-week project.

## Blockers / risks

- **macOS permissions are sticky:** Screen Recording and Accessibility permissions must be granted manually in System Settings. They persist across reboots. If the script's binary path changes (e.g., virtual env upgrade), permissions must be re-granted. Test permission handling early.
- **pyautogui coordinate space:** on Retina displays, pyautogui coordinates are in physical pixels but macOS reports logical pixels. Use `pyautogui.screenshot()` which handles this correctly; don't mix coordinate systems.
- **Claude vision accuracy:** Claude vision can describe screens but may misidentify button positions, especially on dense UIs. Add a verification step: after each Claude-planned action, ask "Did the action succeed? What changed?" to catch misclicks before they cascade.
- **Cost:** Claude claude-sonnet-5-5 vision at ~$0.003 per screenshot (1024x768 image ≈ 1K tokens). A 20-step task costs ~$0.06. For personal use, this is fine. For automation of repetitive tasks, consider caching the UI layout and only re-sending screenshots when the UI changes.
- **iOS half requires Apple Developer Program ($99/year):** skip for MVP. The macOS half is independently useful.

# ilse — point at a UI element, agent changes the code

**Source:** [Product Hunt — ilse](https://www.producthunt.com/products/ilse) (91 votes, launched Nov 1, 2026; visual UI → code-change agent)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** build-first. The interaction pattern is new enough that building a minimal version yourself teaches more than installing a finished product.

## Why this one

ilse is a visual-context coding agent: you point at (or click on) a UI element in your running app, and the agent identifies the responsible code and makes the change you describe in plain English. The interaction is:

1. Screenshot + cursor/bounding box → agent identifies which file and component owns that element
2. User types "make this button blue" or "add a loading spinner here"
3. Agent edits the code, hot-reloads, re-screenshots to verify

**Why FG=1:** Vibe-coding today means alt-tabbing between the running app and Claude Code, describing the element textually ("the blue button in the top-right nav"), hoping the agent finds the right component, then checking visually. ilse collapses that loop. Nothing in the current toolkit does visual-context code targeting.

**Why N=1:** Most AI coding agents are text-in text-out. Computer-use agents (Anthropic's own) are general-purpose, not code-targeted. A screenshot + bounding-box → code component resolution layer is a genuinely new primitive.

**Why DU=1:** Any frontend or Flutter project benefits every iteration cycle. "I see this, change that" is the most natural way to think about UI fixes.

**Why WB=1:** The MVP doesn't need a full product shell. A Python script that (a) takes a screenshot + click coordinates, (b) asks Claude to identify the responsible file/component, (c) applies the edit, (d) re-screenshots is achievable in one Claude session.

## Stack recommendation

- **Screenshot/click capture:** `pyautogui` (cross-platform) or Tauri v2 (if building a desktop app shell)
- **Vision reasoning:** Claude Sonnet 5.5 with vision — pass screenshot + bounding box annotation as base64
- **Code editing:** Claude Code's file-edit tools, or direct filesystem edits via `difflib`
- **Hot reload:** leverage the project's existing dev server (Vite, Flutter hot-reload, etc.)
- **Overlay UI:** Electron or Tauri window with a transparent click-capture overlay, or a simple CLI that hooks into macOS Accessibility APIs

## MVP scope

1. CLI that: takes a screenshot, shows it in-terminal with coordinates
2. User clicks coordinates (or passes `--x 412 --y 280`)
3. Passes annotated screenshot to Claude with: "What file and component owns the UI element at these coordinates in this project at `$PROJECT_ROOT`?"
4. Agent inspects the file, user describes the change in natural language
5. Agent edits the file; CLI re-triggers dev server hot-reload (via touch or HMR signal)

Out of scope (MVP): persistent bounding box overlay, multiple elements, undo, multi-file reasoning.

## Phases

1. **Screenshot + coordinate capture (2h).** `pyautogui.screenshot()` + simple terminal prompt for coordinates. Annotate the screenshot with a red dot at the specified coordinates using Pillow. Encode as base64 for Claude.
2. **Vision-to-file resolution (1 session).** Prompt engineering: pass screenshot + project file tree to Claude, ask it to identify the likely file/component. Test against 5 real elements in a Flutter or React project. Measure accuracy.
3. **Edit loop (1 session).** Given the identified file, standard Claude Code edit flow with natural-language description. Add re-screenshot after edit as confirmation step.
4. **Overlay UI (optional, 1 session).** Replace CLI coordinate input with a floating Tauri window that captures clicks directly from the running app. Pass pixel coordinates automatically.
5. **Polish + MCP wrapping (optional, 1 session).** Expose as an MCP tool so Claude Code can invoke it on its own during a session.

## Effort

MVP (CLI, no overlay): 1 session. With overlay: 2 sessions. MCP wrapping: 3rd session.

## Blockers / risks

- **Vision model accuracy:** Identifying the exact file/component from a screenshot depends on the UI being distinctive enough and the project structure being readable. Dense UIs or heavily nested components may confuse the model. Mitigation: include the file tree in the prompt and have Claude reason step-by-step.
- **Coordinate systems:** HiDPI displays (Retina) have a pixel density multiplier between physical and logical coordinates. `pyautogui` uses physical pixels; the running app uses logical. Test early on the target machine.
- **Hot-reload coupling:** The re-screenshot step only makes sense if the app has hot-reload. For projects without it (native iOS, etc.), the feedback loop requires a re-build step. Keep MVP scoped to hot-reload stacks (Flutter, Vite, Next.js).
- **Multi-file UI:** A single rendered element may span multiple files (parent component, CSS module, utility function). The MVP can ask the user to confirm the file rather than auto-applying.

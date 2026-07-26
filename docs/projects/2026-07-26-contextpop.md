# ContextPop

> A proactive desktop AI companion: press a hotkey (or just Enter), and it captures what you're doing — active window, clipboard, recent keystrokes — runs it through a local LLM, and extracts a task or reminder so nothing slips through

**Inspired by:** [AirJelly](https://www.airjelly.ai/) (Product Hunt / macOS AI companions, July 2026)  
**Date discovered:** 2026-07-26

---

## What gap it fills

The user already has a voice diary (VoxDiary Flutter) and an AI journal (AgentJournal, also from today) for *intentional* capture. ContextPop fills the *unintentional* gap: the task you thought of mid-meeting, the thing you said you'd do when reviewing a PR, the note buried in a Slack thread. AirJelly shows the idea works — an Enter-key anchor that captures context at the moment of intent, not later in a review session. ContextPop is the buildable version: Electron tray app, global hotkey, local Ollama LLM for extraction, SQLite task store. No cloud, no screen recording, no subscription — just press the hotkey, confirm the extracted task, move on.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| App shell | Electron + React | Cross-platform (macOS first, Windows/Linux later); tray API built in |
| Global hotkey | `electron-globalShortcut` | Registers system-wide shortcuts without focus |
| Context capture | `robotjs` / `@nut-tree/nut-js` | Reads active window title + process name; clipboard via Electron API |
| LLM extraction | Ollama HTTP API (local) | `llama3.2:3b` or `phi3:mini` — fast, offline, no API key |
| Fallback LLM | Claude API (Haiku) | Optional paid mode when Ollama isn't running |
| Storage | SQLite via `better-sqlite3` | Synchronous, zero-config, single file |
| UI | React + Tailwind | Quick to wire; Electron window for task list |

## MVP scope (1-2 Claude sessions)

An Electron tray app that:

1. Lives in the menu bar / system tray; starts on login
2. Global hotkey (`Cmd+Shift+Space` default) triggers a capture
3. Capture reads: active window title, active app name, clipboard contents (if text)
4. Sends a short context bundle to local Ollama (`llama3.2:3b`) with prompt: *"Extract one task or reminder from this context. Output JSON: {task, source_app, due_hint}."*
5. Pops a small confirmation toast (bottom-right) with the extracted task; user can edit or dismiss
6. Confirmed tasks save to SQLite; accessible from a tray "Today's tasks" window
7. Badge on tray icon shows pending task count

Out of scope for MVP: screen OCR, microphone capture, natural language scheduling, cloud sync.

## Phases

### Phase 1 — Electron tray shell (1 h)
- Electron + Vite + React boilerplate (electron-vite)
- Tray icon with context menu: "Today's tasks", "Preferences", "Quit"
- Main window (hidden by default): simple task list with checkboxes
- IPC channels: `task:add`, `task:list`, `task:complete`

### Phase 2 — Context capture (1 h)
- Register global shortcut `Cmd+Shift+Space` in `main.js`
- On trigger: read `app.getFocusedWindow()` name (fallback: `@nut-tree/nut-js` `getActiveWindow()`)
- Read clipboard text via `clipboard.readText()`
- Build context bundle: `{window_title, app_name, clipboard_snippet: first 500 chars, timestamp}`

### Phase 3 — LLM extraction (1 h)
- `ollama.js` module: `POST http://localhost:11434/api/generate` with model `llama3.2:3b`
- Prompt template: single-shot, structured JSON output (`format: "json"`)
- Parse response: `{task: string, source_app: string, due_hint: string|null}`
- Timeout 8 s; fallback to Claude Haiku if `ANTHROPIC_API_KEY` env is set and Ollama times out
- Return extracted task to renderer via IPC

### Phase 4 — Toast confirmation UI (45 min)
- Small frameless Electron window (320×120) positioned bottom-right
- Shows extracted task text (editable `<input>`), source app badge, "Save" + "Dismiss" buttons
- Auto-dismisses after 15 s if no interaction (no save)
- On Save: IPC `task:add` → SQLite insert → tray badge count +1

### Phase 5 — Task list window + settings (1 h)
- Main window: tasks grouped by date, checkbox to complete, delete button
- Filter: today / all / by source app
- Settings page: hotkey config, Ollama model dropdown, max clipboard chars, Anthropic API key field
- Persist settings to `electron-store` (JSON config file)

## Effort estimate

~4 hours Phases 1–4 (working capture + confirmation) · 1 Claude session  
~5 hours complete with task list and settings

## Blockers / risks

- **Active window detection on macOS**: Electron's `getFocusedWindow()` returns Electron's own window, not the previously focused app. Use `@nut-tree/nut-js` `getActiveWindow()` or the `active-win` npm package which shells out to a Swift helper. Mitigation: fall back gracefully to "Unknown app" if the helper fails.
- **macOS Accessibility permissions**: Reading the active window title requires the app to be granted Accessibility access in System Settings. Mitigation: on first launch, show a one-time dialog guiding the user to grant permission; disable capture (not crash) if denied.
- **Ollama must be running**: If Ollama isn't installed or running, the capture silently fails. Mitigation: check `GET localhost:11434` on hotkey press; show a toast "Ollama not running — task saved as raw text" and let the user edit manually.
- **Overlap with AirJelly (commercial)**: AirJelly is macOS-only, closed-source, and uses Enter as its trigger. ContextPop is open-source, cross-platform (Electron), hotkey-configurable, and local-LLM-first. The overlap is intentional inspiration, not a clone.

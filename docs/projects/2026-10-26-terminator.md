# terminator — Playwright-Style Computer-Use for Windows via MCP

**Source:** [mediar-ai/terminator](https://github.com/mediar-ai/terminator) (Rust)  
**Tagline:** "Control any Windows app programmatically from an AI agent — like Playwright, but for the whole desktop."  
**Discovered:** 2026-10-26 (cloud backup)

---

## Why it fits

Computer-use automation on Windows has always required fragile WinAPI calls or expensive GUI testing frameworks. Terminator brings Playwright's intuitive selector-based model to the full Windows desktop: `click("button: Submit")`, `type("input: Search", "hello")`, `screenshot()` — all callable from an AI agent via its MCP server.

The user profile calls out **dev productivity** and **Claude/LLM tooling**. Terminator closes the loop on automating Windows-only software (Office, legacy ERP, desktop finance apps) from a Claude Code or Codex agent — no browser required.

The key differentiator: Playwright covers web apps. Terminator covers *native Windows GUIs*. Nothing in seen.json does this.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| Weekend-buildable | ❌ | The Rust core is not a weekend build; it uses Windows UI Automation API at a low level. Adopt upstream. |
| Fills gap | ✅ | No Windows native GUI automation via MCP in seen.json. |
| Novel | ✅ | Playwright-like API for native Windows desktop apps is a new pattern in the seen.json landscape. |
| Daily utility | ✅ | Any repetitive Windows desktop task (filling forms, scraping from a native app, automating a finance dashboard) would run through terminator. |

**Total: 3/4**

## Shape

**Adopt upstream + build agent scripts on top.**

Terminator exposes an MCP server — so from Claude Code or any MCP client, you can issue natural-language commands like "open Excel, copy the Q3 table, paste into the budget tracker app" and terminator executes them against real Windows windows.

The interesting custom-build angle: write a **personal finance automation script** that drives a Windows banking app (or Excel/CSV workflow) via terminator, triggered by Claude Code on a schedule.

## Stack

- Rust binary (terminator core, uses Windows UI Automation API)
- MCP server (built in, connects to Claude Code / Codex via stdio or SSE)
- Python or Node.js for the automation scripts that call the MCP tools

## MVP scope

1. Build / download the terminator binary for Windows.
2. Start the MCP server; register it with your Claude Code config.
3. From a Claude Code session, issue a simple task: `screenshot()` → confirm you see the current desktop.
4. `click("Start menu")` → verify the Start menu opens.
5. Write a 5-step script that automates one repetitive desktop task you do weekly (e.g. exporting a CSV from a native finance app).

## Phases

1. **Setup (1 h).** Build terminator (or download the release binary). Start the MCP server. Register in Claude Code's MCP config.
2. **First automation (1 h).** `screenshot`, `click`, `type` against a simple Windows app (Notepad is a good smoke test). Confirm selectors work.
3. **Real task (2 h).** Automate one real weekly workflow: open app → navigate → export → save file. Test end-to-end.
4. **(Later) Scheduled trigger.** Run the script via a Task Scheduler + Claude Code trigger on a weekly cadence.
5. **(Later) Finance automation.** Wire a finance app export → CSV → Claude Code parsing → summary notification.

## Effort

~2 h to a working first automation. ~4 h to a scheduled, reliable real-world workflow.

## Blockers / risks

- **Windows-only:** Terminator uses Windows UI Automation API — not portable to macOS or Linux. Ensure you have a Windows machine (or VM) available.
- **UI Automation reliability:** Native UI Automation can be brittle across app versions — selectors may need adjustment after an app update.
- **Build complexity:** Rust + Windows-specific crates may require a configured Windows Rust toolchain. Check if pre-built binaries are available first.
- **Privilege:** Some Windows apps require elevated privileges to automate. Test with UAC-gated apps early.

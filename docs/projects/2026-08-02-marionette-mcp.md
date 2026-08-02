# MarionetteMCP — Flutter "Playwright for AI Agents" via MCP

**Source:** [github.com/leancodepl/marionette_mcp](https://github.com/leancodepl/marionette_mcp)  
**Stars:** 369 · **Language:** Dart · **Maintainer:** LeanCode (creators of Patrol)  
**Date discovered:** 2026-08-02

## What it is

An MCP server that gives AI agents (Claude Code, Cursor, Copilot, Gemini CLI) real-time access to a running Flutter app. The agent can inspect the widget tree, tap elements, enter text, scroll, and capture screenshots — all via the MCP protocol.

Think "Playwright MCP but for Flutter native apps."

Architecture: 
- `marionette_flutter` package → binds into Flutter app's debug build
- `marionette_mcp` package → serves MCP protocol over stdio
- AI agent calls tools → MCP server → Dart VM Service → running Flutter app

## Why it fits

- Flutter/web AI apps is a core interest area
- Fills the gap between "building Flutter apps with Claude Code" and "letting Claude Code see and test the running app"
- LeanCode are credible maintainers (Patrol testing framework)
- Enables a Claude Code → build → test → fix loop without leaving the terminal

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 0 | Existing package to integrate, but understanding Dart VM Service internals is non-trivial |
| fills_gap | 1 | No other Flutter-native MCP exists for runtime AI interaction |
| novel | 1 | Flutter-specific runtime binding is meaningfully different from browser automation |
| daily_utility | 1 | Every Flutter development session becomes agent-verifiable |
| **Total** | **3/4** | **VIABLE** |

> `weekend_buildable` = 0 for building from scratch. But **integrating the existing package** into a Flutter project is 2-3 hours. The MVP here is integration + workflow, not reimplementation.

## Stack Recommendation

```
Dart / Flutter 3.x
marionette_flutter (LeanCode pub.dev package) — runtime binding
marionette_mcp (LeanCode) — MCP server
Claude Code or Cursor — MCP client
```

No new code to write for basic integration — the package is production-ready.

## MVP Scope (1 Claude session)

Add marionette to an existing Flutter project and establish a Claude Code workflow:

1. Add `marionette_flutter` to `dev_dependencies` in `pubspec.yaml`
2. Initialize in `main.dart` (debug mode only, one-liner)
3. Start MCP server: `dart run marionette_mcp`
4. Add to Claude Code MCP config: `~/.claude/settings.json`
5. Run Flutter app in debug mode
6. Ask Claude Code: "Take a screenshot of the app, tap the login button, fill email field with test@test.com, take another screenshot"

## Phases

### Phase 1: Basic Integration (1-2h)
- Add package, initialize, verify Dart VM Service is reachable
- Test `get_screenshot` → base64 image in Claude's context
- Test `get_widget_tree` → tree JSON Claude can reason about

### Phase 2: Tap + Text Entry (1h)
- `tap_widget(finder: "Text('Login')")` — simulate user interaction
- `enter_text(finder: "TextField", text: "test@test.com")` — fill forms
- Verify state changes in widget tree after actions

### Phase 3: Smoke Test Loop (2-3h)
- Write a Claude Code skill: `/flutter-smoke-test`
- Skill tells Claude to: screenshot → tap key flows → assert widget tree state
- Claude writes findings to CLAUDE.md as "last test result"

### Phase 4: Regression Detection (2h)
- Store baseline screenshots with `screenpipe` or plain base64 in `.marionette/`
- Claude compares current screenshot to baseline and flags visual diffs
- Integrate into `pre-commit` hook: run smoke test before each commit

### Phase 5: Full Debug Workflow (2-3h)
- Claude Code can trigger hot-reload after editing code
- Screenshot → edit code → hot-reload → screenshot cycle
- Write CLAUDE.md rule: "always run marionette smoke test after UI changes"

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Basic Integration | 1-2h |
| Tap + Text Entry | 1h |
| Smoke Test Loop | 2-3h |
| Regression Detection | 2h |
| Full Debug Workflow | 2-3h |
| **Total** | **8-11h (~1-2 weekends)** |

Phase 1-2 alone (proving the concept): **2-3h (1 session)**

## Blockers / Risks

- Flutter app must run in debug mode for Dart VM Service (release builds incompatible)
- Marionette package version must match Flutter SDK version in project
- Finder syntax (Widget finders) requires familiarity with Flutter testing conventions
- Hot-reload trigger via MCP not yet documented — may need custom tool
- CI/CD integration requires emulator or physical device availability
- Package is on pub.dev but actively maintained — check for breaking changes before starting

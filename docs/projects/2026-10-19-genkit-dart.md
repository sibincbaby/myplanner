# Genkit Dart 1.0 — Google's AI Agent Framework for Flutter, Now Stable

**Source:** GitHub — https://github.com/google/genkit-dart  
**Tagline:** "Google's open-source AI features and agent framework for Dart and Flutter — stable since Oct 8, 2026. Wire LLMs, tools, flows, and human-in-the-loop steps into production Flutter apps."  
**Discovered:** 2026-10-19

---

## Why it fits

Every Flutter AI app in the toolkit so far has been glued together by hand: a `http.dart` call to a model API, a hand-rolled tool dispatch loop, a separate state machine for user approval. Genkit Dart 1.0 is the production-grade foundation that replaces all of that. It is the Dart port of Google's Genkit (which already powers Node.js AI apps), and the stable 1.0 release on October 8 is the signal that the API is locked and production-ready.

Key features for this workflow:
- **Flows**: composable async functions that the framework can observe, retry, and trace; the unit of agent logic
- **Tools**: typed function definitions the LLM can call; Genkit handles serialisation and dispatch
- **Interrupts**: a flow can pause and wait for human input before continuing — the missing piece for approval-gated agent steps in a Flutter app
- **Multi-model**: ships with connectors for Gemini (Google AI / Vertex AI) and OpenAI; Claude can be wired via the OpenAI-compatible adapter
- **Local dev server**: `genkit start` spins up a developer UI to inspect flows, traces, and model calls

The gap it fills: there is no agent-aware Flutter framework in the toolkit. `flutter-ai-labs` (2026-07-08) collects examples but requires you to assemble the pieces yourself. Genkit Dart 1.0 is the assembled framework.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | Add package, define a flow + one tool, wire a Gemini key — all in one Claude session |
| fills_gap | 1 | No production-grade agent framework exists in the Flutter toolkit; `flutter_genkit` is the first |
| novel | 1 | Stable Dart framework for agent flows is new; not a clone of a widely-used OSS tool |
| daily_utility | 1 | Any Flutter AI app built on it is used every day; the framework itself is used every session |
| **Total** | **4/4** | **Viable** |

---

## Stack Recommendation

- **flutter_genkit** (`pub.dev/packages/flutter_genkit`) — main package; flow definitions, tool dispatch, interrupt support
- **google_generative_ai** or **firebase_vertexai** — Gemini model connector bundled with Genkit Dart
- **genkit_openai** (community package) — OpenAI-compatible adapter; use this for Claude via the `base_url` override pointing to Anthropic's OpenAI-compatible endpoint
- **flutter_riverpod** or **bloc** — state management for the flow's running/paused/done states in the UI
- A Flutter project (any existing app or `flutter create`)

No special infrastructure: flows run in the Flutter process; the `genkit start` dev server is optional (local DX only).

## MVP Scope

Build a Flutter app with a single agent flow:
1. User types a task description
2. The flow calls an LLM with one registered tool (e.g. "search the web" via a real API or a stub)
3. If the LLM invokes the tool, the app shows the tool call and waits for the user to approve it (Genkit interrupt)
4. The flow resumes after approval and returns the final answer

This demonstrates the complete agent loop (LLM → tool call → human approval → result) in a real Flutter UI.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | `flutter pub add flutter_genkit google_generative_ai`; get a Gemini API key; verify `genkit start` launches the dev UI | 20 min |
| 2 | Define a `defineFlow` with one `defineTool` (stub: returns a fixed string); run it from a `TextButton` in the app | 30 min |
| 3 | Add the interrupt: `await interrupt('approve_tool', schema: ToolCallSchema)` inside the flow; in the UI, show the approval dialog and resume the flow | 45 min |
| 4 | Replace the stub tool with a real call (e.g. DuckDuckGo API, local SQLite query, or an MCP server via HTTP) | 1 h |
| 5 | Add Claude as an alternative model via the OpenAI-compatible adapter (`base_url: 'https://api.anthropic.com/v1'`) and compare results | 30 min |

**Total estimate:** ~3 h (1–2 Claude sessions)

## Blockers

- Genkit Dart 1.0 targets Dart 3.6+ (bundled with Flutter 3.31+); run `flutter --version` to confirm
- Gemini API key required for Phase 1; Claude via OpenAI-compat adapter needs an `ANTHROPIC_API_KEY` too
- The `interrupt` API is the newest addition in 1.0 — read the CHANGELOG before using it to check for breaking changes from the RC
- `genkit start` dev server requires Node.js locally (it is a companion CLI, not Dart); this is dev-only and not needed in production

## References

- GitHub: https://github.com/google/genkit-dart
- pub.dev: https://pub.dev/packages/flutter_genkit
- Genkit stable announcement: Flutter blog post, Oct 8, 2026
- Genkit JS (reference implementation): https://github.com/firebase/genkit
- Related prior art in toolkit: `flutter-ai-labs` (2026-07-08), `mcp_flutter` (2026-07-21), `flutter_agent_lens` (2026-07-25), `marionette_mcp` (2026-08-02)

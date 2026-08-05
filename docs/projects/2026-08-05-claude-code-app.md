# claude-code-app — Claude Code on Mobile (Flutter)

**Source:** [github.com/9cat/claude-code-app](https://github.com/9cat/claude-code-app)  
**Language:** Dart / Flutter · **Platform:** iOS, Android, Web  
**Date discovered:** 2026-08-05

## What it is

A Flutter cross-platform mobile app that wraps the Claude Code CLI in a chat-like interface for iOS and Android. You connect it to a running Claude Code session via SSH or a local network relay, then interact with Claude Code from your phone — approving tool calls, reviewing diffs, reading session output, and submitting new prompts — without needing a laptop in front of you.

Key differentiator: it is not a new Claude client, it proxies to a real Claude Code process. Your projects, context, and session history remain on the server; the app is just a mobile terminal with a better UX.

## Why it fits

- Core interest: **Flutter/web AI apps** — mobile-first, Dart/Flutter stack
- Core interest: **Claude/LLM tooling** — direct Claude Code companion
- Core interest: **agent UIs** — a novel way to interact with a running agent
- Core interest: **dev productivity** — review and approve agent changes on the go
- `weekend_buildable = 1`: the repo already ships a working app; the weekend is integration, customisation, and adding your workflow shortcuts

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | App exists; forking and wiring to your own server is a weekend |
| fills_gap | 1 | No good mobile interface for Claude Code today; laptop-only is a real friction |
| novel | 1 | Flutter + Claude Code CLI proxy is genuinely new; not a generic LLM chat app |
| daily_utility | 1 | Every commute, meeting, or away-from-desk moment becomes usable coding time |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Flutter 3.x / Dart      — mobile UI
SSH2 (dart)             — secure tunnel to Claude Code host
WebSocket / SSE         — streaming output from Claude Code relay
Claude Code CLI         — agent runtime (on your server/desktop)
simple_ssh (pub.dev)    — SSH client library for Flutter
provider / riverpod     — state management
```

Optional: a lightweight relay server (Node.js + `ws`) if your SSH setup is complex.

## MVP Scope (1 Claude session)

1. Fork the repo and configure SSH credentials for your dev machine
2. Launch a Claude Code session on the server (`claude --session my-session`)
3. Connect from the Flutter app and confirm you can see live output
4. Submit one prompt from the phone and approve one tool call in the mobile UI
5. Verify the approved change appears in the server-side repo

That demonstrates the core mobile-to-agent loop.

## Phases

### Phase 1: Build + Connect (2-3h)
- Fork and `flutter run` on a device or emulator
- Configure SSH host in the app's settings screen
- Start a Claude Code session on your dev machine: `claude`
- Verify the mobile app shows the session's streaming output in real time
- Test: send a one-line prompt, watch Claude Code respond on mobile

### Phase 2: Tool Call Approval UI (2-3h)
- Claude Code emits pending tool calls (file edits, bash commands) that need approval
- Implement a modal sheet that shows: tool name, file path, proposed change (diff view)
- Add Approve / Deny / Edit buttons that send the response back via stdin
- Test with a simple file-write task initiated from the phone

### Phase 3: Diff Viewer (2h)
- Render file diffs inline in the chat using a Flutter diff widget
- Highlight added lines (green) and removed lines (red), same as a PR diff
- Allow tapping a diff to open the file context (±10 lines around the change)
- This makes approving multi-file refactors viable from a phone screen

### Phase 4: Shortcut Prompts (1-2h)
- Add a bottom-bar of saved prompts: "Run tests", "Show changed files", "Explain last change"
- Store shortcuts in local SharedPreferences, editable from settings
- One tap sends the prompt without typing — essential on mobile keyboards

### Phase 5: GitHub/GitLab Integration (2-3h)
- Add a PR tab: list open PRs for your repos, show title + CI status
- Tap a PR to view its diff; tap "Review with Claude" to open a Claude Code session with that PR's context loaded
- Use GitHub MCP server for PR data — Claude Code already has this integration

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Build + Connect | 2-3h |
| Tool Call Approval UI | 2-3h |
| Diff Viewer | 2h |
| Shortcut Prompts | 1-2h |
| GitHub/GitLab Integration | 2-3h |
| **Total** | **9-13h (~2 weekends)** |

Phase 1-2 (working mobile approval flow): **4-6h (1 weekend)**.

## Blockers / Risks

- SSH key management on iOS requires the Secure Enclave — use the `flutter_secure_storage` package; don't store keys in plain SharedPreferences
- Claude Code's stdio protocol is not documented as a stable API; breaking changes between releases may require app-side fixes — subscribe to the Claude Code changelog
- Mobile screen width limits diff readability — implement horizontal scroll for wide diffs and consider landscape-only mode for diff review
- If the Claude Code session is on a cloud machine behind NAT, you need a relay (e.g., fly.io deploy of a small WebSocket proxy) — adds ~1h to Phase 1
- Battery / background: mobile SSH connections drop on screen-off; implement reconnect logic with exponential backoff

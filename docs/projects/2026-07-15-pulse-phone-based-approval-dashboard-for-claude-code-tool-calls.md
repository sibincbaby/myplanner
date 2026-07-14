# Pulse — phone-based approval dashboard for Claude Code tool calls

**Source:** <https://news.ycombinator.com/item?id=48612844>
**Discovered:** 2026-07-15
**Viability:** 3/4

> Hits three interests at once: Claude tooling, agent UI, and mobile-first personal tool — squarely in the user's Flutter + Claude wheelhouse. Highly buildable by Claude as a Flutter app talking to a small relay server.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

Claude Code's PreToolUse hooks provide a clean gating point, so an MVP (hook -> relay server -> push notification -> phone approve/reject) is achievable in a focused sprint, especially given the user's Flutter mobile-first AI stack; weekend_buildable=1 (full remote agent control is the stretch, not the MVP). It squarely fills a gap in a toolkit full of Claude agent UIs (openclaw, claw-desk, gravity-claw) with no existing mobile approval layer, and the concept is still fresh with no mature polished OSS equivalent, so fills_gap and novel both score 1. daily_utility=0 is the weak point: the user's own workflows lean on --dangerously-skip-permissions and desktop-driven agent runs, so a phone approval app is a nice-to-have they'd reach for occasionally rather than open every single day. Total 3, viable.

---

## Implementation Plan

## Overview

Pulse is a mobile-first approval layer for Claude Code. When Claude Code is about to run a tool (Bash, Edit, Write, etc.), a `PreToolUse` hook pauses execution and forwards the request to a small relay server. The relay pushes a notification to a Flutter phone app; the user taps approve or reject; the decision travels back to the hook, which returns the corresponding permission decision to Claude Code. The app also keeps a scrollable session history of every tool call and its verdict.

The MVP is the closed loop: **hook → relay → push → phone → approve/reject → hook returns decision**. The stretch goal (full remote agent control — sending new prompts, killing runs) is deliberately out of MVP scope.

This lands squarely in the user's Flutter + Claude wheelhouse and fills a real gap: the existing agent-UI toolkit (openclaw, claw-desk, gravity-claw) has no mobile approval surface.

## Stack Recommendation

- **Relay server: Node.js + TypeScript, Fastify + `ws`.** Single process exposing an HTTP endpoint for the hook and a WebSocket for the phone. In-memory pending-approval map plus a lightweight SQLite (`better-sqlite3`) log for history. Chosen over Python because it shares the JSON/WebSocket idiom of the Flutter client and deploys trivially to a VPS or `localhost` + tunnel.
- **Hook client: a small Node or Python script** invoked by Claude Code's `PreToolUse` hook. Node keeps the toolchain single-language; it reads the hook JSON payload from stdin, POSTs to the relay, long-polls/awaits the decision, and prints the permission-decision JSON to stdout.
- **Phone app: Flutter (Android-first).** WebSocket client (`web_socket_channel`), local push via `flutter_local_notifications` for foreground/quick MVP, upgradeable to FCM for true background delivery. Riverpod for state, `sqflite`/in-memory for local history cache.
- **Transport for real device off-LAN:** Cloudflare Tunnel or `ngrok` pointing at the relay. For MVP on same Wi-Fi, direct LAN IP is enough.
- **Auth:** a shared bearer token (`PULSE_TOKEN`) in both the hook env and the app, checked on every relay request/socket. Sufficient for a personal tool; no user accounts.

## MVP Scope

In:
- `PreToolUse` hook that blocks until a remote decision (with a configurable timeout → default-deny or default-allow).
- Relay server correlating requests to responses by an `approval_id`.
- Flutter app: live pending-approval card (tool name, command/inputs, cwd, session id), Approve / Reject buttons, and a session-history list.
- Shared-token auth, reconnecting WebSocket, notification on new request.

Out (stretch): sending new prompts to the agent, killing/pausing runs, multi-user, per-tool allow-rules, iOS build, encrypted E2E.

## Implementation Phases

### Phase 1: Relay server + approval protocol
**Goal:** A running relay server that accepts a tool-call approval request over HTTP, holds it open, and can be resolved (approve/reject) via a second call, returning the decision to the original caller.
**Files to create/modify:**
- `relay/package.json` — deps: `fastify`, `@fastify/websocket`, `better-sqlite3`, `zod`, `tsx`, `typescript`.
- `relay/src/server.ts` — Fastify app, route registration, token auth hook.
- `relay/src/approvals.ts` — in-memory `Map<approvalId, {resolve, request, createdAt}>` and promise-based wait/resolve helpers.
- `relay/src/db.ts` — SQLite schema + insert/update/query for `approvals` history table.
- `relay/src/types.ts` — zod schemas for `ApprovalRequest`, `ApprovalDecision`.
- `relay/.env.example` — `PULSE_TOKEN`, `PORT`, `DECISION_TIMEOUT_MS`, `DEFAULT_ON_TIMEOUT`.
**Key steps:**
1. Define `ApprovalRequest` = `{ sessionId, toolName, toolInput, cwd, timestamp }`; server assigns a UUID `approvalId`.
2. `POST /approvals` (called by hook, token-guarded): insert row (status `pending`), register a pending promise, broadcast the request to connected WS clients, then `await` the promise with a `DECISION_TIMEOUT_MS` race; on timeout resolve to `DEFAULT_ON_TIMEOUT` and mark `timeout`. Respond with `{ decision: "approve"|"reject", reason }`.
3. `POST /approvals/:id/decision` (called by phone, token-guarded): validate, resolve the pending promise, update DB row to `approved`/`rejected`.
4. `GET /approvals?limit=50` — history for the app, newest first.
5. Add an auth preHandler comparing `Authorization: Bearer <PULSE_TOKEN>`.
**Verify:** Run `PULSE_TOKEN=dev tsx src/server.ts`; in one terminal `curl` `POST /approvals` (it hangs); in another `curl` the `/approvals/:id/decision` with `approve`; confirm the first curl returns `{"decision":"approve"}` and `GET /approvals` shows the row as `approved`.

### Phase 2: PreToolUse hook client + Claude Code wiring
**Goal:** A real `claude` session pauses on a tool call, waits for the relay decision, and allows or denies the tool accordingly.
**Files to create/modify:**
- `hook/pulse-hook.mjs` — Node script: read hook JSON from stdin, build `ApprovalRequest`, POST to relay, print permission-decision JSON to stdout.
- `hook/README.md` — install/config notes.
- `.claude/settings.json` (project or user) — register the `PreToolUse` hook.
**Key steps:**
1. In `pulse-hook.mjs`, read all of stdin, `JSON.parse` it; Claude Code passes `tool_name`, `tool_input`, `cwd`, `session_id`.
2. POST those to `${PULSE_RELAY_URL}/approvals` with the bearer token; `await` the response (Node's global `fetch`).
3. Map the relay decision to the hook output contract: on approve print `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}`; on reject print `permissionDecision:"deny"` with a `permissionDecisionReason`. Exit 0.
4. Handle relay-unreachable: fail safe to `deny` (or `ask`) with a clear reason so a down relay never silently auto-approves.
5. Register in `.claude/settings.json` under `hooks.PreToolUse` with a matcher (start with `Bash`, then broaden to `*`), `command: "node /abs/path/hook/pulse-hook.mjs"`, and env `PULSE_RELAY_URL`, `PULSE_TOKEN`.
**Verify:** With relay running, start `claude` (without `--dangerously-skip-permissions`) and prompt it to run a shell command; confirm the session blocks, `curl POST /approvals/:id/decision reject` makes Claude report the tool was denied, and an `approve` lets it proceed.

### Phase 3: Flutter app — live approvals + decisions
**Goal:** On the phone, a pending tool call appears in real time and tapping Approve/Reject resolves the waiting Claude Code session.
**Files to create/modify:**
- `app/` — scaffold via `flutter create` (or the `vgv-ai-flutter-plugin:create-project` flutter_app template).
- `app/pubspec.yaml` — `web_socket_channel`, `flutter_riverpod`, `flutter_local_notifications`, `http`, `intl`.
- `app/lib/models/approval.dart` — `Approval` model + JSON parsing matching relay types.
- `app/lib/services/relay_client.dart` — reconnecting WebSocket + REST client (base URL + token from settings).
- `app/lib/providers/approvals_provider.dart` — Riverpod `StateNotifier` holding pending + history lists.
- `app/lib/screens/pending_screen.dart` — list of pending approval cards with Approve/Reject.
- `app/lib/screens/settings_screen.dart` — relay URL + token entry (persisted via `shared_preferences`).
- `app/lib/main.dart` — app shell, bottom nav (Pending / History / Settings).
**Key steps:**
1. Build the WebSocket client: connect to `wss://<relay>/ws?token=...`, auto-reconnect with backoff, decode incoming `ApprovalRequest` frames into the provider's pending list.
2. Render each pending item: tool name, formatted `toolInput` (pretty-print command/file path), cwd, relative time; Approve and Reject buttons call `POST /approvals/:id/decision`.
3. On new pending item, fire a `flutter_local_notifications` heads-up notification with approve/reject action buttons where supported.
4. Optimistically remove the card on decision; reconcile with server ack; surface errors via snackbar.
5. Settings screen writes relay URL + token to `shared_preferences`; client reads them on startup.
**Verify:** `flutter run` on a device/emulator on the same network as the relay; trigger a tool call in a live `claude` session; confirm the card appears within ~1s, a notification fires, and tapping Approve unblocks the `claude` session while History updates.

### Phase 4: Session history + hardening
**Goal:** The app shows a durable, filterable history of past approvals, and the loop survives disconnects, timeouts, and bad tokens gracefully.
**Files to create/modify:**
- `app/lib/screens/history_screen.dart` — paginated list from `GET /approvals`, grouped by session, showing verdict + timestamp.
- `app/lib/services/relay_client.dart` — add history fetch + pagination + on-reconnect resync of any approvals that arrived while offline.
- `relay/src/server.ts` — add `GET /approvals/pending` (so a reconnecting app can recover in-flight requests) and structured request logging.
- `relay/src/approvals.ts` — sweep expired pending entries; emit a WS `resolved` event so other clients update.
**Key steps:**
1. History screen: fetch on open + pull-to-refresh, group by `sessionId`, color-code approve/reject/timeout, tap for full `toolInput` detail.
2. On WebSocket reconnect, call `GET /approvals/pending` and merge, so a request that fired while the phone was asleep still shows up.
3. Relay: on decision or timeout, broadcast a `resolved` WS event so a second device/tab clears the card.
4. Auth failure paths: relay returns 401 on bad token; app shows a clear "check token" banner instead of silently failing.
5. Document the off-LAN path: run `cloudflared tunnel --url http://localhost:$PORT`, put the resulting `https` URL in app settings and `PULSE_RELAY_URL`.
**Verify:** Kill and restart the app mid-request; confirm the still-pending approval reappears via `/approvals/pending` and can still be resolved. Let a request sit past `DECISION_TIMEOUT_MS`; confirm it records `timeout` in History and Claude Code applies the configured default.

## Estimated Effort

**3–4 Claude Code sessions.**
- **Session 1:** Phase 1 — relay server, approval protocol, SQLite history, token auth, curl-verified end to end.
- **Session 2:** Phase 2 + start of Phase 3 — hook script wired into a real `claude` session (the trickiest correctness work: getting the `PreToolUse` stdin/stdout contract exactly right and fail-safe), then Flutter scaffold + WebSocket client.
- **Session 3:** Phase 3 — finish the Flutter pending/decision UI, notifications, settings; verify the full phone-in-the-loop path.
- **Session 4 (partial):** Phase 4 — history screen, reconnect/timeout hardening, tunnel setup for off-LAN use.

## Potential Blockers

- **PreToolUse hook output contract:** the exact JSON shape and field names (`permissionDecision` values, `hookSpecificOutput`, exit-code semantics) must match the installed Claude Code version. Verify against `claude`'s current hooks docs before assuming; a mismatch means decisions are silently ignored. This is the single highest-risk detail.
- **Blocking latency / timeout policy:** the hook holds the agent hostage until the phone responds. Choose `DEFAULT_ON_TIMEOUT` carefully — default-deny is safe but annoying, default-allow defeats the purpose. Long-running HTTP holds can hit proxy idle timeouts through tunnels; keep `DECISION_TIMEOUT_MS` under any tunnel/idle cutoff or switch the hook to poll.
- **Background push on Android:** `flutter_local_notifications` only fires reliably while the app process is alive. True lock-screen delivery when the app is killed needs FCM (a Firebase project + `google-services.json` + server key), which is real setup cost. MVP should assume the app is foregrounded/recently used; flag FCM as a follow-up.
- **Reachability off-LAN:** without a tunnel the phone must share the relay's network. Cloudflare Tunnel/ngrok adds a dependency and, on free ngrok, rotating URLs. Document this; don't let it block the same-Wi-Fi MVP.
- **Fail-open risk:** if the relay is unreachable and the hook is misconfigured to allow-on-error, every tool auto-approves — the opposite of the tool's purpose. The hook must default to deny/ask on any error, and this needs an explicit test.
- **User's own habit:** the profile notes daily reliance on `--dangerously-skip-permissions`. That flag bypasses hooks entirely, so Pulse only functions when the user runs `claude` *without* it — worth stating plainly in the README so the tool isn't silently inert.

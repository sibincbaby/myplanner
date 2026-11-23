# Orpheus — run all your Claude subscriptions and agent sessions from one dashboard

**Source:** <https://www.producthunt.com/products/orpheus-2>
**Discovered:** 2026-11-24
**Viability:** 3/4

> Combines Claude usage tracking, a remote agent-session UI and dev productivity. The tmux session viewer on a phone and the quota-aware rebalancing are both buildable. Only the connector is open source.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 0/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

Fills gap (1): the user lives in Claude Code and agent UIs, and a multi-account usage board with tmux session viewing is a clear missing piece. Novel (1): the combo of cross-account limits, cross-machine tmux and auto-rebalancing is fresh, though partial tools like ccusage exist. Daily utility (1): if the user juggles accounts and agents, they would check it constantly. Weekend buildable (0): the full product (connector, rooms, auto-migration of sessions, phone UI) is too big, though a usage-board plus tmux viewer MVP is feasible. Total 3, so viable.

---

## Implementation Plan

## Overview

**Orpheus-lite** is a self-hosted dashboard that does three things.

1. It shows per-account Claude usage: the 5-hour block, the weekly window, a burn-rate forecast, and reset times.
2. It lists and live-views tmux sessions (Claude Code, Codex, OpenCode) across all of the user's machines, in a laptop or phone browser, with the ability to send input.
3. It ranks accounts by remaining headroom and flags idle agents that could be moved to a roomier account. Moves are suggested, not automatic, in the MVP.

The product's shared rooms, auto-migration and hosted SaaS are out of scope. A small connector on each machine opens an outbound-only WebSocket to a single Node server, so no inbound ports are needed. The user hosts the server on a home box, a VPS, or behind Tailscale or Cloudflare Tunnel.

Usage data comes from two sources, with a graceful fallback.

- **Local logs:** `~/.claude*/projects/**/*.jsonl` per account. This is the ccusage approach, and it gives token counts and timestamps.
- **Server-reported limits (optional):** the account's OAuth usage endpoint, using the token in `<configDir>/.credentials.json`. This is undocumented and may break, so it is treated as an optional enhancement.

## Stack Recommendation

- **Language:** TypeScript everywhere, as a pnpm workspace monorepo. Connector, server and web share types in `packages/shared`.
- **Connector (`apps/connector`):** Node 22. It uses `ws` for the outbound WebSocket, `execa` for tmux calls, `chokidar` for watching the log directory, and `zod` for message validation. It is distributed via `npx` or as a single binary built with `pkg`.
- **Server (`apps/server`):** Fastify + `@fastify/websocket` + `better-sqlite3` (history and config) + `zod`. Auth is a static bearer token per connector plus a password-protected cookie session for the browser.
- **Web (`apps/web`):** Vite + Vue 3 + Pinia + Tailwind. Terminal rendering uses `@xterm/xterm`, and charts use `uPlot` or plain SVG. The layout is mobile-first and installable as a PWA.
- **Why not Nuxt:** the server needs long-lived WebSockets and a connector registry. A plain Fastify process is simpler to run than Nitro, and the web app is a static SPA that Fastify serves.
- **Testing:** `vitest`, plus a fake `tmux` (a real tmux in CI with `tmux -L test`).

## MVP Scope

**In:**
- Multi-account usage board: 5-hour block cost and tokens, weekly totals, percent used (when limits are known or configured), linear burn-rate forecast, and "resets in".
- Account registry that maps each `CLAUDE_CONFIG_DIR` to a label such as `personal` or `work`.
- Connector that reports usage and tmux sessions, and pairs to the server with a token.
- Session list across machines, with an agent-type badge detected from the pane's foreground process (`claude`, `codex`, `opencode`).
- Live terminal view in the browser (read-only by default, with an input toggle), phone-usable with a quick-keys bar (Esc, Ctrl-C, Tab, arrows, Enter).
- Idle detection (no pane output for N seconds and the pane is at a prompt) and a "best account" headroom ranking. A badge says "idle on account A, account B has more headroom", with a copyable resume command.

**Out:** shared rooms, automatic session migration, multi-user tenancy, billing, Codex or OpenCode usage accounting (only their sessions are listed), and push notifications.

## Implementation Phases

### Phase 1: Usage engine (shared lib + CLI)
**Goal:** `orpheus usage` prints, for each configured Claude account, the current 5-hour block, the weekly total, a forecast and the reset time.
**Files to create/modify:**
- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` — monorepo scaffolding.
- `packages/shared/src/types.ts` — `Account`, `UsageSnapshot`, `TmuxSession`, and the WS message zod schemas.
- `packages/shared/src/usage/parseJsonl.ts` — streams the `.jsonl` files and extracts `{ts, model, input, output, cacheCreate, cacheRead, messageId, requestId}`.
- `packages/shared/src/usage/blocks.ts` — groups entries into 5-hour blocks (the block starts at the first message's timestamp floored to the hour; ends +5h), weekly window, burn rate, and forecast.
- `packages/shared/src/usage/pricing.ts` — per-model $/Mtok table used for cost estimates.
- `packages/shared/src/accounts.ts` — loads `~/.config/orpheus/accounts.json` (`[{id,label,configDir,weeklyTokenLimit?,blockTokenLimit?}]`).
- `apps/connector/src/cli.ts` — `orpheus usage [--json]` command.
- `packages/shared/test/blocks.test.ts` and `packages/shared/test/fixtures/*.jsonl` — fixtures.
**Key steps:**
1. Init the pnpm workspace and TypeScript project references, and add vitest.
2. Implement `parseJsonl` as a streaming line reader. Dedupe by `messageId:requestId`, because Claude logs repeat entries. Skip lines with no `message.usage`.
3. Implement `blocks.ts`. An active block is one where `now < blockEnd` and the last activity was under 5h ago. Compute `tokensPerMinute` over the last 15 minutes. The forecast is `used + rate * minutesLeft`, and the limit-hit ETA is `(limit - used) / rate`.
4. Compute the weekly window as a rolling 7 days by default. Make the reset anchor configurable per account (`weeklyResetDay` and `weeklyResetHour`), since the real reset is account-specific.
5. Implement `accounts.ts` and discover default dirs (`~/.claude`, `~/.claude-*`). Prompt the user to label them on first run.
6. Write fixture-based tests: block boundaries, dedupe, an empty dir, and a weekly rollover.
7. Optional: `fetchServerLimits(account)` reads `<configDir>/.credentials.json` and calls the OAuth usage endpoint. If the call fails, fall back silently to local-log estimates, and mark the snapshot `source: "server" | "local"`.
**Verify:** `pnpm -r test` passes. `pnpm --filter connector exec tsx src/cli.ts usage --json` prints valid JSON with a non-zero `block.tokens` for an account that has been used in the last 5 hours. Spot-check the totals against `npx ccusage blocks --json`.

### Phase 2: Server + connector protocol
**Goal:** a connector on any machine pairs with the server over an outbound WebSocket and streams its usage snapshots and tmux session list. The server persists them and exposes a REST API.
**Files to create/modify:**
- `apps/server/src/index.ts` — Fastify bootstrap, static file serving for `apps/web/dist`, and WS route `/ws/connector`.
- `apps/server/src/db.ts` — better-sqlite3 schema: `machines`, `accounts`, `usage_snapshots`, `sessions`.
- `apps/server/src/registry.ts` — in-memory map of `machineId` to socket and last-seen time.
- `apps/server/src/auth.ts` — connector bearer tokens (`orpheus token create <machine>`) and a browser login with a cookie session (`ORPHEUS_PASSWORD` env var).
- `apps/server/src/routes/api.ts` — `GET /api/overview`, `GET /api/usage`, `GET /api/sessions`.
- `apps/connector/src/agent.ts` — a reconnecting WS client with exponential backoff and a 15s heartbeat.
- `apps/connector/src/tmux.ts` — `listSessions()` runs `tmux list-panes -a -F '#{session_name}|#{window_index}|#{pane_id}|#{pane_current_command}|#{pane_current_path}|#{pane_pid}|#{pane_activity}'` and tags the agent type from `pane_current_command` or its child processes.
- `apps/connector/src/config.ts` — `~/.config/orpheus/connector.json` with `serverUrl`, `token` and `machineName`.
**Key steps:**
1. Define the messages in `packages/shared` as a zod discriminated union: `hello`, `usage`, `sessions`, `ping`, and the server-to-connector messages `attach`, `detach`, `input`, `resize`.
2. In the connector, on connect send `hello`. Push `usage` every 30s (and when files change, debounced via chokidar), and push `sessions` every 2s, only if the list changed.
3. Server: authenticate the WS upgrade through the `Authorization` header, upsert the machine, store the snapshots, and mark the machine offline after 3 missed heartbeats.
4. `tmux.ts` must handle "no server running" (exit 1) by returning `[]`, and must use `execa` with an argument array, never a shell string.
5. Add `orpheus connect --server wss://… --token …` to write the config, and `orpheus run` to start the agent. Provide a `systemd --user` unit sample in `deploy/orpheus-connector.service`.
**Verify:** run `pnpm --filter server dev` and `pnpm --filter connector dev -- run`, then `curl -b cookie.txt localhost:7777/api/overview` returns JSON with the machine, its accounts, and sessions matching `tmux ls`. Killing the connector marks the machine offline within about 45s.

### Phase 3: Web usage board
**Goal:** opening the web app shows a responsive usage board and a session list across machines, updating live.
**Files to create/modify:**
- `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/src/main.ts` — Vue app with PWA manifest.
- `apps/web/src/stores/live.ts` — Pinia store backed by a browser WS to `/ws/browser`, which pushes overview deltas.
- `apps/web/src/views/Dashboard.vue` — account cards plus a machines and sessions panel.
- `apps/web/src/components/AccountCard.vue` — two progress bars (5h and weekly), forecast badge (green, amber or red by ETA to limit), and a "resets in 2h 14m" countdown.
- `apps/web/src/components/SessionRow.vue` — session name, machine, agent badge, cwd, idle time.
- `apps/web/src/views/Login.vue` — password form.
- `apps/server/src/routes/browser-ws.ts` — fan-out of registry changes to browser sockets.
**Key steps:**
1. Add `/ws/browser` on the server, authenticated by the cookie. Send a full snapshot on connect, then deltas.
2. Build the Dashboard with Tailwind in a mobile-first single column, becoming a grid at `md:`. Use a ticking `useNow()` composable for countdowns so they don't depend on server pushes.
3. Show the stale state ("last seen 3m ago", greyed) for offline machines.
4. Show the data `source` (server or local estimate) on each account card as a tooltip, so estimated percentages are never presented as authoritative.
5. Make the server serve `apps/web/dist` with an SPA fallback.
**Verify:** `pnpm --filter web build && pnpm --filter server start`, then open `http://localhost:7777` in desktop Chrome and in the phone emulator (or a real phone over LAN). Use Claude Code on an account and watch the bars move within about 30s. Stop the connector and the machine greys out.

### Phase 4: Remote tmux viewer with input
**Goal:** tapping a session opens a live terminal view in the browser, and the user can send keystrokes from a phone.
**Files to create/modify:**
- `apps/connector/src/pane.ts` — `PaneStreamer`: initial `capture-pane -p -e -S -2000 -t <pane>`, then streaming via `tmux pipe-pane -O -t <pane> 'cat >> <fifo>'` (with a polling fallback every 250ms that diffs `capture-pane`).
- `apps/connector/src/input.ts` — `sendKeys(pane, text|key)` using `tmux send-keys -l -t <pane> -- <text>` for literal text and `tmux send-keys -t <pane> Enter|Escape|C-c|Up…` for named keys, from an allowlist.
- `apps/server/src/routes/terminal-ws.ts` — `/ws/terminal/:machine/:pane` relays between browser and connector, enforcing the cookie auth and a `readOnly` flag per connection.
- `apps/web/src/views/Terminal.vue` — xterm.js with `FitAddon`, a read-only default and an "Enable input" toggle.
- `apps/web/src/components/QuickKeys.vue` — a sticky bar with Esc, Tab, Ctrl-C, arrows, Enter, plus a text input with a "Send" button for mobile keyboards.
**Key steps:**
1. Protocol: `attach{pane,cols,rows}` leads to `snapshot{data}` and then `out{data}` chunks. Browser to connector is `input{keys|text}` and `resize`. Cap chunk size at 64KB and batch output to about 30ms.
2. For the `pipe-pane` approach, create a per-attach FIFO under `$XDG_RUNTIME_DIR/orpheus/`, remove it on `detach` or socket close, and run `tmux pipe-pane -t <pane>` with no command to stop. Never leave a pipe attached after disconnect, because the user's tmux config could be affected.
3. Resize is view-only. Do not call `resize-window`. Render the pane at its real size in xterm and let the viewer scroll horizontally. Document this tradeoff.
4. Input safety: validate the pane id against `^%\d+$`, only allow panes from the current `list-panes` result, and rate-limit input to about 50 messages per second.
5. On the phone: set `touch-action` so scrolling the xterm does not fight page scroll, and use `visualViewport` to keep the QuickKeys bar above the soft keyboard.
6. Server audit log: record each `input` event (machine, pane, byte count, not content) to SQLite.
**Verify:** run `tmux new -d -s demo 'claude'` on the machine, open the session from the phone browser and confirm the Claude Code UI renders with colours. Enable input, type a message via QuickKeys and see it appear in the real tmux pane (`tmux capture-pane -p -t demo`). Disconnect the browser and confirm `tmux list-panes` shows no stale pipe-pane (`tmux show -g`, `ls $XDG_RUNTIME_DIR/orpheus` is empty).

### Phase 5: Idle detection, headroom ranking, hardening
**Goal:** the board flags idle agents and recommends which account to use, and the stack is deployable and secure.
**Files to create/modify:**
- `apps/connector/src/idle.ts` — idle heuristic per pane: `now - pane_activity > idleSeconds` (default 90) and the last captured line matches an agent-prompt regex (`^[>❯]\s*$`, or the "? for shortcuts" footer).
- `packages/shared/src/headroom.ts` — `rankAccounts(snapshots)` scores by `min(1 - block%, 1 - weekly%)` and by forecast ETA.
- `apps/web/src/components/Recommendation.vue` — "Session X on account A is idle and A is at 91% weekly, so account B has 64% headroom. Resume there:" with a copyable `CLAUDE_CONFIG_DIR=… claude --resume <id>` command.
- `apps/server/src/routes/settings.ts` — editable thresholds and account labels.
- `deploy/Dockerfile`, `deploy/docker-compose.yml`, `deploy/Caddyfile` — server image and TLS.
- `README.md` — setup for the server, connector pairing, and Tailscale or Cloudflare Tunnel.
**Key steps:**
1. The connector adds `idle: boolean` and `idleSince` to each session. The server stores a session-to-account mapping, derived from the `CLAUDE_CONFIG_DIR` in the pane process environment (`/proc/<pid>/environ` on Linux, `ps eww` on macOS), with `default` if unset.
2. `rankAccounts` is a pure function with unit tests: tie-breaking, accounts with no limits configured (use relative ranking), and stale snapshots excluded.
3. The Recommendation card only appears if the idle session's account is below the best account's headroom by at least 20 points. This stops it from nagging.
4. Hardening: add helmet-style headers, `SameSite=Strict` cookies, WS origin check, constant-time token compare, `@fastify/rate-limit` on login, and a `--bind 127.0.0.1` default (expose only through the tunnel or a reverse proxy).
5. A Docker image for the server (`node:22-alpine`, a volume at `/data` for SQLite). The connector stays a host process, since it needs tmux.
**Verify:** `pnpm -r test` is green, including the `headroom` and `idle` tests. Manual: leave a Claude pane idle for 2 minutes and see the idle badge and recommendation appear. `docker compose -f deploy/docker-compose.yml up` serves the app, and an unauthenticated `curl -i localhost:7777/api/overview` returns 401.

## Estimated Effort

5 Claude Code sessions.

1. **Session 1:** monorepo scaffolding, the Phase 1 usage engine, fixtures, and parity checks against ccusage.
2. **Session 2:** Phase 2, covering the protocol, server, connector, auth and SQLite.
3. **Session 3:** Phase 3, the web app with the usage board and live updates.
4. **Session 4:** Phase 4, the tmux streaming and input path, the mobile terminal UX, and the cleanup guarantees. This is the hardest part and may spill over.
5. **Session 5:** Phase 5, idle detection and ranking, hardening, Docker and the README.

## Potential Blockers

- **Real usage limits are not exposed locally.** The Claude Code logs contain tokens, not the plan's quota. Plan limits are opaque and change. The MVP therefore needs either the undocumented OAuth usage endpoint (which can break or violate terms) or user-configured limits. Present local numbers as estimates, and label `source` clearly in the UI.
- **OAuth credentials handling.** `.credentials.json` holds live tokens. Read it only in the connector, never send the token to the server, send only the derived numbers, and never log it. On macOS the credentials live in the Keychain (`security find-generic-password -s "Claude Code-credentials"`), which needs extra handling and a permission prompt.
- **Weekly window anchor.** The weekly reset time is per account and not in the logs, so it must be user-configured. Forecasts will be off until it is set.
- **Multiple accounts on one machine** depend on the user running Claude with a distinct `CLAUDE_CONFIG_DIR`. If accounts are switched by logging in and out, history cannot be separated, so document this prerequisite.
- **Auto-migration of sessions** is deliberately out of scope. A Claude session's `.jsonl` lives under its config dir, so moving a session means copying the transcript across config dirs and relaunching with `--resume`. This is fragile, and the MVP only suggests it.
- **tmux streaming edge cases:** `pipe-pane` allows only one pipe per pane (it conflicts if the user already uses it), ANSI alt-screen apps such as the Claude Code TUI redraw heavily, and pane size differs from the phone viewport. Keep the polling-diff fallback, and test with `tmux -L` isolated servers.
- **Codex and OpenCode** are detected only by process name. Their usage is not tracked, and their session log formats are not covered by the MVP.
- **Security exposure.** The terminal input endpoint is effectively remote code execution on the user's machines. Require TLS and a tunnel, default to read-only mode, and keep the audit log. Do not expose the server directly to the public internet without auth hardening from Phase 5.
- **macOS vs Linux differences** (`/proc` environment lookup, tmux paths, and the Keychain) need a small platform shim in `apps/connector/src/platform.ts`.

# CloudCLI — Web + Mobile UI for Claude Code

**Inspired by:** [github.com/siteboon/claudecodeui](https://github.com/siteboon/claudecodeui)  
**Source:** GitHub search — Claude Code UIs (June 2026)  
**Interest score:** 3/4 (Claude tooling + agent UI + daily dev use)

## What It Is

A lightweight web app that lets you start, monitor, and interact with Claude Code sessions from any browser — phone, tablet, or secondary monitor. You run it on your dev machine (or a small VPS), and it streams Claude Code's terminal output to a real-time web UI. No SSH client needed.

## Why Build Your Own

The original claudecodeui is solid but feature-heavy. Your own version can be stripped to exactly what you need: pick your own auth scheme, decide whether to expose PTY or just streaming output, and control exactly which projects are exposed.

## Stack Recommendation

- **Next.js 15** (App Router) — frontend + API routes
- **node-pty** — spawn Claude Code in a real pseudo-terminal
- **xterm.js** + **@xterm/addon-fit** — browser terminal emulator
- **Server-Sent Events** or **WebSockets** — stream PTY output to browser
- **simple password auth** via environment variable — single-user, no database needed
- Optionally **Caddy** as a reverse proxy with HTTPS

## MVP Scope

One hardcoded project path → a button to start a Claude Code session → xterm.js terminal in the browser that streams output and accepts input. No project switcher, no file browser, no history — just the terminal.

---

## Implementation Phases

### Phase 1 — PTY Spawner Backend
**Goal:** An API route that spawns `claude` in a PTY and streams stdout via SSE.

**Files:**
- `app/api/session/start/route.ts` — POST → spawn PTY, return session ID
- `app/api/session/[id]/stream/route.ts` — GET SSE stream of PTY output
- `app/api/session/[id]/input/route.ts` — POST raw keystrokes to PTY stdin
- `lib/sessions.ts` — in-memory Map of active PTY sessions

**Key steps:**
1. `npm install node-pty` (requires native build: `npm install --build-from-source`)
2. `sessions.ts`: `Map<string, IPty>` — create with `pty.spawn('claude', ['--dangerously-skip-permissions'], {cwd: PROJECT_DIR})`
3. SSE route: subscribe to `pty.onData`, encode as `data: <base64>\n\n`
4. Input route: `pty.write(body.data)` — forward raw characters
5. Scope session to a single project dir from env var `CLAUDE_PROJECT_DIR`

**Verify:** `curl -N /api/session/<id>/stream` shows Claude Code output in terminal.

---

### Phase 2 — xterm.js Frontend
**Goal:** A browser page with a full terminal that connects to the PTY stream.

**Files:**
- `app/page.tsx` — main page
- `components/Terminal.tsx` — xterm.js wrapper
- `hooks/useSession.ts` — manages SSE connection + input posting

**Key steps:**
1. `npm install @xterm/xterm @xterm/addon-fit`
2. `Terminal.tsx`: instantiate `new Terminal({cursorBlink: true})`, mount to a `div` ref
3. On mount: POST `/api/session/start`, get session ID
4. Open `EventSource('/api/session/<id>/stream')`, on message: `terminal.write(atob(e.data))`
5. `terminal.onData(data => fetch('/api/session/<id>/input', {method:'POST', body: JSON.stringify({data})}))`
6. `ResizeObserver` → `fitAddon.fit()` → POST resize to PTY

**Verify:** Open browser, see Claude Code's interactive prompt, type a question, get a response.

---

### Phase 3 — Simple Auth
**Goal:** Protect the app with a password so it can be exposed on a local network or VPS.

**Files:**
- `middleware.ts` — Next.js middleware checking session cookie
- `app/login/page.tsx` — login form
- `app/api/auth/route.ts` — validate password from env, set signed cookie

**Key steps:**
1. `npm install iron-session` (or use `next-auth` with credentials)
2. `CLAUDE_UI_PASSWORD` env var → hash with bcrypt at startup, compare on login POST
3. Middleware: if no valid session cookie → redirect to `/login`
4. Login page: simple form, POST to `/api/auth`, redirect to `/` on success

**Verify:** Open app in incognito, get redirected to login, enter password, land on terminal.

---

### Phase 4 — Project Switcher
**Goal:** Switch between multiple pre-configured project directories.

**Files:**
- `app/api/projects/route.ts` — returns list from env `CLAUDE_PROJECTS` JSON
- `components/ProjectPicker.tsx` — dropdown in header

**Key steps:**
1. `CLAUDE_PROJECTS='[{"name":"myplanner","path":"/home/user/myplanner"}]'` env var
2. On project switch: kill current PTY session, start new one in selected dir
3. Confirm dialog before switching (unsaved Claude work would be lost)

**Verify:** Two projects configured; switch between them; each starts a fresh Claude Code session.

---

### Phase 5 — Mobile Polish + PWA
**Goal:** Install as a PWA on your phone; comfortable on small screens.

**Files:**
- `public/manifest.json` — PWA manifest
- `app/layout.tsx` — viewport meta, theme-color
- CSS — prevent iOS bounce scroll, fix keyboard overlap

**Key steps:**
1. Add `manifest.json` with `display: standalone`, icons
2. Next.js `viewport` export with `width=device-width, initial-scale=1`
3. CSS: `body { overscroll-behavior: none }`, `#terminal { height: calc(100dvh - 48px) }`
4. Test on iOS Safari: Add to Home Screen, verify keyboard doesn't cover terminal

**Verify:** Installed on phone, tap icon, full-screen terminal session to Claude Code.

---

## Estimated Effort

**1–2 Claude sessions.** Phases 1–2 are a working MVP in ~2 hours. Auth (Phase 3) adds 30 minutes. Phases 4–5 are polish that can wait.

## Potential Blockers

- **`node-pty` native build**: requires `node-gyp`, Python, and build tools; use `npm install --build-from-source` and pin Node version. On Linux this is usually painless.
- **PTY resize on mobile**: virtual keyboard changes viewport height; use `window.visualViewport` resize event rather than `window.resize`
- **Claude Code `--dangerously-skip-permissions`**: needed for non-interactive use; understand the security implications before exposing the app to the internet
- **Streaming backpressure**: if the browser tab is hidden, SSE messages can queue; implement a max-buffer and trim old output

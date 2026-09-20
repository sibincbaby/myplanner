# cosinusalpha/webctl – CLI Browser Automation for Agents

**Source:** <https://github.com/cosinusalpha/webctl>
**Discovered:** 2026-09-20
**Viability:** 3/4

> The CLI-over-MCP approach is a thoughtful design choice: you control exactly what enters the agent context window, reducing noise. Directly composable with Claude Code workflows. Relevant to building browser-driven agent UIs and automating web-based tasks in coding assistant pipelines.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

weekend_buildable: Score 1 — the core MVP is a CLI wrapper around a headless browser (Playwright/Puppeteer) with stdout-friendly output and cookie persistence to disk. That scope is achievable in one to two focused Claude Code sessions. The on-demand skill-loading mechanism adds complexity but can be deferred past MVP. Score 0 if it required a novel browser engine or large distributed infrastructure — it does not.

fills_gap: Score 1 — the user's profile shows heavy agent and Claude tooling work with no browser automation tool visible. When building agents that need to scrape or interact with the web, they currently reach for MCP-based browser tools; a Unix-pipeline-native alternative genuinely adds a missing capability. Score 0 if they already had a CLI browser tool in their toolkit — their profile shows none.

novel: Score 1 — browser-use and MCP browser servers exist and are popular, but both expose a Python API or MCP protocol, not a Unix CLI. The specific design of treating browser sessions as pipeable Unix processes with on-demand skill loading is a meaningfully different interface contract. Score 0 if Playwright CLI or another mature Unix-native tool covered this — Playwright's CLI is test-oriented, not agent-pipeline-oriented.

daily_utility: Score 0 — browser automation is a supporting capability the user would reach for when building a specific agent that needs web interaction, not something they open every morning. Their daily work is building Claude tooling and agent UIs; web scraping/automation is occasional, not constant. Score 1 if their workflow constantly required web data collection or browser-driven automation — it does not appear to.

Total 3/4, viable = true. The Unix-pipeline angle is genuinely fresh relative to MCP-based alternatives, and this fills a real gap in the user's agent-building toolkit even if daily usage is unlikely.

---

## Implementation Plan

## Overview

`webctl` is a headless browser CLI designed around Unix conventions: commands write structured output to stdout, sessions and cookies persist to disk, and skills (compound browser operations) load on-demand. The result is a browser automation tool that slots naturally into Claude Code pipelines — pipe output through `jq`, feed it to another agent tool, or use it as a standalone scraper without standing up an MCP server.

The implementation uses Node.js + TypeScript with Playwright as the browser backend. A persistent browser profile directory acts as the session store; cookies and local storage survive between invocations without a long-running daemon.

---

## Stack Recommendation

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js 20+ + TypeScript | Playwright's first-class target; user's existing toolchain |
| Browser | Playwright (Chromium) | Richer API than Puppeteer, built-in context serialisation |
| CLI framework | `commander` v12 | Subcommand tree, auto-help, minimal magic |
| Output | JSON by default, `--text` / `--markdown` flags | Pipeable; `jq` friendly |
| Session storage | `~/.local/share/webctl/sessions/<name>/` (XDG) | Persists cookies, localStorage, viewport across runs |
| Skills | `~/.local/share/webctl/skills/<name>.mjs` | ES-module plugins, loaded with dynamic `import()` |
| Package distribution | `npm link` locally, later `npx webctl` | No install friction during dev |

---

## MVP Scope

Five commands constitute a shippable MVP:

1. `webctl fetch <url>` — load URL, emit `{ url, title, text, links[], html? }` to stdout
2. `webctl click <url> <selector>` — load URL, click element, emit post-click DOM snapshot
3. `webctl fill <url> <selector> <value>` — load URL, fill field, optionally submit
4. `webctl screenshot <url>` — emit base64 PNG to stdout or save to path
5. `webctl cookies` subcommands — `list`, `export`, `import` against a named session

On-demand skill loading, session chaining, and piped stdin are deferred to later phases.

---

## Implementation Phases

### Phase 1: Project Scaffold + Fetch Command

**Goal:** `webctl fetch <url>` prints a JSON object with title, plain text, and links to stdout with exit code 0.

**Files to create/modify:**
- `package.json` — project manifest with `bin.webctl` entry point
- `tsconfig.json` — strict TypeScript, `"module": "Node16"`, `outDir: dist`
- `src/index.ts` — Commander root, registers subcommands
- `src/commands/fetch.ts` — fetch subcommand implementation
- `src/browser.ts` — Playwright launch helper (reused across commands)
- `src/output.ts` — `emit(data, opts)` writes JSON or text to stdout
- `.gitignore` — ignore `dist/`, `node_modules/`, `~/.local/share/webctl` note

**Key steps:**
1. Run `npm init -y && npm install playwright commander typescript tsx @types/node` and `npx playwright install chromium --with-deps`.
2. In `tsconfig.json` set `"moduleResolution": "Node16"`, `"target": "ES2022"`, `"strict": true`.
3. In `package.json` add `"bin": { "webctl": "./dist/index.js" }` and a `"build": "tsc"` script; add `"type": "module"` so ES imports work.
4. In `src/browser.ts` export `async function launchBrowser(sessionDir?: string)` that calls `chromium.launchPersistentContext(sessionDir ?? '', { headless: true })` and returns the context. When `sessionDir` is omitted, use a temp directory so the invocation is stateless.
5. In `src/commands/fetch.ts` export a Commander `Command` that: launches browser, navigates to `<url>`, waits for `networkidle`, extracts `document.title`, `document.body.innerText`, and all `<a href>` values via `page.evaluate`, closes the context, and calls `emit()`.
6. In `src/output.ts` export `emit(data: unknown, format: 'json'|'text')` — JSON format calls `JSON.stringify(data, null, 2)`, text format pretty-prints key fields. All output goes to `process.stdout`; errors to `process.stderr`.
7. Wire `fetch` command in `src/index.ts` via `program.addCommand(fetchCommand())`.
8. Add `"prepare": "tsc"` so `npm link` builds automatically, then run `npm link`.

**Verify:**
```
webctl fetch https://example.com | jq '.title'
# → "Example Domain"
webctl fetch https://example.com --format text
# → plain readable output, exit 0
```

---

### Phase 2: Session Management + Cookie Persistence

**Goal:** A named session persists cookies and localStorage across separate `webctl` invocations, so logging in once stays logged in.

**Files to create/modify:**
- `src/session.ts` — resolve session directory path, list sessions, delete session
- `src/commands/session.ts` — `session list`, `session delete <name>`, `session path <name>`
- `src/commands/cookies.ts` — `cookies list [--session]`, `cookies export`, `cookies import <file>`
- `src/browser.ts` — update `launchBrowser` to accept `sessionName` and resolve to XDG path
- `src/config.ts` — XDG base-dir helper: `~/.local/share/webctl/`

**Key steps:**
1. In `src/config.ts` export `sessionsDir()` returning `path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local/share'), 'webctl', 'sessions')`.
2. In `src/session.ts` export `resolveSessionDir(name: string): string` — returns `path.join(sessionsDir(), name)` and calls `fs.mkdirSync(..., { recursive: true })`.
3. Update `src/browser.ts`: if `options.session` is set, pass the resolved session dir to `launchPersistentContext`; otherwise pass `''` (ephemeral). Playwright writes cookies, localStorage, and IndexedDB into that directory automatically.
4. Add `--session <name>` flag to the `fetch` command (and all future commands) so every command can opt into a named session.
5. In `src/commands/cookies.ts`, implement `cookies list --session <name>`: launch context from session dir, call `context.cookies()`, emit JSON array, close context. Implement `cookies export` (same but writes file) and `cookies import <file>` (calls `context.addCookies(parsed)`).
6. Add `src/commands/session.ts` with `session list` (reads `sessionsDir()` with `fs.readdirSync`) and `session delete <name>` (`fs.rmSync` with `{ recursive: true }`).
7. Register both new commands in `src/index.ts`.

**Verify:**
```
webctl fetch https://github.com/login --session gh
# cookies written to ~/.local/share/webctl/sessions/gh/
webctl cookies list --session gh | jq '.[0].name'
# → "has_recent_activity" or similar GitHub cookie name
webctl session list
# → ["gh"]
```

---

### Phase 3: Interaction Commands (Click, Fill, Screenshot)

**Goal:** `webctl click`, `webctl fill`, and `webctl screenshot` enable stateful web interaction, with results emitted as JSON snapshots suitable for piping.

**Files to create/modify:**
- `src/commands/click.ts` — `click <url> <selector> [--session] [--wait-for <selector>]`
- `src/commands/fill.ts` — `fill <url> <selector> <value> [--session] [--submit]`
- `src/commands/screenshot.ts` — `screenshot <url> [--session] [--out <file>] [--element <selector>]`
- `src/snapshot.ts` — `takeSnapshot(page): Promise<Snapshot>` shared helper returning `{ url, title, text, links[] }`

**Key steps:**
1. Extract `takeSnapshot(page)` into `src/snapshot.ts` and refactor `fetch.ts` to call it. This ensures click and fill emit the same schema as fetch.
2. In `src/commands/click.ts`: launch context (with optional session), navigate to `<url>`, call `page.waitForLoadState('networkidle')`, call `page.click(selector)`, wait 500 ms or for `--wait-for` selector, take snapshot, emit, close.
3. In `src/commands/fill.ts`: navigate, call `page.fill(selector, value)`, optionally call `page.keyboard.press('Enter')` if `--submit` is passed, take snapshot, emit. If the selector is not found within 5 s, write `{ error: 'selector not found', selector }` to stderr and exit 1.
4. In `src/commands/screenshot.ts`: navigate, call `page.screenshot({ fullPage: true })` or `(await page.$(selector)).screenshot()` if `--element` is set. If `--out <file>` is provided write to disk and emit `{ saved: path }`; otherwise emit `{ png: buffer.toString('base64') }` to stdout (Claude Code can decode and display it).
5. Add `--timeout <ms>` flag (default 15000) to all three commands and pass it to Playwright's navigation timeout.
6. Register all three in `src/index.ts`.

**Verify:**
```
webctl click https://news.ycombinator.com 'a.storylink' --session hn | jq '.title'
webctl fill https://duckduckgo.com 'input[name=q]' 'webctl cli' --submit | jq '.url'
# → should show DDG results URL
webctl screenshot https://example.com --out /tmp/example.png && file /tmp/example.png
# → /tmp/example.png: PNG image data
```

---

### Phase 4: Skill System (On-Demand Plugins)

**Goal:** Users and Claude can drop `.mjs` skill files into `~/.local/share/webctl/skills/` and run them with `webctl skill run <name> [args...]`, composing multi-step browser workflows into named, reusable units.

**Files to create/modify:**
- `src/commands/skill.ts` — `skill list`, `skill run <name> [args...]`, `skill path`
- `src/skills.ts` — skill discovery, validation, and dynamic import
- `~/.local/share/webctl/skills/hn-top.mjs` — example skill (created by verify step, not shipped in repo)
- `src/types.ts` — `SkillContext` interface exported for skill authors

**Key steps:**
1. In `src/types.ts` export:
   ```ts
   export interface SkillContext {
     page: import('playwright').Page;
     args: string[];
     emit: (data: unknown) => void;
   }
   export type Skill = (ctx: SkillContext) => Promise<void>;
   ```
2. In `src/skills.ts` export `skillsDir()` returning `path.join(sessionsDir(), '..', 'skills')` (sibling of `sessions/`). Export `listSkills()` that reads `.mjs` files from the dir. Export `loadSkill(name)` that does `const mod = await import(path.join(skillsDir(), name + '.mjs'))` and validates `typeof mod.default === 'function'`.
3. In `src/commands/skill.ts` implement:
   - `skill list` — calls `listSkills()`, emits array of names
   - `skill path` — emits the skills directory path (useful for `$EDITOR $(webctl skill path)/foo.mjs`)
   - `skill run <name> [args...]` — loads skill, launches browser with optional `--session`, constructs `SkillContext`, calls `mod.default(ctx)`, closes context
4. `skill run` passes `--session` and any extra positional args after the skill name as `ctx.args`. This lets skills be parametric without a separate config file.
5. Write usage docs as JSDoc on `SkillContext` and export them from `src/types.ts` — this is the entire skill authoring API.

**Verify:**
```
mkdir -p ~/.local/share/webctl/skills
cat > ~/.local/share/webctl/skills/hn-top.mjs << 'EOF'
export default async ({ page, emit }) => {
  await page.goto('https://news.ycombinator.com');
  const items = await page.$$eval('.titleline > a', els => els.slice(0,5).map(e => ({ title: e.innerText, href: e.href })));
  emit(items);
};
EOF
webctl skill list
# → ["hn-top"]
webctl skill run hn-top | jq '.[0].title'
# → first HN headline
```

---

### Phase 5: Agent-Friendly Polish + Stdin Piping

**Goal:** `webctl` is fully composable with Claude Code workflows — stdin accepts a URL list, `--extract` targets a CSS selector for focused output, and a `--quiet` flag suppresses non-data output so pipelines don't break.

**Files to create/modify:**
- `src/commands/fetch.ts` — add `--extract <selector>`, `--stdin` flag
- `src/commands/click.ts` — add `--extract`
- `src/output.ts` — add `--quiet` (suppress progress lines to stderr), structured error envelope
- `src/pipe.ts` — `readUrlsFromStdin(): Promise<string[]>` helper
- `README.md` — usage examples oriented toward agent pipelines

**Key steps:**
1. In `src/pipe.ts` export `readUrlsFromStdin()`: if `process.stdin.isTTY` return `[]`; otherwise read all of stdin, split on newlines, filter non-empty. This lets `echo "https://example.com" | webctl fetch --stdin` work.
2. When `--stdin` is set on `fetch`, call `readUrlsFromStdin()`, run fetch for each URL sequentially, emit a JSON array of snapshots (one object per URL). Exit 1 if any URL fails and set `{ error }` on that entry rather than aborting the whole batch.
3. Add `--extract <selector>` to `fetch` and `click`: after `takeSnapshot`, also call `page.$$eval(selector, els => els.map(e => e.innerText))` and attach as `extracted` field. This lets Claude pipe `webctl fetch https://news.ycombinator.com --extract '.titleline > a' | jq '.extracted'` without getting full HTML noise.
4. Standardise error output: all errors write `{ error: string, code: string, url?: string }` to stderr as JSON and exit with code 1. This lets the calling agent `2>/tmp/err.json` and parse failures programmatically.
5. In `README.md` add a "Claude Code Integration" section with three concrete pipeline examples: scraping, form login, and skill invocation from a workflow script.
6. Run `npm run build && npm link` to refresh the global symlink.

**Verify:**
```
printf 'https://example.com\nhttps://httpbin.org/get' | webctl fetch --stdin | jq 'length'
# → 2
webctl fetch https://news.ycombinator.com --extract '.titleline > a' | jq '.extracted | length'
# → 30
webctl fetch https://notaurl.invalid 2>/tmp/err.json; cat /tmp/err.json | jq '.code'
# → "ERR_NAVIGATION"
```

---

## Estimated Effort

**2 Claude Code sessions** (4–6 hours total).

- **Session 1** covers Phases 1–2: scaffold, Playwright integration, fetch command, session persistence, and cookie management. This session ends with a working CLI that can authenticate to a site and remember the session.
- **Session 2** covers Phases 3–5: interaction commands (click/fill/screenshot), skill system, and agent-pipeline polish. This session ends with a fully composable tool ready to drop into a Claude Code workflow script.

---

## Potential Blockers

1. **Playwright install on the CI/dev machine** — `npx playwright install chromium --with-deps` downloads ~150 MB and requires system libraries (`libglib2.0`, `libnss3`, etc.). On a headless Linux box this usually works but can fail in locked-down environments. Mitigation: add `PLAYWRIGHT_BROWSERS_PATH=~/.cache/ms-playwright` to avoid needing root, and document the dep install command.

2. **Persistent context and concurrent invocations** — Playwright's `launchPersistentContext` locks the profile directory; running two `webctl` commands against the same session simultaneously will throw `EBUSY` or silently corrupt state. The MVP makes no attempt at locking. Mitigation: document single-session-at-a-time constraint; a later phase can add a file-lock via `proper-lockfile`.

3. **Sites with bot detection (Cloudflare, DataDome)** — headless Chromium is fingerprinted by most modern bot detectors. `webctl` will silently receive a challenge page rather than the real content. This is not a webctl bug but will confuse users. Mitigation: add a `--headed` flag that opens a visible browser window for manual challenge bypass, then saves cookies to the named session.

4. **Dynamic `import()` of user skill files** — Node's ESM loader enforces MIME types and will refuse to import a `.mjs` file from an arbitrary path if the path contains spaces or special characters, or if the user's file has a syntax error. The error messages are not beginner-friendly. Mitigation: wrap the `import()` call in a try/catch and emit `{ error: 'skill load failed', detail: err.message }` with exit 1 so the failure surface is clean.

5. **`--extract` selector returning too much data** — extracting the wrong selector on a large page can emit megabytes to stdout, filling the agent's context window. Mitigation: add a `--limit <n>` flag (default 100 items) on `--extract` and truncate with a `"truncated": true` field in the output so the caller knows.

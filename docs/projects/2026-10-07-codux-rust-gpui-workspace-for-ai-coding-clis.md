# Codux — Rust+GPUI workspace for AI coding CLIs

**Source:** <https://hunted.space/dashboard/codux-2>
**Discovered:** 2026-10-07
**Viability:** 3/4

> Directly addresses the user's interest in custom agent UIs (openclaw/claw-desk variants) and Claude/LLM tooling — a polished native desktop shell for multiple AI coding CLIs. The worktree-aware sessions and mobile handoff angle maps onto the user's Flutter + web AI app work.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 0/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

weekend_buildable=0: A native Rust+GPUI desktop app is complex infrastructure — GPUI is Zed's framework, still maturing for external use, with a steep learning curve. The full spec (credential-isolated SSH/DB access, token analytics, mobile handoff, worktree-aware sessions, multi-CLI orchestration) is months of work, not a sprint. Even a stripped MVP wrapping one CLI with live status in Rust+GPUI would consume most of a multi-day session on framework overhead alone.

fills_gap=1: The user has openclaw, claw-desk, and gravity-claw variants — those are single-agent Claude interfaces. Codux targets a different layer: a unified native workspace orchestrating multiple AI CLIs (Claude Code, Codex, Cursor) with credential isolation and SSH/database sandboxing. That multi-CLI coordination and security isolation isn't covered by their existing builds.

novel=1: No mature, polished open-source Rust+GPUI AI CLI workspace exists. The Zed GPUI framework is relatively new for external projects. The specific combination of native desktop + multi-CLI orchestration + credential-isolated sandbox is genuinely fresh territory — existing tools (Warp, Zed, VS Code) address adjacent problems but not this one.

daily_utility=1: The user's top interest category is Claude/LLM tooling and they've built multiple agent UI iterations, signaling this is a core daily workflow concern. A working version of Codux would become the persistent shell they operate from, so daily use is highly plausible — contingent on it ever reaching a usable state.

---

## Implementation Plan

## Overview

Codux is a native Rust+GPUI desktop shell that hosts multiple AI coding CLI processes (Claude Code, Codex, Cursor) in isolated, worktree-aware sessions with live status, token analytics, and a local memory/credential store. The architecture is a single Rust binary: GPUI drives the UI, tokio drives async I/O, and PTY-hosted child processes handle each CLI session. The plan below builds from a runnable skeleton to a feature-complete workspace in five phases.

## Stack Recommendation

| Layer | Choice | Reason |
|---|---|---|
| UI framework | `gpui` (from Zed monorepo, pinned tag) | Native GPU-accelerated, same toolkit as Zed; no viable alternative for Rust native |
| Async runtime | `tokio` | Required by GPUI; process I/O, file watching |
| PTY / process hosting | `portable-pty` | Cross-platform pseudoterminal; gives raw byte streams + resize |
| Terminal emulation | `alacritty_terminal` (library crate) | Parses ANSI/VT sequences into a `Term` grid for rendering |
| Local storage | `rusqlite` + `r2d2` | Token analytics, memory entries, session metadata |
| Serialization | `serde`, `serde_json` | Config, IPC payloads |
| Credential store | OS keychain via `keyring` crate + per-session env injection | Isolates credentials per CLI session |
| Git / worktree | `git2` | Detect repo, list worktrees, map session to branch |
| Config | `toml` + `directories` (for XDG paths) | `~/.config/codux/config.toml` |
| Mobile handoff | Local HTTP server (`axum`) + SSE | Phone polls a local endpoint; no cloud required for MVP |

Avoid pulling GPUI through crates.io — it is not reliably published. Clone the Zed repo at a stable tag and reference it as a path or git dependency.

## MVP Scope

A desktop window that:
1. Launches a Claude Code session in a PTY, renders its terminal output live
2. Displays a sidebar showing session name, worktree branch, token count, and status badge
3. Allows creating a second session (different worktree) in a split or tab
4. Persists token usage to SQLite and shows a running total
5. Reads Claude Code output for the token summary line and parses it into the DB

Everything else (Codex/Cursor support, SSH sandboxing, mobile handoff, full credential isolation) is Phase 4+.

## Implementation Phases

### Phase 1: Workspace skeleton — GPUI window + config loader

**Goal:** A native window opens, reads `~/.config/codux/config.toml`, and renders a static two-pane layout (sidebar + main area) with placeholder text.

**Files to create/modify:**
- `Cargo.toml` — workspace manifest; pins `gpui` as a git dep from zed-industries/zed at tag `v0.169.0` (or latest stable); adds `tokio`, `serde`, `toml`, `directories`, `anyhow`
- `src/main.rs` — `gpui::App::new()` entry point; spawns the root `AppWindow` view
- `src/app_window.rs` — `View` impl for the outer chrome; renders a `Div` split: 220 px left sidebar + flex-grow main pane
- `src/config.rs` — `Config` struct (list of CLI definitions, theme, data dir); `Config::load()` reads from `~/.config/codux/config.toml` via `directories::ProjectDirs`
- `config.example.toml` — sample with one Claude Code entry
- `src/sidebar.rs` — `SidebarPanel` view; renders a static list item "No sessions" for now

**Key steps:**
1. Run `cargo new codux` in the project root. Add GPUI as a git dependency: `gpui = { git = "https://github.com/zed-industries/zed", tag = "v0.169.0" }`. Run `cargo fetch` and resolve any transitive dependency conflicts (common: `smallvec`, `parking_lot` version mismatches — pin them in `[patch.crates-io]`).
2. In `src/main.rs`: call `gpui::App::new().run(|cx| { cx.open_window(WindowOptions::default(), |cx| cx.new_view(AppWindow::new)); })`.
3. Implement `Render` for `AppWindow` returning a horizontal flex `div` with sidebar on the left and a `div` containing the text "Select or create a session" on the right.
4. Implement `Config::load()`: use `directories::ProjectDirs::from("", "", "codux")`, read `config_dir().join("config.toml")`; if missing, write a default and return it.
5. Thread `Config` into `AppWindow` via `Model<Config>` so it is reactive.

**Verify:** `cargo run` opens a native window with a grey sidebar on the left and centered placeholder text. No crash on missing config file.

---

### Phase 2: PTY session runner — live terminal output in the main pane

**Goal:** Clicking "New Session" in the sidebar spawns a Claude Code process in a PTY and streams its output into a scrollable terminal view in the main pane.

**Files to create/modify:**
- `Cargo.toml` — add `portable-pty`, `alacritty_terminal`, `tokio` (full features), `bytes`
- `src/session.rs` — `Session` struct: holds `PtyPair`, `CommandChild`, a `tokio::sync::mpsc` channel of `Vec<u8>`, `SessionState` enum (`Idle | Running | Finished`), metadata (`name`, `worktree_path`, `token_count`)
- `src/session_manager.rs` — `SessionManager`: `Arc<Mutex<Vec<Session>>>`; `spawn(config_entry, worktree)` method creates PTY via `portable_pty::native_pty_system()`, launches the CLI command, starts a tokio task that reads PTY master and forwards bytes to the channel
- `src/terminal_view.rs` — `TerminalView` GPUI view: owns an `alacritty_terminal::Term`, processes incoming bytes via `Term::process`, renders the grid as a monospace text block using GPUI's text layout API; handles scroll
- `src/app_window.rs` — wire "New Session" button; on click call `session_manager.spawn(...)`, set `active_session_id`, re-render to show `TerminalView`
- `src/sidebar.rs` — render one row per session: name + green/grey status dot

**Key steps:**
1. In `Session::spawn`: call `portable_pty::native_pty_system().openpty(PtySize { rows: 24, cols: 80, .. })`, get `master` and `slave`; build `CommandBuilder` for the CLI command; `slave.spawn_command(cmd)` gives `child`. Wrap `master` reader in `tokio::io::BufReader` with `AsyncReadExt`.
2. Spawn a detached `tokio::spawn` that loops `reader.read(&mut buf)` and sends chunks over an `mpsc::UnboundedSender<Vec<u8>>`.
3. In `TerminalView`, hold a `Model<TermState>` where `TermState` wraps `alacritty_terminal::Term<EventProxy>`. Subscribe to the MPSC receiver via `cx.spawn` and `cx.update_model` on each received chunk, calling `term.process(bytes)` then `cx.notify()`.
4. Render `TerminalView` by iterating `term.grid()` rows, building a `StyledText` per row using cell foreground/background from `alacritty_terminal::ansi::Color`.
5. Wire PTY resize: when the view is laid out, read `bounds.size` and call `master.resize(PtySize { rows, cols })`.

**Verify:** `cargo run`, click "New Session" — a Claude Code process starts inside the window, the `>` prompt or welcome banner is visible, and typing in the terminal view sends keystrokes (pipe key events from GPUI's `key_down` handler to `master.write_all(bytes)`).

---

### Phase 3: Multi-session tabs + worktree awareness

**Goal:** Multiple sessions can be open simultaneously in tabs; each session is bound to a git worktree and the sidebar shows the branch name.

**Files to create/modify:**
- `src/session.rs` — add `worktree_root: PathBuf`, `branch: String` fields; populate in `spawn`
- `src/worktree.rs` — `fn detect_worktrees(repo_root: &Path) -> Vec<WorktreeInfo>` using `git2::Repository::open` + `repo.worktrees()` + `repo.find_worktree(name)?.path()`; `fn branch_for_path(path: &Path) -> Option<String>` opens the repo at that path and reads `HEAD`
- `src/tab_bar.rs` — `TabBar` GPUI view: horizontal strip of `TabItem` elements; active tab highlighted; "+" button to create session; close button per tab
- `src/new_session_modal.rs` — simple modal: text field for session name, dropdown of detected worktrees (calls `detect_worktrees`), dropdown of configured CLIs; "Launch" button
- `src/app_window.rs` — replace single `active_session` with `Vec<SessionHandle>`; render `TabBar` above main pane; switch `TerminalView` on tab click
- `src/sidebar.rs` — show branch name under session name in each row

**Key steps:**
1. In `WorktreeInfo`: `{ name: String, path: PathBuf, branch: String }`. Call `git2::Repository::open_ext(path, REPOSITORY_OPEN_SEARCH, &[] as &[&OsStr])` to walk up from any directory.
2. `detect_worktrees` also includes the main worktree (`repo.workdir()`). Detect `branch` via `repo.head()?.shorthand()`.
3. `NewSessionModal` calls `detect_worktrees(config.default_repo_root)` on open and populates the dropdown. On "Launch": call `session_manager.spawn(cli_config, worktree_path)` which sets `cwd` on `CommandBuilder` to `worktree_path`.
4. `TabBar::render` iterates `session_manager.sessions()`, renders each as a clickable element. Use `cx.emit(TabSelected(id))` to switch; `AppWindow` handles the event and updates `active_id`.
5. Each `TerminalView` is created once per session and kept alive (not re-created on tab switch) so scroll position and state persist.

**Verify:** Open two sessions on different worktrees. Switch tabs — each shows its own independent terminal and the sidebar shows the correct branch name per row.

---

### Phase 4: Token analytics + local memory store

**Goal:** Token usage is parsed from Claude Code output, stored in SQLite, and a persistent memory panel lets you annotate sessions with notes that survive app restart.

**Files to create/modify:**
- `Cargo.toml` — add `rusqlite`, `r2d2`, `r2d2_sqlite`, `chrono`, `regex`
- `src/db.rs` — `Db` struct wrapping `r2d2::Pool<SqliteConnectionManager>`; `Db::open(path)` creates `~/.local/share/codux/codux.db`; runs migrations inline via `conn.execute_batch(SCHEMA_SQL)`; methods: `record_token_event(session_id, input, output, timestamp)`, `session_totals(session_id)`, `upsert_memory(key, value)`, `list_memory()`
- `src/schema.sql` (embedded via `include_str!`) — `CREATE TABLE IF NOT EXISTS token_events (id INTEGER PRIMARY KEY, session_id TEXT, input_tokens INTEGER, output_tokens INTEGER, ts INTEGER)` + `CREATE TABLE IF NOT EXISTS memory (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)`
- `src/token_parser.rs` — `fn parse_token_line(line: &str) -> Option<TokenEvent>`: regex matching Claude Code's `Tokens: Xcache_read+Xinput→Xoutput` summary line (or the `cost:` line from `--output-stats`); returns `(input, output, cache_read)` counts
- `src/session.rs` — in the PTY reader task: buffer lines, call `token_parser::parse_token_line` on each; on match, `db.record_token_event(...)` and update `session.token_count` atomically; `cx.notify()` to refresh sidebar
- `src/analytics_panel.rs` — GPUI view: table of sessions with total input/output tokens and cost estimate (compute at `$3/M input, $15/M output` for Claude Sonnet); a sparkline of token events over time (render as inline SVG-style bar chart using GPUI paths)
- `src/memory_panel.rs` — GPUI view: text list of `(key, value)` rows from `db.list_memory()`; inline "Add note" form: key + value text fields + Save button → `db.upsert_memory`
- `src/app_window.rs` — add a right-side drawer toggled by a toolbar button; renders `AnalyticsPanel` or `MemoryPanel` depending on selected tab

**Key steps:**
1. Embed migrations: `const SCHEMA: &str = include_str!("schema.sql");` and call `conn.execute_batch(SCHEMA)` in `Db::open`.
2. In the PTY reader loop (session.rs), accumulate bytes into a line buffer. On `\n`, call `token_parser::parse_token_line`. The regex pattern: `r"Tokens:\s*(?P<cache>\d+)cache_read\+(?P<input>\d+)input\s*→\s*(?P<output>\d+)output"` — adjust after inspecting real Claude Code output with `claude --help` or a test run.
3. `AnalyticsPanel` queries `db.session_totals()` on open and on `cx.subscribe` to a `TokenRecorded` app event emitted after each DB write. Display cost as `(input * 3.0 + output * 15.0) / 1_000_000.0`.
4. The sparkline: divide the `token_events` vec into N buckets by timestamp, sum per bucket, normalize to panel height, draw with GPUI's `cx.paint_path`.
5. `MemoryPanel` save: on button click emit `SaveMemory { key, value }` handled by `AppWindow` which calls `db.upsert_memory` then calls `memory_panel.reload(cx)`.

**Verify:** Run a Claude Code session that completes a task. Open the Analytics panel — the session row shows non-zero token counts. Open Memory panel, add a note, restart the app, reopen Memory panel — note persists.

---

### Phase 5: Credential isolation + lightweight mobile handoff

**Goal:** Each session can be assigned a named credential profile (env vars injected from OS keychain); a local HTTP SSE endpoint lets a phone browser tail session output in real time.

**Files to create/modify:**
- `Cargo.toml` — add `keyring`, `axum`, `tower-http`, `tokio-stream`
- `src/credential_store.rs` — `CredentialProfile { name, env_vars: Vec<(String,String)> }`; `store_var(profile, key, value)` calls `keyring::Entry::new(profile, key).set_password(value)`; `load_profile(profile) -> Vec<(String,String)>` calls `get_password()` per known key (key list stored in `~/.config/codux/profiles.toml`)
- `src/session.rs` — `spawn` accepts optional `credential_profile`; calls `credential_store::load_profile` and sets each env var on `CommandBuilder` via `cmd.env(k, v)`; never inherits parent env wholesale — start from `cmd.env_clear()` then add explicit allowlist (`PATH`, `HOME`, `TERM`, `LANG`)
- `src/handoff_server.rs` — `HandoffServer`: starts an `axum` router on `127.0.0.1:7878`; route `GET /sessions` returns JSON list; route `GET /sessions/:id/stream` returns `text/event-stream` SSE; each session's PTY reader fan-outs bytes to a `broadcast::Sender<Bytes>`; the SSE handler subscribes to the relevant sender
- `src/app_window.rs` — toolbar "Mobile" button copies `http://localhost:7878` to clipboard and opens a QR code dialog (generate QR as a PNG via `qrcode` crate, render inline)
- `src/new_session_modal.rs` — add credential profile dropdown populated from `~/.config/codux/profiles.toml`
- `profiles.example.toml` — sample profile with `ANTHROPIC_API_KEY`, `DATABASE_URL` keys

**Key steps:**
1. `credential_store.rs`: use `keyring::Entry::new(&format!("codux:{profile}"), key)`. Store the list of keys per profile separately in `profiles.toml` (e.g., `[profiles.work] keys = ["ANTHROPIC_API_KEY", "DATABASE_URL"]`). `load_profile` reads `profiles.toml` for the key list then retrieves each from the keychain.
2. In `Session::spawn` with `env_clear()`: set explicit safe defaults for `PATH` (inherit from `std::env::var("PATH")`), `HOME`, `TERM=xterm-256color`. Then add credential env vars on top. This ensures no ambient API keys leak between sessions.
3. `handoff_server.rs`: create a `DashMap<SessionId, broadcast::Sender<Bytes>>`. In the PTY reader task, after processing bytes for the terminal, also call `sender.send(bytes.into())`. The SSE handler: `GET /sessions/:id/stream` → `axum_extra::TypedHeader`→SSE stream wrapping `BroadcastStream::new(rx).map(|b| Event::default().data(base64::encode(b)))`.
4. Start `HandoffServer` in a `tokio::spawn` block inside `App::run` before opening the window. Keep a `JoinHandle` so it shuts down with the app.
5. QR generation: `qrcode::QrCode::new(url)` → `qrcode::render::svg::Color` renderer → SVG string → render in GPUI via `svg()` element or embed as image bytes via `image::DynamicImage`.

**Verify:** Launch a session with a credential profile — `echo $ANTHROPIC_API_KEY` in the terminal shows the stored value and a key from a different profile is absent. Open `http://localhost:7878/sessions` in a browser — JSON list appears. Open the SSE endpoint while the session is active — bytes stream in. QR code dialog shows a scannable code.

---

## Estimated Effort

**6–8 Claude Code sessions** (1 session ≈ 2–4 hours of Claude work):

- **Session 1:** Phase 1 — GPUI dependency resolution and workspace skeleton. Most time goes to `[patch.crates-io]` dependency pinning and getting GPUI to compile cleanly.
- **Session 2:** Phase 2, PTY plumbing — portable-pty + tokio reader task + byte forwarding. Getting the async/GPUI model boundary right (spawning tasks that notify views) is the main challenge.
- **Session 3:** Phase 2 continued — `alacritty_terminal` grid rendering in GPUI. Building the cell-to-styled-text pipeline and scroll handling.
- **Session 4:** Phase 3 — tabs, modal, git2 worktree detection.
- **Session 5:** Phase 4 — SQLite schema, migrations, token regex, analytics panel with sparkline.
- **Session 6:** Phase 4 memory panel + Phase 5 credential store + env isolation.
- **Session 7:** Phase 5 — axum SSE handoff server + QR dialog.
- **Session 8:** Polish — keyboard shortcuts, resize handling, session persistence across restart, packaging (`cargo bundle` or `cargo-dist`).

## Potential Blockers

**GPUI API instability.** GPUI is an internal Zed framework — its public API changes between Zed releases without a changelog. Pinning to a specific git tag is mandatory. If the tag's GPUI API differs from examples online, expect 2–4 hours of reading Zed source to find the current equivalents. Mitigation: read `crates/gpui/src/app.rs` and `crates/gpui/examples/` in the pinned Zed repo before writing any view code.

**alacritty_terminal as a library.** The crate is not designed for external embedding — its `EventListener` trait and `Term` struct require careful setup. The `alacritty` binary's own `src/display/` is the best reference. Expect the ANSI color mapping to GPUI's `Hsla` to need manual work.

**GPUI text layout performance.** Rendering a 24×80 terminal grid by creating one `StyledText` per cell per frame will tank performance. The correct approach is to build one `ShapedLine` per terminal row. This requires reading GPUI's `text_system` internals; plan a full session on this optimization if initial rendering is sluggish.

**Token regex fragility.** Claude Code's output format for token summaries is not a documented API — it may change between Claude Code versions or differ with `--output-format json`. Run `claude --output-format json` to get structured output instead of screen-scraping; this may be the simpler path and avoids the regex entirely.

**PTY on macOS vs Linux.** `portable-pty` handles both but `spawn_command` requires `slave` to be the controlling terminal. On macOS, TIOCSWINSZ on the slave before spawn is necessary for correct resize behavior. Test on both platforms if targeting both.

**Keychain prompts on Linux.** The `keyring` crate on Linux uses `secret-service` (GNOME Keyring or KWallet). On a minimal or headless system this may fail silently or prompt. Include a fallback: if `keyring` fails, read from a local encrypted file using `age` (via the `age` crate) with a passphrase derived from machine ID.

**axum + tokio inside GPUI's runtime.** GPUI runs its own executor. Starting a tokio runtime separately (via `#[tokio::main]` or `Runtime::new()`) and bridging to GPUI requires care — use `std::thread::spawn` to host the tokio runtime, with `std::sync::mpsc` or `tokio::sync::oneshot` for shutdown signaling. Do not try to share a single runtime between GPUI and axum.

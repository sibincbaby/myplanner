# Sightline

> MCP server that gives coding agents a closed build→see→interact→debug loop over native GUI apps — launch the app, read its accessibility tree, click buttons, type text, take screenshots — without burning vision tokens on every step

**Inspired by:** [fixed-width/glass](https://github.com/fixed-width/glass) (GitHub trending July 25 2026, 7★, brand new Rust project)  
**Date discovered:** 2026-07-25

---

## What gap it fills

When Claude Code builds a Flutter or Electron desktop app it is blind to the result. The agent writes the code, runs the build, and has to ask the human "does the login button work?" Sightline closes this loop on Linux (X11/Wayland): it exposes an MCP server with tools to launch a GUI application, read its widget tree via AT-SPI2 accessibility APIs, simulate clicks and keystrokes, and capture screenshots — all from within a Claude Code session. The agent can now write the login form, launch the app, click the "Login" button, assert that the welcome screen appears, and iterate — without any human verification step. Glass is building this in Rust with full cross-platform support; Sightline is a simpler Python/Node.js Linux-first version buildable in one weekend.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| MCP server | `fastmcp` (Python) | Minimal boilerplate; `@tool` decorator pattern |
| AT-SPI bridge | `pyatspi2` (Python bindings for AT-SPI2) | Read widget trees on Linux (X11 + Wayland via xdg-desktop-portal) |
| Input simulation | `python-xlib` + `Xlib.ext.xtest` | Synthesise mouse clicks and key events |
| Screenshot | `scrot` subprocess or `Pillow` + `mss` | Capture screen region or full screen |
| App launcher | `subprocess.Popen` | Start the target app; track PID |
| Transport | stdio (MCP default) | No network needed; works in Claude Code |

## MVP scope (1 Claude session)

An MCP server with 6 tools:

| Tool | Description |
|------|-------------|
| `launch_app` | Start an executable by path; returns the app's AT-SPI root node ID |
| `get_widget_tree` | Return a JSON tree of accessible widgets (role, name, state, children) for a node ID |
| `find_widget` | Search the tree for a widget matching role + name pattern; return its node ID |
| `click_widget` | Click the centre of a widget by node ID |
| `type_text` | Send keystrokes to a focused widget |
| `screenshot` | Capture the screen or a bounding-box region; return base64 PNG |

No vision tokens needed for most operations — the agent uses the accessibility tree to navigate. Screenshot is available for visual assertion when tree inspection isn't enough.

## Phases

### Phase 1 — App launcher + AT-SPI tree (1.5 h)
- `launch_app(path: str, args: list[str]) → app_id: str`: spawn the process, wait for AT-SPI registration (poll `pyatspi.Registry.getDesktop(0)` until the app appears)
- `get_widget_tree(app_id: str, max_depth: int = 5) → dict`: walk the AT-SPI tree recursively; emit `{role, name, description, states[], children[], node_id}` per node
- `find_widget(app_id, role, name_pattern) → node_id | null`: BFS with regex match on `name`
- Handle accessibility not available gracefully (return error JSON)

### Phase 2 — Input simulation (45 min)
- `click_widget(node_id: str) → ok`: get widget bounding box from AT-SPI, compute centre, emit `XTest.fake_button_event` (button 1 down+up)
- `type_text(node_id: str, text: str) → ok`: focus the widget via `pyatspi.Action.doAction("SetFocus")`, then emit `XTest.fake_key_event` per character (handle special chars via keysym map)
- `scroll_widget(node_id, direction, amount) → ok`: emit scroll wheel events

### Phase 3 — Screenshot + diff (30 min)
- `screenshot(region: {x,y,w,h} | null) → base64_png`: use `mss` for speed; fall back to `scrot`
- `diff_screenshot(before_b64, after_b64) → changed_pixels_pct`: PIL image diff to detect meaningful UI changes without sending both full screenshots to the model

### Phase 4 — Wayland support (45 min)
- Detect session type (`$XDG_SESSION_TYPE`): if `wayland`, route screenshot to `grim` subprocess
- Input simulation on Wayland requires `ydotool` (root or uinput group); detect and document the requirement
- Update README: Wayland works for reading the tree (AT-SPI2 works on both); input simulation requires either X11 or `ydotool` on Wayland

### Phase 5 — Flutter integration (30 min)
- Special case for Flutter apps: if `flutter_agent_lens` MCP is also available, chain it: Sightline launches the app and does UI actions, FlutterScope reads the Dart VM for widget tree + memory. Document the two-MCP combo pattern in README.
- `wait_for_widget(app_id, role, name_pattern, timeout_s) → node_id`: polls until widget appears; useful after navigation

## Effort estimate

~3.5 hours for Phases 1–2 (working launch + click + type) · 1 Claude session  
~5.5 hours complete with screenshot diff + Wayland + Flutter chain

## Blockers / risks

- **AT-SPI not enabled**: Many apps (especially Electron, Flutter) don't enable accessibility by default. Flutter requires `--enable-accessibility` flag or a runtime service activation. Mitigation: document per-app setup; add a `check_accessibility(app_id)` tool that reports AT-SPI availability.
- **Root requirement for input on Wayland**: `ydotool` needs `uinput` group membership or root. Mitigation: document clearly; provide a `setup.sh` that adds the user to the group.
- **Node ID stability**: AT-SPI node references can become invalid if the UI redraws. Mitigation: re-resolve by re-calling `find_widget` before each action; treat node IDs as short-lived handles.
- **Scope creep from Glass**: Glass is building this properly in Rust with full cross-platform support. Treat Sightline as a Linux-only learning tool; don't try to compete — just build what you need for your Flutter dev loop.

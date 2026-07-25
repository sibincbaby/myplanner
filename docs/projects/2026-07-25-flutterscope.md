# FlutterScope

> Local MCP server connecting Claude Code to the Dart VM Service of a running Flutter app — inspect live widget trees, memory snapshots, CPU hotspots, and hot-reload from within a coding agent session

**Inspired by:** [dhruvanbhalara/flutter_agent_lens](https://github.com/dhruvanbhalara/flutter_agent_lens) (GitHub trending July 25 2026, 41★, Dart)  
**Date discovered:** 2026-07-25

---

## What gap it fills

When building Flutter apps with Claude Code the agent can write and re-write Dart source but has no way to observe the running app: it can't see the live widget tree, check whether a specific widget is actually rendered, measure rebuild counts, or inspect memory allocations. FlutterScope connects to the Dart VM Service via WebSocket (the same protocol that Flutter DevTools uses) and exposes that data as MCP tools. Claude Code can then build a screen, hot-reload, read back the widget tree, assert that the `LoginButton` widget is present with the right text, detect that a `ListView` is rebuilding 40× per second, and fix it — all without the developer leaving their terminal. `flutter_agent_lens` already builds this; FlutterScope is a lighter personal version focused on the 5 tools the user actually needs during Flutter development with Claude Code.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| MCP server | `fastmcp` (Python) | Minimal boilerplate; quick to iterate |
| VM Service | WebSocket + Dart VM Service protocol (JSON-RPC 2.0) | Same protocol as DevTools; no additional Flutter plugin needed |
| WebSocket client | `websockets` (Python asyncio) | Async, handles the VM's streaming events |
| Hot reload | VM Service `reloadSources` RPC | Same as `flutter run` uses internally |
| Widget tree | `ext.flutter.inspector.getRootWidgetSummaryTree` | Extension registered by Flutter framework |

## MVP scope (1 Claude session)

An MCP server (stdio transport) with 6 tools that connect to a Flutter app already running via `flutter run --debug`:

| Tool | Description |
|------|-------------|
| `connect` | Connect to Dart VM at `ws://127.0.0.1:<port>/ws`; discover the main isolate |
| `widget_tree` | Return a condensed JSON widget tree (type, key, size, constraints for each node, max depth configurable) |
| `find_widget` | Search widget tree for a node matching type + key/text pattern; return path + size + rect |
| `hot_reload` | Trigger `reloadSources` on the main isolate; return reload status and time taken |
| `memory_snapshot` | Return heap usage (used/capacity MB) and top 10 object types by count |
| `listen_rebuilds` | Subscribe to `Flutter.firstFrame` / `Flutter.frameEnd` events for 5 seconds; return rebuild count per widget type |

## Phases

### Phase 1 — VM connection + isolate discovery (1 h)
- `connect(port: int = 8888) → isolate_id`: WebSocket connect to VM Service, call `getVM`, find the first non-system isolate
- `disconnect()`: close WebSocket cleanly
- Error handling: VM not reachable (port not open), no Flutter isolate found
- Helper: `_rpc(method, params)` — async JSON-RPC call; handle `id` correlation

### Phase 2 — Widget tree (1 h)
- Call `ext.flutter.inspector.getRootWidgetSummaryTree` via `callServiceExtension`
- Recursively flatten the result tree into a compact representation: `{type, name, key, children[], rect{x,y,w,h}}`
- Truncate children beyond `max_depth` (default 6) with a `"...N more"` marker
- `find_widget(type_pattern, text_pattern) → list[node]`: BFS over the compact tree

### Phase 3 — Hot reload + memory (45 min)
- `hot_reload()`: call `reloadSources` RPC on the isolate; await the `ReloadReport` event; return `{success, reload_time_ms, invalidated_count}`
- `memory_snapshot()`: call `getAllocationProfile` RPC; extract top 10 classes by `instanceCount`; return `{heap_used_mb, heap_capacity_mb, top_classes: [{name, count, size_kb}]}`

### Phase 4 — Rebuild tracking (45 min)
- `listen_rebuilds(duration_s: int = 5) → rebuild_stats`: subscribe to `Flutter.firstFrame` events; count per `widgetType` field; return sorted list
- `get_fps(duration_s: int = 3) → avg_fps`: subscribe to `Flutter.frameEnd` events, measure inter-frame deltas, compute average FPS

### Phase 5 — Auto-discover port (30 min)
- `connect()` without `port`: scan `~/.dart_tool/` or `$TMPDIR` for `.dart_tool/dart-vm-*` socket files; or try ports 8888–8900 sequentially
- `list_running_apps() → [{name, isolate_id, port}]`: enumerate all reachable Flutter isolates; useful when running multiple devices
- Claude Code CLAUDE.md snippet: document how to run `flutter run --debug --vm-service-port=8888` and then call `mcp__flutterscope__connect()`

## Effort estimate

~3.5 hours for Phases 1–3 (connect + widget tree + hot reload + memory) · 1 Claude session  
~5 hours complete with rebuild tracking + auto-discover

## Blockers / risks

- **VM Service port varies**: By default the VM assigns a random port. Mitigation: always pass `--vm-service-port=8888` in the `flutter run` command; document this in the MCP server README.
- **Flutter inspector extension availability**: `ext.flutter.inspector.*` extensions are only registered in debug mode. Mitigation: detect `profile` vs `debug` mode via `getVM` response and return a clear error in profile/release builds.
- **Widget tree size**: Deep widget trees (100+ nodes) can be large JSON. Mitigation: enforce `max_depth=6` by default; provide a `subtree(node_id, depth)` tool to drill into a specific branch.
- **Overlap with flutter_agent_lens**: That project is on pub.dev and getting traction. Consider contributing FlutterScope's auto-discover feature upstream rather than maintaining a parallel implementation long-term.

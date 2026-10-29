# agent-tree — Claude Code Session File-Tree Navigator

**Source:** GitHub Trending (announced Oct 27 via agent tools roundup)  
**Repo:** https://github.com/lifrary/agent-tree  
**Discovered:** 2026-10-29  
**Viability:** 4/4 (WB ✅ · FG ✅ · N ✅ · DU ✅)

## What it is

A Claude Code plugin that parses a session's conversation log into a numbered hierarchical file-tree and lets you resume execution from any node. Instead of scrolling through a linear session transcript, you see a branching tree of the session's turns, tool calls, and subagent decisions. Each node is addressable; you can jump back to any point, fork a new branch, or compare outcomes across branches. Installed via the Claude Code plugin marketplace.

Key details:
- Parses Claude Code session logs into a Yjs-style tree structure
- Miller-column (Finder-style) terminal UI for tree navigation
- Resume-from-node: restart a session from any historical branch point
- Available as a Claude Code npm plugin

## Why it scores

- **Weekend-buildable:** The core concept (parse session JSON → render as navigable tree → write a resume hook) is a focused project achievable in 1-2 Claude sessions. The output format is well-defined (Claude Code session logs are structured JSON).
- **Fills gap:** Claude Code sessions accumulate large transcripts; there is no native way to navigate them structurally or resume from mid-session branch points. This is a daily friction point for anyone who runs long agent sessions.
- **Novel:** No other Claude Code tool exposes sessions as a navigable tree rather than a flat scroll. The branch-and-compare workflow is unique to this project.
- **Daily utility:** Every Claude Code session would benefit from tree navigation — especially multi-hour sessions with dozens of tool calls.

## Build angle

Build a standalone session navigator as a Claude Code hook + TUI, or extend agent-tree with additional features:

1. A `PostToolUse` hook that appends each tool call to a local JSON tree file, keyed by session ID.
2. A Python TUI (using `textual` or `rich`) that reads the JSON tree and renders a Miller-column navigator.
3. A `resume` command that writes the selected branch's context back into Claude Code's session via `--resume`.
4. Optional: diff view to compare two branches side-by-side.

## MVP Scope (weekend build)

- [ ] `session-tree` hook: `PostToolUse` appends `{turn, tool, input_summary, output_summary}` to `~/.claude/trees/<session_id>.json`
- [ ] TUI navigator: `textual` app reads the tree JSON, renders columns (session → turns → tool calls), highlights current node
- [ ] Resume action: selected node writes a `--continue-from <turn_id>` flag for the next `claude` invocation
- [ ] CLI entrypoint: `agent-tree <session_id>` opens the navigator
- [ ] README with installation instructions for Claude Code hooks

## Phases

### Phase 1 — Session logging hook (Day 1, ~2h)
- `PostToolUse` hook script that appends turn metadata to a JSON tree file
- Schema: `{session_id, turns: [{id, role, tool_name, input_hash, output_summary, children: []}]}`
- Test with a real Claude Code session

### Phase 2 — TUI navigator (Day 1, ~3h)
- `textual` app with three-pane Miller-column layout
- Pane 1: list of sessions; Pane 2: turns for selected session; Pane 3: tool call detail
- Keyboard nav (arrow keys, Enter to drill down, Esc to go up)

### Phase 3 — Resume integration (Day 2, ~2h)
- Map selected node back to a `--resume` or `--continue-from` Claude Code flag
- Shell wrapper: `agent-tree resume <session_id> <turn_id>` launches `claude` at that point
- Confirm behavior with Claude Code's resume API

### Phase 4 — Branch compare (Day 2, ~1h)
- Mark two turns with `[m]`, show side-by-side diff of tool outputs
- Useful for comparing "did approach A or approach B work better?"

## Effort estimate

| Phase | Hours |
|-------|-------|
| Session logging hook | 2 |
| TUI navigator | 3 |
| Resume integration | 2 |
| Branch compare | 1 |
| **Total** | **~8h** |

## Blockers / risks

- Claude Code's session log format may change across versions — pin to the current schema and add a version check.
- The `--resume` / `--continue-from` flag behavior needs verification against Claude Code's current API; the flag may work differently for mid-session branches vs. top-level sessions.
- Textual TUI rendering in Claude Code's terminal requires terminal color support — test in both the default terminal and inside tmux/screen.

## Reference

- agent-tree plugin: https://github.com/lifrary/agent-tree
- Claude Code hooks docs: https://docs.anthropic.com/en/docs/claude-code/hooks
- Claude Code session format: https://docs.anthropic.com/en/docs/claude-code/sessions
- textual TUI framework: https://textual.textualize.io/

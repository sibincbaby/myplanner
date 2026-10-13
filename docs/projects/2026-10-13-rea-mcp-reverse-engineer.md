# rea — Reverse Engineer Anything (MCP Server)

**Source:** GitHub — https://github.com/morluto/rea  
**Tagline:** "MCP server that gives your coding agent tools to inspect native binaries, Electron apps, .NET assemblies, and websites"  
**Discovered:** 2026-10-13

---

## Why it fits

Reverse engineering typically means context-switching between a disassembler, a browser DevTools session, and a decompiler — then manually copying findings into a prompt. rea collapses that: it exposes the inspection primitives as MCP tools so Claude Code can call them directly within the coding session. The targeted use cases — debugging a closed Electron dependency, understanding a minified JS bundle, checking a .NET assembly for an undocumented API — come up regularly in dev workflows even without formal security work.

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | MCP server install pattern — likely `npx` or `pip install`; integrates into Claude Code's CLAUDE.md in minutes |
| fills_gap | 1 | No MCP tool in the current toolkit provides binary/JS/Electron inspection from within a coding session |
| novel | 1 | Unified reverse engineering surface as an MCP server is a new pattern; not widely cloned yet |
| daily_utility | 0 | Not every day involves reverse engineering; this is a situational tool rather than a daily driver |
| **Total** | **3/4** | **Viable** |

---

## Stack Recommendation

- **rea MCP server** (install method TBD — check README for `npx` or `pip`)
- **Claude Code 2.1+** with MCP stdio support
- Underlying tools (rea likely wraps): `radare2` or `Binary Ninja` for natives, `js-deobfuscator` or similar for JS, `ILSpy`/`dotnet-decompiler` for .NET
- No persistent storage — session-scoped inspection results

## MVP Scope

Install rea, register it in CLAUDE.md as an MCP server, and test it on one real task: either inspect a suspicious `.node` addon in a dependency tree, or deobfuscate a minified JS bundle from a closed API you're working against.

Not in MVP: automating full binary analysis pipelines, integrating with a disassembler GUI, .NET decompilation.

## Phases

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Clone/install rea; read the README; identify which inspection targets are supported (binary, JS, Electron, .NET, web) | 30 min |
| 2 | Register rea in `CLAUDE.md` as an MCP server; verify Claude Code picks it up with `/mcp` | 30 min |
| 3 | Test with a real closed-source target: have Claude use rea tools to inspect a minified JS bundle and summarize the API surface | 1 h |
| 4 | Try a native binary inspection (e.g., a `.node` native addon or a small Electron helper binary) | 1 h |
| 5 | Evaluate fit: does having inspection tools in-session reduce context-switching enough to justify keeping rea registered? | 30 min |

**Total estimate:** ~3.5 h (1 Claude session)

## Blockers

- Install method and system dependencies unknown from listings — read the README before starting
- System tools (radare2, decompilers) may need to be installed separately; may not be cross-platform
- The project trended on GitHub but appears early-stage; documentation may be sparse
- Some reverse engineering targets (DRM-protected binaries, certain Electron internals) may hit legal or policy limits
- MCP tool schemas not yet verified — some inspection types may be stubs

## References

- GitHub: https://github.com/morluto/rea
- Context from GitHub Trending roundup: https://www.coddykit.com/pages/blog-detail?id=5129953&slug=github-trending-october-2026-5-ai-agent-tools-redefining-developer-workflows

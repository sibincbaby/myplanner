# LEANN — Private Local RAG MCP Server for Claude Code

**Source:** [StarTrail-org/LEANN](https://github.com/StarTrail-org/LEANN) (GitHub trending Nov 8, 2026; Python, MIT, 13.8k★, MLSys2026 Best Paper)
**Score:** 3/4 (WB 0 · FG 1 · N 1 · DU 1)
**Shape:** deploy-and-extend. LEANN itself is a research-grade system with a novel algorithm (not weekend-buildable from scratch). The opportunity is to deploy it as an MCP server for Claude Code and extend it with your own data sources over a weekend.

## Why this one

Claude Code can't search your personal notes, old conversations, or project documentation during a session. The common workaround — copying text into the context manually — doesn't scale. LEANN solves this with a local RAG system that exposes an MCP server: Claude Code can call `search_docs(query)` and get semantically relevant results from your indexed files.

The key differentiator is LEANN's storage efficiency: a standard vector database stores millions of embeddings on disk; LEANN stores a pruned graph and recomputes embeddings at query time, saving ~97% disk space. For a personal notes setup (thousands of files), the entire index fits in a few MB. And unlike cloud RAG services, nothing leaves your machine.

**Why FG=1:** There's no good local-first RAG MCP server for personal notes today. claude-mem stores structured memories; LEANN indexes unstructured documents (PDF, Markdown, chat exports). The gap is "ask Claude Code about my project notes from three months ago" and get a real answer.

**Why N=1:** The 97% storage savings via graph-based selective recomputation is a genuinely novel algorithm (arXiv 2506.08276, MLSys2026 Best Paper). The MCP server for Claude Code is included in the repo. No other local RAG system has this combination of storage efficiency + MCP integration.

**Why WB=0:** The core algorithm requires C++ dependencies (Boost, Protobuf, MKL) and a research-grade implementation. Building it from scratch is not a weekend task. Installing and configuring it is.

**Why DU=1:** Once configured, Claude Code can retrieve relevant context from your notes on every session. The value compounds as the index grows.

## Stack recommendation

- **LEANN** (Python, `pip install leann`) — the core RAG engine
- **`leann` CLI** — index sources and start the MCP server
- **Claude Code** — configure via `~/.claude/settings.json` mcpServers block
- **Ollama** (local) or **Anthropic API** — LEANN supports both for the LLM step
- **Source connectors** (included in LEANN): local files (PDF, TXT, MD), ChatGPT exports, Claude exports

## MVP scope

Indexed sources and working `search_docs` tool in Claude Code:
1. Install LEANN: `pip install leann`
2. Index your personal notes: `leann index ~/notes --format md`
3. Index past Claude exports: `leann index ~/Downloads/claude-export.json --format claude`
4. Start the MCP server: `leann serve --port 8788`
5. Add to Claude Code's MCP config
6. Test: ask Claude Code "what did I write about database schema design in my notes?"

Out of scope (MVP): semantic chunking tuning, multi-language support, Apple Mail integration, WeChat integration, real-time sync.

## Phases

1. **Install and first index (1 session).** Install LEANN and all C++ dependencies (use the Docker image if Boost/Protobuf installation proves painful). Index 100 Markdown notes. Run `leann chat` to verify retrieval quality on 10 queries.
2. **MCP server in Claude Code (30 min).** Configure `~/.claude/settings.json` to add the LEANN MCP server. Test that Claude Code uses `search_docs` automatically when you ask a question that requires context from notes.
3. **Claude export integration (30 min).** Export your Claude conversation history. Run `leann index` on the export. Test that Claude Code can retrieve past conversation context.
4. **Auto-reindex hook (1 session, optional).** Write a `post-write` hook in `~/.claude/settings.json` that runs `leann index --diff` on changed markdown files. Keeps the index current without manual reindexing.
5. **Custom MCP tools (1 session, optional).** Add two more tools beyond `search_docs`: `index_url(url)` (fetch and index a web page on demand) and `export_to_notes(query, output_path)` (write a summary of relevant results to a Markdown file).

## Effort

Phases 1–2: 1 session (mostly setup). Phases 3–5: 1 more session.

## Blockers / risks

- **C++ dependency installation:** DiskANN backend requires Boost, Protobuf, and MKL. On a Mac, Homebrew handles most of this, but MKL is Intel-only. Use the HNSW backend (pure Python) if on Apple Silicon; it's slower but requires no C++ compilation.
- **Docker alternative:** the LEANN Docker image avoids all dependency issues but adds a container layer. For MCP use, run the Docker container and expose port 8788; this is the fastest path on a first setup.
- **Index quality:** default chunking on Markdown files may split code blocks or list items awkwardly. After indexing, test retrieval on 20 queries and tune `--chunk-size` and `--overlap` if too many results are partial.
- **Privacy:** LEANN indexes your data locally and sends queries to your chosen LLM. If you use the Anthropic API for the LLM step (not local Ollama), query text leaves your machine. Use Ollama for the LLM step if full local privacy is required.
- **Index rebuild cost:** reindexing 10,000 files takes 5–30 minutes depending on file size and machine. Plan around this; use `--diff` mode for incremental updates after the initial build.

# book-to-skill — Technical Book → Claude Code Skill Compiler

**Source:** [github.com/virgiliojr94/book-to-skill](https://github.com/virgiliojr94/book-to-skill)  
**Stars:** 15,937 (+5,405 this week) · **Language:** Python · **License:** MIT  
**Date discovered:** 2026-08-04

## What it is

A CLI tool that turns any technical document (PDF, EPUB, Word, Markdown) into a structured Claude Code skill — a set of modular files that an AI agent loads on demand instead of reading the raw document in full.

The key insight: **compile-time extraction beats runtime retrieval.** Instead of pasting 500 pages into context (or using RAG that retrieves noisy chunks), the tool pre-processes the document once into per-chapter summaries, glossaries, pattern guides, and Q&A pairs. When you ask Claude about a specific topic, only the relevant chapter file loads — "24×–51× fewer tokens than dumping the book into context."

Usage: `book-to-skill ~/pragmatic-programmer.pdf` → creates a `pragprog/` skill folder in your agent's skills directory.

## Why it fits

- Core interest: **Claude/LLM tooling** — reduces token waste for every coding session
- Works with any technical reference you already own (language specs, architecture books, API manuals)
- **Dev productivity**: reference books become queryable without hallucination or full-context bloat
- Weekend-buildable: the hard version is done; building your own format-specific extractor is 1 Claude session
- Novel architecture: compile-time vs retrieval-time is a meaningful distinction from RAG

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Use the existing tool, or build a simplified PDF→skill extractor in one session |
| fills_gap | 1 | Technical reference books are the worst-supported context source in current agent workflows |
| novel | 1 | Compile-time extraction with per-chapter modular loading is distinct from RAG |
| daily_utility | 1 | Every coding session that references a spec, manual, or book benefits |
| **Total** | **4/4** | **VIABLE** |

## Stack Recommendation

```
Python 3.11+
docling — technical PDF extraction (handles code blocks, tables, math)
ebooklib — EPUB support
python-pptx — Word/PPTX if needed
Claude API (claude-sonnet-5) — per-chapter analysis and summary generation
SKILL.md format — output compatible with Claude Code, Codex, Amp
```

For building your own version, you need only: docling + Claude API + filesystem writes.

## MVP Scope (1 Claude session)

Single-format extractor: PDF → Claude skill.

1. Extract text by chapter using docling (respects headings hierarchy)
2. For each chapter, call Claude to produce: 1-paragraph summary, 10-term glossary, 3-5 key patterns with code examples
3. Write one Markdown file per chapter into `~/.claude/skills/<book-slug>/chapters/`
4. Write a root `SKILL.md` that indexes the chapters and explains the query interface
5. Test: ask Claude Code `/pragprog what does "tell don't ask" mean?` — it should load only chapter 3

## Phases

### Phase 1: PDF Extraction (2-3h)
- Install docling, write `extract_chapters(pdf_path) -> list[Chapter]`
- Preserve code blocks and headings structure
- Test on a real technical PDF (e.g., Structure and Interpretation of Computer Programs)
- Handle PDFs without clear chapter structure (fall back to page-window chunking)

### Phase 2: Claude Analysis (2-3h)
- For each chapter: send text to Claude, get back JSON: `{summary, glossary, patterns}`
- Rate-limit to avoid API throttling (1 request/second)
- Cache results to disk so re-runs don't re-spend tokens
- Cost estimate: a 400-page book ≈ 50 chapters × ~3k tokens = ~150k tokens total (~$1.50 at Sonnet 5 pricing)

### Phase 3: Skill File Generation (1-2h)
- Write one `.md` file per chapter under `~/.claude/skills/<slug>/`
- Generate root `SKILL.md` with: what the book covers, how to query it, chapter index
- Test all generated files parse without errors

### Phase 4: Query Interface (2h)
- Add a top-level `SKILL.md` skill definition with a `query(topic)` pseudofunction
- Claude loads the index, identifies the right chapter(s), returns structured answer
- Test: known-answer questions against the actual book text

### Phase 5: EPUB + Batch Mode (2h)
- Add EPUB support via ebooklib (most O'Reilly/Manning books)
- Add `--batch` flag: process a whole `~/Books/` folder overnight
- Auto-detect format by file extension

## Effort Estimate

| Phase | Hours |
|-------|-------|
| PDF Extraction | 2-3h |
| Claude Analysis | 2-3h |
| Skill Generation | 1-2h |
| Query Interface | 2h |
| EPUB + Batch | 2h |
| **Total** | **9-12h (~1-2 weekends)** |

Phase 1-3 (working MVP for one PDF): **5-8h (1 weekend session)**.

## Blockers / Risks

- PDFs without machine-readable text (scanned, image-only) need OCR — add a check upfront and skip or warn
- Technical PDFs with heavy math notation may not extract cleanly — docling handles LaTeX well, but test first
- Per-chapter Claude API calls add cost: estimate before running on a 1,000-page book
- Skills are static snapshots — if you update the book edition, you need to re-run the pipeline; add a `--force` flag
- Claude skill loading requires correct SKILL.md format — test with Claude Code's `/skill` command before declaring done

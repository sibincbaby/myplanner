# EngineerKit

> Three Claude Code skills that enforce engineering discipline — test-first development, architecture drift detection, and deep requirement grilling — before Claude writes a single line of production code

**Inspired by:** [mattpocock/skills](https://github.com/mattpocock/skills) (GitHub discovery July 27 2026)  
**Date discovered:** 2026-07-27

---

## What gap it fills

AI coding agents write code instantly but skip the engineering fundamentals that make it maintainable: they don't write failing tests first, don't check if a new class breaks the existing architecture, and don't surface ambiguous requirements before building. mattpocock/skills addresses this with a set of engineering skills — `/tdd`, `/improve-codebase-architecture`, `/grill-with-docs`. The gap in the user's toolkit: no equivalent Claude Code skill that runs a **stateful TDD loop** (write test → confirm it fails → write impl → confirm it passes → refactor → repeat), and no architecture-drift scanner that compares new code against the project's existing patterns documented in CLAUDE.md.

This differs from Personal Skill Forge (July 21), which focused on personal workflow automation (standup drafts, diff reviews). EngineerKit is about engineering methodology: it changes *how* Claude Code writes code, not just *what* it automates.

## Stack recommendation

Skills are markdown files — no external dependencies required.

| Artifact | Location | Purpose |
|----------|----------|---------|
| Skill files | `.claude/skills/` or `~/.claude/skills/` | Invocable by `/tdd-cycle`, `/arch-scan`, `/req-grill` |
| Optional hook | `.claude/settings.json` `PostToolUse` | Auto-run `/arch-scan` after Write tool on `*.py` / `*.ts` files |
| Optional shell script | `.claude/bin/check-arch.sh` | Compares new file against architecture rules in CLAUDE.md |
| Config | `.claude/engineerkit.md` | Project-specific rules: test framework, architecture patterns |

## MVP scope (1 Claude session)

Three skills covering the three highest-entropy moments in AI-assisted development:

| Skill | Trigger | What it enforces |
|-------|---------|-----------------|
| `/tdd-cycle` | Before writing any function | Write failing test first; halt until red; write minimal impl; confirm green; only then refactor |
| `/arch-scan` | After writing a new file or module | Compare against CLAUDE.md architecture rules; flag coupling violations, missing abstractions, layer boundary breaks |
| `/req-grill` | Before starting any new feature | 15 targeted questions that surface ambiguous requirements, edge cases, and non-functional constraints |

## Phases

### Phase 1 — `/tdd-cycle` skill (1 h)
- Skill opens by auto-detecting the test framework: checks `pyproject.toml` for pytest, `package.json` for jest/vitest, `go.mod` for Go, `Cargo.toml` for Rust
- Step 1: "Write a failing test for `{function_name}`. Do NOT write the implementation yet. Run the test and confirm it is RED."
- Step 2: Waits for test output showing failure; if test passes immediately, flags "test may be vacuous — check assertion"
- Step 3: "Write the minimal implementation to make the test GREEN. No extra logic beyond what the test requires."
- Step 4: Confirms green run, then: "Now refactor for clarity only — no new behavior. Re-run tests to confirm still GREEN."
- Step 5: Prompts for next test case or exits cycle
- Skill file: ~80 lines of markdown with clear step markers

### Phase 2 — `/arch-scan` skill (45 min)
- Opens CLAUDE.md and reads the "Architecture" or "Structure" section (if present); falls back to inferring patterns from directory layout
- Checks the newly written file against 5 rules:
  1. Layer boundary: does a data-layer file import a presentation-layer module?
  2. Circular imports: does the new file create an import cycle?
  3. God class: does the new class have more than N public methods (configurable)?
  4. Direct DB access: does a non-repository file call the database directly?
  5. Undocumented public function: new public function missing a docstring?
- Reports violations as a numbered list with the specific line; no violations → "Architecture looks clean ✓"
- Claude handles the actual code reading; the skill provides the checklist and framing

### Phase 3 — `/req-grill` skill (30 min)
- 15 structured questions organized in 3 rounds:
  - **Round 1 — Scope** (5 Qs): "What is the minimum behavior that makes this feature done?", "What are the explicit error cases?", "Who calls this and when?", "What data does it read/write?", "What should NOT change?"
  - **Round 2 — Edge cases** (5 Qs): boundary conditions, null/empty inputs, concurrent access, rollback behavior, rate limits
  - **Round 3 — Non-functional** (5 Qs): latency budget, auth/permissions, logging requirements, backward compatibility, testability
- After all 15: summarize as a brief spec and ask "Does this match your intent? Reply YES to proceed or clarify."
- Skill gates Claude from starting implementation until user confirms YES

### Phase 4 — Optional PostToolUse hook (45 min)
- `PostToolUse` hook in `.claude/settings.json` triggered when Claude uses the `Write` tool on `*.py`, `*.ts`, or `*.go` files
- Hook calls `.claude/bin/check-arch.sh <file>` which greps for common violations (circular import patterns, direct DB calls in non-repo files)
- If violations found: hook prints a warning block that appears in Claude's context before next tool use
- This makes `/arch-scan` automatic without requiring the user to invoke it manually

### Phase 5 — Install script + documentation (30 min)
- `install.sh`: copies the 3 skill files into `~/.claude/skills/` or `.claude/skills/` based on `--global` / `--project` flag
- `engineerkit.md` template: drop-in config file with test framework, architecture rules, module boundaries — Claude reads this at skill start
- README: before/after examples showing a TDD session, an arch-scan catching a circular import, a req-grill surfacing a missing error case

## Effort estimate

~3 hours Phases 1–3 (three working skills) · 1 Claude session  
~4 hours with hook and install script

## Blockers / risks

- **TDD skill needs test framework detection**: solved by reading `pyproject.toml`/`package.json`/`go.mod` at skill start. Add a `--framework` flag for edge cases.
- **Arch-scan relies on CLAUDE.md quality**: if CLAUDE.md has no architecture section, the skill falls back to heuristics. Include a `CLAUDE.md` template in the README with a recommended architecture section.
- **`/req-grill` can feel slow for small changes**: add a `--quick` flag that runs only Round 1 (5 questions) and skips Round 2–3 for minor changes.
- **PostToolUse hook is Claude Code-only**: the shell check-arch script is portable, but the hook wiring is specific to Claude Code's settings.json. Document the Cursor/Codex equivalents separately.
- **Overlap with mattpocock/skills**: this IS inspired by his work. The distinction is that EngineerKit is a personal, minimal fork focused on 3 specific methodology gates rather than a broad catalog. Credit him in the README.

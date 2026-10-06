# Impeccable — AI Design Language for Better UI

**Source:** <https://github.com/pbakaus/impeccable>
**Discovered:** 2026-10-06
**Viability:** 4/4

> Open-source AI design skill by Paul Bakaus (ex-Google) that gives AI coding assistants the vocabulary to produce polished, craft-quality UI code. One skill file, 23 specific commands, and a curated anti-pattern library. Supports Cursor, Claude Code, Gemini CLI, Codex CLI, VS Code Copilot, Kiro, OpenCode, and Pi. Measured +59% quality improvement without changing models.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 1/1 |
| **Total** | **4/4** |

Every AI-generated UI hits the same wall: Inter font, purple gradients, nested cards, and gray text on colored backgrounds. Impeccable is the gap-filler — a single skill install that gives Claude Code a design vocabulary it didn't have before. Weekend-buildable because setup is under 10 minutes: install the skill, verify with a sample component. Novel because no comparable open-source design-language-for-AI exists. Daily utility because it improves every UI session without any extra prompting once installed.

---

## Implementation Plan

**Half a Claude Code session** to install and verify across your active projects.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Install method | `npx skills add pbakaus/impeccable` | Official install, auto-updates |
| Targets | Claude Code, Cursor, Gemini CLI | All supported; one install covers all |
| Validation | Sample component build | See the difference immediately |

---

## MVP Scope

1. Install Impeccable via `npx skills add pbakaus/impeccable`
2. Open Claude Code or Cursor in a project with a UI component
3. Ask Claude to rebuild one existing component using Impeccable conventions
4. Compare before/after — the difference in padding, typography, contrast, and spacing is immediate
5. Wire to CI: add `impeccable validate` step to pre-commit (if supported) to enforce conventions

Out of scope for MVP: custom design token overrides, per-project rule additions, CI integration beyond the hook.

---

## Implementation Phases

### Phase 1: Install + smoke test

**Goal:** Impeccable installed and active in your coding environment.

**Steps:**
1. `npx skills add pbakaus/impeccable` — installs the skill globally for Claude Code
2. For Cursor: copy the `.cursorrules` file from the Impeccable GitHub repo to your project root
3. For Gemini CLI: add the Impeccable GEMINI.md to your project's `~/.gemini/skills/`
4. Smoke test: ask Claude to "build a settings card with a toggle and save button" — verify output uses correct spacing tokens, no gradient backgrounds, proper contrast
5. Verify: the output reads noticeably more professional vs a default Claude response

---

### Phase 2: Per-project customization

**Goal:** Impeccable tuned to your project's existing design system.

**Steps:**
1. In your project root, create `IMPECCABLE.local.md` with project-specific overrides (color tokens, font, brand spacing unit)
2. Reference your Tailwind config or CSS variables in the override file so Impeccable outputs your actual tokens
3. Test: build a new component and verify it uses project tokens, not Impeccable defaults
4. Add to `.claude/settings.json` via `skills` key so it loads automatically in every session

---

### Phase 3: Team rollout

**Goal:** All AI sessions in the repo use Impeccable conventions.

**Steps:**
1. Commit the Impeccable skill reference to `CLAUDE.md` (`## Skills` section)
2. Add `CURSOR.md` / `GEMINI.md` references for teammates using other tools
3. Short Loom walkthrough for the team (2 min): what Impeccable changes and why
4. Optionally: add `impeccable audit` to CI to report (not block) design anti-patterns in AI-authored PRs

---

## Estimated Effort

About 30 minutes to install + verify, 1 hour for per-project customization.

- **10 min:** Install + smoke test
- **30 min:** Per-project token overrides
- **20 min:** Verify across 3-4 typical component requests

## Potential Blockers

- **Already in Copilot:** GitHub built Impeccable into Copilot Pro/Enterprise. If you primarily use VS Code + Copilot, you may already have it — check Copilot skill settings before installing manually.
- **Design token mismatch:** Impeccable ships with default tokens; without the local override file, it will suggest its own colors rather than your project's. Budget the customization phase to get full value.
- **Multi-tool installs:** Each editor (Cursor, Gemini CLI, Claude Code) needs its own install or config file. The `npx skills add` command handles Claude Code; others require the manual copy steps.
- **22k stars, mature:** Impeccable is past the "new" stage (released Feb 2026). The April v1.5.1 release added the audit command and Kiro/OpenCode support. Skip older tutorials and go straight to the GitHub README.

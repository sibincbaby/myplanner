# SkillPilot

> Auto-skill-injector for Claude Code: a meta-skill manager that detects your project type and automatically loads the right skill manifests into CLAUDE.md — so Claude always has the right tools loaded without manual configuration.

**Inspired by:** [zap-coding-agent/zap-coding-agent](https://github.com/zap-coding-agent/zap-coding-agent)  
**Date discovered:** 2026-07-31

---

## What gap it fills

Zap's breakthrough idea is *skill-injection*: instead of loading every possible context into every session (which bloats tokens), you inject only the skills relevant to the current task. Claude Code has a skills system, but it requires manual skill invocation or always-on CLAUDE.md declarations — there's no mechanism that detects "this is a Flutter project" and auto-loads the Flutter skill, or "you're editing a Supabase migration" and loads the Supabase skill.

SkillPilot is that mechanism. A lightweight Python watcher monitors your working directory, fingerprints the project (package.json → Node/React; pubspec.yaml → Flutter; pyproject.toml → Python; supabase/ → Supabase; etc.), and rewrites a `CLAUDE.md` project-skills block to include only the relevant skill manifests. Claude Code picks this up on the next session start and already knows the stack without you typing a word.

Concrete daily value: switch from a Flutter repo to a Python FastAPI project — SkillPilot rewrites the skills block in under a second. Claude Code opens knowing the API patterns, not the widget API.

Viability score: **4/4** (weekend_buildable ✅, fills_gap ✅, novel ✅, daily_utility ✅)

---

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Watcher | Python `watchdog` | Cross-platform FS events, minimal overhead |
| Detector | Heuristic file-presence checks | `pubspec.yaml` → Flutter, `package.json` → Node, etc.; no heavy tooling |
| Skills library | Local `~/.claude/skills/` SKILL.md files | One per stack; Claude Code auto-discovers |
| Injector | Python `re` + string replace on CLAUDE.md | Simple, no AST needed |
| CLI | Python `typer` with `start`/`stop`/`status` commands | User-friendly daemon control |
| Config | `~/.skillpilot/config.toml` | Maps file fingerprints to skill file paths |

---

## MVP scope (1-2 Claude sessions)

**Session 1 — Detector + injector:**
- `detect.py`: scans CWD for `pubspec.yaml`, `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `supabase/`, `requirements.txt` and returns an ordered list of matched stacks
- `inject.py`: reads current `CLAUDE.md` (or creates it), finds/replaces the `<!-- skillpilot -->…<!-- /skillpilot -->` block, writes the matched skills as `@skill <path>` lines
- CLI: `skillpilot inject` (one-shot run), `skillpilot watch` (daemon mode via watchdog)
- Test: switch between 3 project types, verify CLAUDE.md block updates correctly each time

**Session 2 — Skills library + polish:**
- Write 4 initial SKILL.md files: Flutter, Node/React, Python/FastAPI, Supabase
- Add `skillpilot add <stack> <skill-path>` to register custom skills
- `skillpilot status` shows detected stacks and loaded skills for CWD
- Optional: git post-checkout hook to auto-run inject on branch switches

---

## 3-Phase roadmap

### Phase 1 — Detect + inject (Session 1)
File-fingerprint detector. One-shot `inject` command that rewrites the CLAUDE.md skills block. Core daemon with `watchdog`. Covers the 5 most common stacks.

### Phase 2 — Skills library (Session 2)
6–8 curated SKILL.md files covering Flutter, React, Python, Go, Rust, Supabase, Firebase, and MCP servers. `add`/`list`/`remove` commands for the local skills registry. Git checkout hook installer.

### Phase 3 — Smart context (Session 3)
Beyond stack detection: detect *task type* from recent git diff (migrations? UI? API?) and inject the matching sub-skill. Optional: auto-compact session history when approaching context limit, borrowing Keen Code's TurnMemory idea.

---

## Effort estimate

| Phase | Effort | Output |
|-------|--------|--------|
| Phase 1 | 1 Claude session (~60 min) | Working `inject` + `watch` daemon |
| Phase 2 | 1 Claude session (~90 min) | 8 SKILL.md files + full CLI |
| Phase 3 | 1 Claude session (~90 min) | Task-type detection + auto-compact |

Total: **3 sessions, ~4 hours elapsed**

---

## Blockers / watch-outs

- **CLAUDE.md collision**: If CLAUDE.md has no sentinel comment block, injector must preserve all existing content and only append the skills block — never overwrite. Parse carefully.
- **Monorepo ambiguity**: A repo with both `pubspec.yaml` and `package.json` (Flutter + web) should load both skill sets; test this case explicitly in Session 1.
- **Daemon permissions**: On macOS, `watchdog` may need full-disk-access if watching directories outside the home folder — document this clearly.
- **Skill staleness**: If skills are updated, the watcher should re-inject. Track skill file mtimes alongside project fingerprints.

---

## Why now

Zap's 465-commit Rust implementation proves the skill-injection pattern works at scale in production coding agents. The Claude Code skills system (`SKILL.md`, `@skill` directives) already provides the injection surface — SkillPilot is the missing auto-loader that makes the skill ecosystem actually ergonomic. With the Claude Code ecosystem maturing rapidly (Skills, hooks, CLAUDE.md conventions), building the "wrong skills loaded" problem away in a single weekend is genuinely tractable and will compound across every future coding session.

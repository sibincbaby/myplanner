# open-design — Open-Source Claude Design Alternative

**Source:** <https://github.com/nexu-io/open-design>
**Discovered:** 2026-07-08
**Viability:** 3/4

> Claude/LLM tooling + Agent UIs + Dev productivity — the DESIGN.md-driven generator pattern is the core takeaway; a personal fork with a curated design-system library and Claude Code / Codex integration fills the "AI prototype generator" gap in the user's toolkit.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

weekend_buildable: The upstream open-design is a large project (v0.13.0, 259 skills, 142 design systems, 40k+ stars) but the core mechanic — a DESIGN.md schema file that an AI coding agent reads before generating HTML/slides/images — is extractable and portable. A simplified personal fork with ~10 design systems, a Claude Code skill, and an HTML/PDF export pipeline is a focused 1-2 session build. The user doesn't need to replicate the full 16-agent parallel renderer; a single-agent "read DESIGN.md → generate artifact" skill is the weekend-scale MVP. Score 1.

fills_gap: The user's toolkit covers agent chat UIs, session management, and MCP tooling in depth, but there is no AI-native prototype/landing-page/slide generator tied to a personal design system schema. open-design's DESIGN.md pattern — palette, type, spacing, motion, voice, anti-patterns in one structured file — is a reusable primitive that sits upstream of any specific output format. Score 1.

novel: With 40k+ stars, a polished versioned release cadence (v0.13.0), and a live comparison site (open-design.ai vs claude-design.anthropic.com), this is an established OSS product rather than a niche tool. The user would adopt/fork rather than build something novel. Score 0.

daily_utility: Any day involving a UI prototype, a landing page, a slide deck, or a design handoff would open this. The daily cadence is real if the user does any design-adjacent work during development (scaffolding new project UIs, generating proposals, building demos). Score 1.

---

## Overview

open-design is a local-first desktop app (Tauri shell) that turns AI coding agents into a design engine. The core primitive is `DESIGN.md` — a 9-section schema covering palette, typography, spacing, motion, voice, and anti-patterns. Every generate call reads the active `DESIGN.md` and produces output that adheres to that design system.

The upstream project ships 142 brand-grade design systems (Linear, Stripe, Vercel, Apple, Notion, Anthropic, Cursor, Supabase…) and 259 composable skills, but the key insight for a personal build is simpler: **write one DESIGN.md for your own brand, point a Claude Code skill at it, and you have an AI that generates consistent artifacts every time.**

Outputs: HTML prototypes, landing pages, dashboards, slide decks (PPTX), images, and video — exported to real files.

## Stack Recommendation

- **Agent:** Claude Code (primary), Codex or Gemini CLI as fallback via BYOK.
- **DESIGN.md schema:** 9 sections — palette (hex + semantic tokens), type (font stack, scale, weight), spacing (base unit, scale), motion (easing, duration), voice (tone, anti-patterns), components (atomic list), patterns (page layout rules), exports (target formats), and meta (project name, version).
- **Skill layer:** A Claude Code skill `generate-artifact` that reads `./DESIGN.md`, accepts an intent prompt, and writes the output to `./output/<slug>/index.html`.
- **Export pipeline:** Playwright headless for HTML → PDF/PNG; `pptxgenjs` for slide export; `ffmpeg` for video if needed.
- **Desktop shell (optional):** Tauri 2 wrapping a Vite/React preview panel; for MVP a `file://` browser tab or `npx serve` is fine.

## MVP Scope

**In scope:**
- `DESIGN.md` template with the user's own brand tokens.
- A Claude Code skill that reads `DESIGN.md` and generates a styled HTML artifact from a one-line intent prompt.
- Live preview (browser tab or Vite dev server).
- HTML → PDF export via Playwright.
- 5–10 seed design systems from the upstream repo (copy the Markdown files; no build step needed).

**Out of scope for MVP:** the full 16-agent parallel renderer, video export, PPTX generation, the Tauri desktop shell, the design-handoff JSON output, and all 142+ upstream design systems.

## Implementation Phases

### Phase 1: DESIGN.md schema + Claude Code skill
**Goal:** `claude "generate a pricing page"` reads `DESIGN.md` and writes `output/pricing/index.html`.

- Define `DESIGN.md` with the user's palette, type scale, spacing base, voice rules, and 5 anti-patterns.
- Write a Claude Code skill (`skills/generate-artifact.md`) with the instruction: read `./DESIGN.md`, parse the palette + type tokens, then generate a self-contained HTML file that uses those tokens inline (no CDN, no external fonts — embed everything). Write to `./output/<slug>/index.html`.
- Test: `claude --skill generate-artifact "a minimal hero section with a CTA"` → open the file.

### Phase 2: 5 seed design systems + switcher
**Goal:** Switch between your brand and 4 upstream design systems (e.g. Linear, Vercel, Stripe, Anthropic) by setting `DESIGN.md`.

- Copy 5 upstream `DESIGN.md` files from `nexu-io/open-design/design-systems/`.
- Add a tiny shell script `./use-design.sh <name>` that symlinks the chosen file to `./DESIGN.md`.
- Verify the same intent prompt produces visually distinct output across systems.

### Phase 3: HTML → PDF export
**Goal:** `./export.sh output/pricing` produces `output/pricing/pricing.pdf`.

- Install Playwright: `npx playwright install chromium --with-deps`.
- Write `scripts/export-pdf.ts`: launch Chromium, navigate to `file:///path/to/index.html`, `page.pdf({ format: 'A4', printBackground: true })`.
- Add `npm run export -- output/pricing` to package.json.

### Phase 4: Live preview panel (Vite)
**Goal:** `npm run preview` opens a hot-reloading browser panel that watches `./output/` and refreshes on new files.

- Scaffold a minimal Vite app with an `<iframe>` pointing at the most recently modified file in `./output/`.
- Use `chokidar` to watch `./output/**/*.html` and post a message to the iframe to reload.
- Optionally add a sidebar listing all output slugs for quick navigation.

### Phase 5 (optional): Tauri desktop shell
**Goal:** Ship as a native macOS app bundling the preview panel and the Claude Code skill runner.

- `npm create tauri-app` wrapping the Vite frontend.
- Sidecar-spawn the Node skill runner from Tauri's `Command` API.
- Add a menu bar shortcut to trigger generation from a spotlight-style input.

## Estimated Effort

**2–3 Claude Code sessions.**

- **Session 1 — Phases 1 & 2:** DESIGN.md schema, the Claude Code skill, and 5 seed design systems. This is the load-bearing MVP: one command generates a styled artifact.
- **Session 2 — Phase 3 & 4:** PDF export pipeline and the live preview Vite panel. End of this session the tool is genuinely daily-usable.
- **Session 3 (optional) — Phase 5:** Tauri packaging. Skippable; the browser-based preview is already good.

## Potential Blockers

- **DESIGN.md token fidelity:** Claude Code reads the schema as prose; if token names are ambiguous (e.g. "neutral-200" vs "gray-200"), the generated CSS may drift from the spec. Mitigate by using explicit hex values and a dedicated `<!-- tokens -->` section the skill is instructed to parse first.
- **Self-contained HTML constraint:** No CDN or external font fetching means all assets must be inlined (base64 images, `@font-face` with data URIs). For large fonts this inflates file size; cap font subsets with `fonttools` or use system-safe stacks (Inter, -apple-system).
- **Playwright PDF fidelity:** CSS `@page`, viewport scaling, and `printBackground` interact in non-obvious ways. Budget 30–60 min to tune PDF output; keep an `--html-only` mode as the primary deliverable.
- **Upstream design-system file format changes:** If the upstream `DESIGN.md` files change schema between open-design releases, the skill instruction may need updating. Pin to a specific tag when copying seed files.

# DesignLens

> A machine-readable design system specification format — YAML tokens for values, markdown prose for rationale — that lets Claude Code and any coding agent produce UI-consistent output across every session without re-reading design docs from scratch

**Inspired by:** [google-labs-code/design.md](https://github.com/google-labs-code/design.md) (GitHub trending July 28 2026)  
**Date discovered:** 2026-07-28

---

## What gap it fills

Coding agents make UI inconsistencies by default: wrong shade of blue, wrong border-radius, arbitrary spacing that doesn't match the rest of the app. The root cause is that design context lives in human docs (Figma links, PRDs) the agent can't access inline. `design.md` by Google Labs proves the concept but is in alpha with a complex CLI and ecosystem requirements.

DesignLens is a personal implementation: one `DESIGN.md` file at your project root, read by Claude Code on every session via a CLAUDE.md instruction. Tokens are in YAML front matter (exact values); rationale is markdown prose (the *why*). Claude Code reads both and applies them without drift. A tiny TypeScript validator/exporter is the only tooling needed.

Concrete daily value: open a new Claude Code session to build a Flutter widget or a web component, and it already knows your primary color is `#2563EB`, your default radius is `8px`, your body font is `Inter`, and *why* the spacing scale follows 4px multiples. No pasting Figma links. No "make it look like the rest of the app."

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Spec format | YAML front matter + Markdown body (`.md`) | Claude reads markdown natively; YAML is machine-parseable |
| Token types | Colors (hex/CSS), dimensions (px/rem/em), typography objects, component map | Covers 90% of design decisions |
| Validator | TypeScript CLI (`tsx`) | Fast, zero-config, runs in a single file |
| Exporter | Tailwind `theme.extend` JSON + W3C Design Tokens JSON | Plugs into existing build tools |
| Integration | `CLAUDE.md` `#init` or `#file:DESIGN.md` reference | Claude Code auto-reads on session start |

## MVP scope (1 Claude session)

A `DESIGN.md` file for your own project plus a validator script:

1. Defined `DESIGN.md` format with YAML front matter schema (colors, typography, spacing, radii, shadows, components)
2. Prose sections explaining the design philosophy (why these values, what principles to follow)
3. A `validate-design.ts` script that type-checks the YAML front matter against the schema
4. A `export-tailwind.ts` script that generates `tailwind.design.config.js` from tokens
5. A `CLAUDE.md` snippet that instructs Claude Code to read DESIGN.md on session start and apply it to all UI code

Out of scope for MVP: web UI editor, VS Code extension, Figma token sync, multi-theme support.

## Phases

### Phase 1 — Define the spec format (1 h)
- Draft the YAML front matter schema: `colors`, `typography`, `spacing`, `radii`, `shadows`, `components`
- Each token: `name`, `value`, `description` (the why)
- Component map: `button.primary → { background: primary.500, radius: md, padding: 3 4 }`
- Write your own project's `DESIGN.md` as the reference implementation — real values, real rationale

### Phase 2 — Validator CLI (1.5 h)
- `validate-design.ts`: parse YAML front matter with `gray-matter`, validate types with `zod`
- Report: missing required fields, invalid hex codes, unknown dimension units, undefined component references
- Exit code 1 on error, 0 on success — plug into CI pre-commit hook
- `npx tsx validate-design.ts DESIGN.md`

### Phase 3 — Tailwind exporter (1 h)
- `export-tailwind.ts`: read validated tokens, write `tailwind.design.config.js` with `theme.extend`
- Colors: `colors.primary.500 = '#2563EB'` etc.
- Typography: `fontFamily.body = ['Inter', 'sans-serif']`
- Spacing + radii in `theme.extend.spacing` and `theme.extend.borderRadius`
- Append `require('./tailwind.design.config.js')` to project `tailwind.config.js`

### Phase 4 — CLAUDE.md integration (30 min)
- Write the `CLAUDE.md` section that instructs Claude Code: "Before writing any UI code, read DESIGN.md and apply its tokens and rationale to maintain visual consistency."
- Include example: "When in doubt between two values, pick the one that aligns with the spacing-scale principle in DESIGN.md."
- Add `#file:DESIGN.md` to the CLAUDE.md `#init` block if the project uses that pattern

### Phase 5 — W3C Design Tokens export (30 min)
- `export-w3c.ts`: emit `design.tokens.json` in W3C Design Tokens format
- Enables use with Style Dictionary, Token Studio, and other design-system toolchains
- One JSON structure, composable with existing tooling

## Effort estimate

~4.5 hours all phases · 1 Claude session  
Phases 1–4 alone deliver full value in ~4 hours — Phase 5 is bonus

## Blockers / risks

- **Overlap with Open Design (2026-07-08):** Open Design was about AI-generated design systems from component libraries. DesignLens is a format spec for communicating *existing* design decisions to agents — no overlap.
- **DESIGN.md vs CLAUDE.md:** DESIGN.md is not a replacement for CLAUDE.md — it's a domain-specific companion. Clarify the distinction in the README.
- **Flutter specifics:** Flutter uses `ThemeData`, not Tailwind. Add a Phase 6 (optional) `export-flutter.dart` that generates a `theme.dart` from tokens for Flutter projects.
- **Token drift over time:** As the project evolves, tokens must be updated or Claude will generate inconsistent UI. Add a `# Last updated:` field and remind in `CLAUDE.md` to check the date.
- **Google Labs alpha status:** The upstream `design.md` spec may evolve; DesignLens is a personal implementation with no dependency on the upstream project.

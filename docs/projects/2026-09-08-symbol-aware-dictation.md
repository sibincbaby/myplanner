# sarika-voice — Dictation That Knows Your Codebase's Identifiers

**Source:** [lvampa/sarika-voice](https://github.com/lvampa/sarika-voice) · Rust · GitHub (created 2026-09-07)
**Date discovered:** 2026-09-08

## What it is

A local dictation tool that harvests the symbol table of the project you are sitting in — function names, type names, variables, module paths — and uses it to correct what the speech-to-text model heard into the names your codebase actually contains.

The problem it targets is specific and well-documented. General ASR is trained on prose, so it transcribes spoken identifiers as the English words they sound like: `getUserId` comes out "get user I D", `os.path` becomes "OS path", `mmap` becomes "map", `stdin` becomes "standard in". Every dictated line then needs manual repair, which costs more time than typing it would have. The arXiv paper _Lost in Transcription: How Speech-to-Text Errors Derail Code Understanding_ (2601.15339) measures exactly this failure, and notes that the worst cases are identifiers that resemble real words — `map`, `sum`, `list` — because the model has no reason to prefer the code reading.

The repo itself is an early walking skeleton (default branch is literally `worktree-sarika-phase1-walking-skeleton`, 0★), so this entry is the **thesis** being logged as viable, not the implementation. Build it; don't install it.

## Why it fits

- Core interest: **Dev productivity / voice tools** — named explicitly in the interest profile
- Core interest: **Claude/LLM tooling** — the highest-value target is dictating prompts into a Claude Code session, where identifiers appear constantly
- `novel = 1`: see the prior-art check below — this one actually survived it
- `daily_utility = 1`: a dictation daemon is either always running or worthless; there is no occasional-use mode

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Record → faster-whisper → fuzzy-correct → type. Four moving parts, all with existing libraries |
| fills_gap | 1 | The installed `voice-coder` skill transcribes an existing audio *file*; there is no live dictation path and no symbol correction anywhere in the toolkit |
| novel | 1 | The dominant tool has this as an **open, unshipped issue**; the only direct implementation is a 0★ VS Code extension |
| daily_utility | 1 | Always-on input method; every prompt and every comment goes through it |
| **Total** | **4/4** | **VIABLE** |

### Prior-art check (the 08-18 rule)

Ran the candidate's own thesis, then broadened the phrasing three times. What the lane actually contains:

- **The dictation-app lane is saturated but solves a different problem.** `whisperkey`, `IrisFlow`, `my-local-whisper`, `vlocal`, `WhisperType-Android`, `unmuddle`, `voice-to-clipboard` were all created in this same 48-hour window. Every one of them is hold-key → speak → paste raw Whisper output. None of them look at the project you are in. They are competitors for "dictation," not for "dictation that knows your symbols."
- **The voice-*coding* lane is grammar-based, not dictation-based.** Talon Voice and Cursorless are command grammars — you learn a spoken DSL and speak commands, not English. Serenade tried the natural-language route and is effectively dead. Neither is "speak normally, get the right identifiers."
- **The decisive signal:** [github/copilot-cli#3806](https://github.com/github/copilot-cli/issues/3806) is an **open feature request** asking for precisely this — a custom dictionary auto-seeded from the repo and open files. The market-leading agent CLI has the problem filed and unshipped.
- **Closest direct hit:** `dimastatz/whisper-code` (0★, VS Code-only, "biases transcription with your work"). A 0★ editor extension is not a polished widely-used OSS clone.
- Contextual biasing of Whisper is an active *research* topic (arXiv 2410.18363, 2502.11572), which means the technique is proven but not yet productized for this use case.

Verdict: `novel = 1` holds. This is the rare case where the gap is documented by the incumbent's own issue tracker.

## Stack Recommendation

```
Language:   Python 3.11 (fastest path to a working daemon; python3 already present)
ASR:        faster-whisper (pip install faster-whisper) — local, CTranslate2, runs on CPU
Symbols:    ctags -R -x   (parses 40+ languages, already packaged)
            fallback: regex identifier harvest over `git ls-files`
Correction: rapidfuzz (pip) — token-level fuzzy match against the symbol table
Typing:     wtype (Wayland) / xdotool (X11), chosen by $WAYLAND_DISPLAY
Hotkey:     the desktop environment's own keybinding UI → `sarika toggle`
Storage:    none
```

**Ladder notes.** Skipped tree-sitter: `ctags` already parses every language you use and ships as a distro package, so a tree-sitter grammar set per language buys nothing here. Skipped a global-hotkey library: GNOME/KDE/Sway all have a keybinding settings page, so the hotkey is a config line the user writes once, not a dependency. Skipped a database: the symbol table is derived, so regenerate it rather than store it.

## MVP Scope

Hold hotkey → record → transcribe biased toward the current project's symbols → fuzzy-correct the near-misses → type the result into whatever window has focus.

Out of scope for the MVP: punctuation commands, editor integration, streaming/partial results, multi-language models, any GUI.

## Phases

### Phase 1 — Walking skeleton
Record from the default input device while a flag file exists; feed the WAV to faster-whisper; print the transcript to stdout. No symbols, no typing. Verifies the audio path and model load, which is where setup pain actually lives.

**Check:** speak one sentence of prose, get it back on stdout.

### Phase 2 — Symbol table
`ctags -R -x` over the repo root (detected by walking up to `.git`), reduced to a frequency-ranked identifier list. Cache in memory, invalidate on a cheap mtime check of the index. Feed the top ~200 tokens into faster-whisper's `initial_prompt`.

**Check:** an `assert`-based self-check that the harvester pulls a known function name out of a fixture file.

### Phase 3 — Fuzzy post-correction ← *this is the actual product*
`initial_prompt` is capped at roughly 224 tokens, so it cannot carry a real codebase. It biases; it does not guarantee. The correction pass is what makes this work: tokenize the transcript, and for each token (and each 2–3 token window, to catch "get user I D" → `getUserId`) find the best rapidfuzz match in the symbol table above a similarity threshold. Collapse spoken-out camelCase and snake_case. Leave anything below threshold untouched.

**Check:** a small table-driven test — `"get user I D"` → `getUserId`, `"OS dot path"` → `os.path`, and a prose sentence that must pass through *unchanged*. That last case is the one that breaks; an over-eager threshold rewrites ordinary English into identifiers.

### Phase 4 — Type into the focused window
Pick `wtype` or `xdotool` off `$WAYLAND_DISPLAY`. Wire the hotkey to a `toggle` subcommand that touches/removes the flag file from Phase 1.

**Check:** dictate an identifier into a scratch editor and see it land correctly.

### Phase 5 (optional) — Claude Code mode
A flag that skips the keystroke synthesis and writes straight into the active Claude Code session instead. Only worth building after Phases 1–4 have been in daily use for a week.

## Effort Estimate

**1–2 Claude sessions.** Phases 1, 2 and 4 are plumbing over existing libraries and should land in one session. Phase 3 is where the judgment lives — the similarity threshold needs tuning against your own speech, and that is iteration, not code volume.

## Blockers and Risks

1. **`initial_prompt` is ~224 tokens, hard cap.** You cannot stuff a codebase into it. Plan accordingly: it is a nudge, and Phase 3 does the real work. Do not discover this in Phase 2 and conclude the idea is dead.
2. **Wayland input synthesis is restricted.** `wtype` needs the `virtual-keyboard-unstable-v1` protocol, which Sway and Hyprland implement and **GNOME's Mutter deliberately does not**. On GNOME Wayland the typing step will fail. Confirm your session type with `echo $XDG_SESSION_TYPE` before Phase 4 — on GNOME Wayland, fall back to copying to the clipboard and pasting, which works everywhere.
3. **Over-correction is the real failure mode**, not under-correction. A threshold tuned too loose turns dictated prose into a stream of identifiers and makes the tool actively worse than raw Whisper. Keep the "prose passes through unchanged" test from Phase 3 and treat it as the regression gate.
4. **Latency budget.** faster-whisper `small` on CPU is roughly 1–2s for a short utterance; `medium` may not be. If it feels slow, the fix is a smaller model, not a rewrite.
5. **Calibration is not optional.** Microphone, accent, and speaking pace all move the threshold. Leave it as a config value, not a constant — a number that works for the author's voice will not work for yours.

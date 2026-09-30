# RTK (Rust Token Killer) – CLI Proxy That Cuts LLM Token Usage 60-90%

**Source:** <https://github.com/rtk-ai/rtk>
**Discovered:** 2026-09-30
**Viability:** 3/4

> Claude Code burns tokens on verbose shell output constantly. This tool slots directly into that workflow as a drop-in proxy with no config changes — Rust makes it fast enough to be invisible. A Claude-Code-specific wrapping script is trivial to add on top.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 0/1 |
| Daily utility | 1/1 |
| **Total** | **3/4** |

The user's profile shows heavy daily use of Claude/LLM tooling, CLI wrappers, and dev productivity tools — token optimization maps directly onto their workflow. weekend_buildable scores 1 because a filtering proxy (intercept stdout, apply rules, truncate/dedup) is a well-scoped Rust or even Node/Python project achievable in one focused Claude Code session. fills_gap scores 1 because the user clearly runs hundreds of dev commands daily and pipes output to LLMs; shrinking that context is a genuine, recurring pain. novel scores 0 because the URL points to an existing, published open-source project (rtk-ai/rtk) — building a custom clone largely duplicates mature work rather than breaking new ground; the user could install the binary today. daily_utility scores 1 because anyone building Claude wrappers and agent UIs is constantly feeding command output to context windows, making this a daily-friction tool. The 3/4 total crosses the viability threshold, though the practical recommendation is to fork or extend RTK rather than start from scratch, since the reference implementation already exists.

---

## Implementation Plan

## Overview

RTK is a zero-config Rust binary that sits between shell commands and LLM context windows. Rather than rebuilding from scratch, this plan forks `rtk-ai/rtk`, extends it with Claude Code-specific heuristics, and ships a companion shell wrapper that integrates transparently into the Claude Code workflow. The result: a drop-in proxy that strips noise from `cargo build`, `git log`, `npm install`, and similar commands before their output reaches the context window.

## Stack Recommendation

- **Language:** Rust (matches upstream, gives zero-dependency single binary)
- **Build:** `cargo` with `cargo-dist` for cross-platform release artifacts
- **Filtering engine:** extend upstream's rule system with TOML-based rule files per command family
- **Shell integration:** POSIX sh wrapper script (`rtk-wrap.sh`) that aliases common commands
- **Testing:** `cargo test` + golden-file fixtures for filter output snapshots
- **CI:** GitHub Actions for `x86_64-linux`, `aarch64-linux`, `x86_64-apple`, `aarch64-apple`

## MVP Scope

1. Fork `rtk-ai/rtk` into `/home/user/myplanner/rtk` (or a sibling repo)
2. Add a Claude Code shell hook (`~/.claude/hooks/SessionStart`) that sources the RTK wrapper
3. Extend filter rules for: `cargo build/check/test`, `npm install`, `git log --stat`, `ls -la`, `cat` on large files
4. Add a `--stats` flag that reports tokens saved to stderr (so Claude sees the savings)
5. Golden-file test suite covering each new rule

Out of scope for MVP: GUI, cloud sync, per-project config, LLM API integration.

## Implementation Phases

### Phase 1: Fork and Build Baseline

**Goal:** A locally compiling fork of upstream RTK with a passing test suite and a known-good binary.

**Files to create/modify:**
- `src/main.rs` — entry point, unchanged from upstream initially
- `Cargo.toml` — update name to `rtk-local`, add `serde`/`toml` deps if not present
- `.github/workflows/ci.yml` — matrix build for linux + mac targets
- `tests/fixtures/` — directory for golden output files (empty at this phase)

**Key steps:**
1. Clone upstream: `git clone https://github.com/rtk-ai/rtk /home/user/myplanner/rtk && cd /home/user/myplanner/rtk`
2. Read `Cargo.toml` and `src/main.rs` to understand the current filter dispatch architecture
3. Run `cargo build --release` and confirm the binary builds at `target/release/rtk`
4. Run `cargo test` — note any failing tests and record them; do not fix yet
5. Add `[package] name = "rtk-local"` override in `Cargo.toml` so our binary is distinct from any system-installed `rtk`
6. Commit: `git commit -am "fork: baseline from rtk-ai/rtk, rename crate"`

**Verify:** `cargo build --release 2>&1 | tail -1` prints `Finished release` and `./target/release/rtk --version` prints a version string.

---

### Phase 2: Rule Engine Extension

**Goal:** Five new command-specific filters (cargo, npm, git-log, ls, cat) reduce fixture output by at least 60% measured in bytes.

**Files to create/modify:**
- `src/filters/cargo.rs` — strip ANSI codes, deduplicate repeated `Compiling` lines, keep only `error`/`warning`/`Finished` lines on success
- `src/filters/npm.rs` — strip `npm warn`, progress bars, timing lines; keep `added N packages` summary
- `src/filters/git_log.rs` — truncate to last 20 entries; collapse `--stat` diff noise to file-change summary
- `src/filters/ls.rs` — strip total line, collapse hidden-file blocks, keep only name+size columns
- `src/filters/cat.rs` — truncate files >500 lines to first 200 + last 50 with `[... N lines omitted ...]` marker
- `src/filters/mod.rs` — register new filters in dispatch table
- `tests/fixtures/cargo_build_verbose.txt` — raw sample cargo output (capture from a real build)
- `tests/fixtures/cargo_build_filtered.txt` — expected filtered output (golden file)
- `tests/fixtures/npm_install_raw.txt` / `tests/fixtures/npm_install_filtered.txt`
- `tests/golden_tests.rs` — parameterized test: run each raw fixture through the matching filter, diff against golden

**Key steps:**
1. Read `src/filters/` (or equivalent module path in upstream) to understand the filter trait/interface
2. Implement `CargoFilter`: regex `^    Compiling ` lines → collect unique crate names → emit one summary line `Compiling N crates...`; pass through `error[`, `warning[`, `Finished`, `error:` lines verbatim
3. Implement `NpmFilter`: drop lines matching `/^npm warn/`, `/^\d+ packages/` progress, blank lines; keep the final `added N packages in Xs` line
4. Implement `GitLogFilter`: split on commit boundary (`^commit [0-9a-f]{40}`), keep only the last 20 commits, within each commit strip the `---` stat block down to `N files changed` summary
5. Implement `LsFilter`: drop `^total`, drop dotfile lines if count >10 (replace with `[N hidden files]`), strip permission/owner/group columns keeping only size + name
6. Implement `CatFilter`: count lines; if >500, emit first 200, emit `\n[... N lines omitted ...]\n`, emit last 50
7. Capture real fixture data: `cargo build 2>&1 > tests/fixtures/cargo_build_verbose.txt` inside a medium Rust project; do the same for npm/git/ls
8. Generate golden files by running the new filters on fixtures, review manually, commit as ground truth
9. Write `tests/golden_tests.rs` using `std::fs::read_to_string` + `assert_eq!` against golden files

**Verify:** `cargo test` passes all golden tests; `echo "$(wc -c < tests/fixtures/cargo_build_verbose.txt) $(wc -c < tests/fixtures/cargo_build_filtered.txt)"` shows filtered file is ≤40% the size of raw.

---

### Phase 3: Stats Flag and Token Estimation

**Goal:** Running any proxied command with `RTK_STATS=1` prints a stderr line like `[rtk] saved ~2,340 tokens (73%)` after the filtered output.

**Files to create/modify:**
- `src/stats.rs` — `TokenStats` struct: raw bytes, filtered bytes, estimated token delta
- `src/main.rs` — after filter pass, if `RTK_STATS=1` env var is set, call `stats::report(raw_len, filtered_len)`
- `src/stats.rs` — token estimate: `bytes / 4` (GPT-style approximation, good enough for display)

**Key steps:**
1. Add `pub struct TokenStats { raw_bytes: usize, filtered_bytes: usize }` with a `report()` method that writes to stderr
2. Token estimate formula: `tokens_saved = (raw_bytes - filtered_bytes) / 4`; percent: `(tokens_saved * 100) / (raw_bytes / 4)`
3. In `main.rs`, wrap the filter dispatch so it captures both the raw byte count and the output byte count before writing to stdout
4. Guard the stats print behind `std::env::var("RTK_STATS").is_ok()` so it is invisible by default
5. Add a unit test in `src/stats.rs` asserting the formula for known inputs

**Verify:** `echo "hello world foo bar baz qux quux corge grault garply waldo" | RTK_STATS=1 ./target/release/rtk cat /dev/stdin` prints a `[rtk] saved` line to stderr.

---

### Phase 4: Shell Integration and Claude Code Hook

**Goal:** Opening a new Claude Code session automatically proxies `cargo`, `npm`, `git`, `ls`, and `cat` through RTK with no manual steps.

**Files to create/modify:**
- `scripts/rtk-wrap.sh` — POSIX sh script that defines shell functions shadowing each target command; each function calls `rtk <original-command> "$@"` and passes output through
- `scripts/install.sh` — copies binary to `~/.local/bin/rtk`, appends `source ~/.rtk-wrap.sh` to `~/.bashrc` and `~/.zshrc`
- `~/.claude/hooks/SessionStart` (or `.claude/settings.json` hooks entry) — sources `~/.rtk-wrap.sh` so every Claude Code shell session gets the proxy

**Key steps:**
1. Write `scripts/rtk-wrap.sh`:
   ```sh
   rtk_proxy() { cmd=$1; shift; ~/.local/bin/rtk "$cmd" "$@"; }
   cargo()  { rtk_proxy cargo  "$@"; }
   npm()    { rtk_proxy npm    "$@"; }
   git()    { rtk_proxy git    "$@"; }
   ls()     { rtk_proxy ls     "$@"; }
   cat()    { rtk_proxy cat    "$@"; }
   export -f cargo npm git ls cat
   ```
2. Write `scripts/install.sh`: `cargo build --release`, `cp target/release/rtk ~/.local/bin/rtk`, then idempotently append `. ~/.rtk-wrap.sh` to shell RC files
3. Read `/home/user/myplanner/.claude/settings.json` to find the hooks structure; add a `SessionStart` hook entry that runs `. ~/.rtk-wrap.sh`
4. If `.claude/settings.json` does not exist at project level, check `~/.claude/settings.json` and add the hook there so it applies globally
5. Test by opening a new bash subprocess: `bash -c '. ~/.rtk-wrap.sh && cargo --version'` — should pass through to real cargo but via the proxy

**Verify:** In a fresh shell: `. scripts/rtk-wrap.sh && type cargo` prints `cargo is a function`; running `cargo build` in a Rust project and piping to `wc -l` shows fewer lines than the raw output.

---

### Phase 5: Packaging and Release

**Goal:** `curl`-installable single binary with a GitHub Release artifact for linux-x86_64 and mac-aarch64.

**Files to create/modify:**
- `.github/workflows/release.yml` — triggers on `v*` tags; matrix: `x86_64-unknown-linux-musl`, `aarch64-apple-darwin`; uploads binaries to GitHub Release
- `scripts/install.sh` — update to detect OS/arch and pull the correct release binary from GitHub instead of building from source
- `README.md` — one-liner install, Claude Code hook setup instructions, filter catalog table

**Key steps:**
1. Write `.github/workflows/release.yml` with `cargo build --release --target ${{ matrix.target }}` steps; use `cross` action for the musl target
2. Add `[profile.release]` to `Cargo.toml`: `strip = true`, `opt-level = "z"`, `lto = true` for smallest binary
3. Update `scripts/install.sh` to detect `uname -s`/`uname -m`, construct the GitHub release URL, `curl -L` download, `chmod +x`, place in `~/.local/bin/rtk`
4. Write `README.md` with: install one-liner, Claude Code hook snippet (the SessionStart hook content), table of supported commands and what each filter does, `RTK_STATS=1` usage
5. Tag `v0.1.0` and push: `git tag v0.1.0 && git push origin v0.1.0` — confirm GitHub Actions produces release artifacts

**Verify:** On a clean Linux VM (or Docker container): `curl -L https://github.com/<user>/rtk-local/releases/latest/download/rtk-x86_64-linux -o rtk && chmod +x rtk && ./rtk --version` prints the version string.

---

## Estimated Effort

**2 Claude Code sessions.**

- **Session 1 (Phases 1–3):** Fork and compile baseline, implement all five filter modules, write golden-file tests, add `--stats` flag. This is the core engineering — expect 2-3 hours of Rust work.
- **Session 2 (Phases 4–5):** Shell wrapper, Claude Code hook wiring, CI/CD release pipeline, README. Mostly scripting and config work — 1-2 hours.

## Potential Blockers

- **Upstream filter trait API may be opaque:** If `rtk-ai/rtk` uses a macro-heavy or proc-macro filter registration system, adding new filters requires understanding that abstraction first. Mitigation: read `src/` fully in Phase 1 before writing any new filter code; if the API is hostile, implement filters as a thin pre-processor layer that wraps the upstream binary rather than patching its internals.
- **`cargo`/`npm` output format changes:** Both tools change their output format across versions. Golden files captured on one version may break on another. Mitigation: make golden tests opt-in via `GOLDEN_UPDATE=1` env var that regenerates them rather than failing CI.
- **Shell function export semantics:** `export -f` works in bash but not in POSIX sh or zsh. The wrapper must detect the shell and use the appropriate mechanism (`autoload` for zsh). This is a portability spike that could consume 30-60 minutes if the user's Claude Code sessions run under zsh.
- **Claude Code hook path:** The exact location and format of `SessionStart` hooks in `.claude/settings.json` must be verified against the installed version of Claude Code — the schema has changed between releases. Run `cat ~/.claude/settings.json` at the start of Phase 4 before assuming any key names.
- **musl cross-compilation:** Building `x86_64-unknown-linux-musl` on a Mac CI runner requires `cross` or a Docker-based build. If GitHub Actions free tier does not have Docker available for the musl target, fall back to `ubuntu-latest` native runner for linux and skip musl (use gnu libc instead).

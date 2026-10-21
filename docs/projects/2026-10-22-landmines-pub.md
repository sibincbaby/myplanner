# landmines-pub — known open bugs in your pinned Flutter packages, before Claude edits

**Source:** [devanshranjan10/landmines](https://github.com/devanshranjan10/landmines) (created 2026-10-21, 7★, MIT, TypeScript, npm `landmines`)
**Score:** 3/4 (WB 1 · FG 1 · N 1 · DU 0)
**Shape:** fork-and-extend. Send it upstream as a PR. Don't build from scratch.

## Why this one

landmines reads your lockfile and finds **open** GitHub issues that name the exact version you pin. It works out which API each issue is about. Then a Claude Code `PreToolUse` hook stops the first edit that touches that API, once, and hands the agent the issue and the best workaround from the thread. Nothing else does this. Seven phrasings of the search turned up no prior art, and the upstream CHANGELOG through 2.1.306 has nothing like it.

The gap: upstream supports **npm/pnpm/yarn/bun and Python only**. This box has **25+ `pubspec.lock` files** under `~/my-works` and 2 `composer.lock`. Flutter is where the hits would land.

**Measured hit rate on a real project** (`~/my-works/LwKallr/pubspec.lock`, direct hosted deps, `gh api search/issues 'repo:<o>/<r> is:issue is:open "<version>"'`):

| Package | Pinned | Open issues naming that version |
|---|---|---|
| permission_handler | 12.0.1 | 16 (top: #1485 `isPermanentlyDenied` on Android API 30+) |
| just_audio | 0.10.5 | 8 |
| call_log | 6.0.1 | 1: **#64 `CallLog.query()` runs `ContentResolver.query` on the main thread → ANR** |
| flutter_local_notifications | 18.0.1 | 1 |
| workmanager | 0.9.0+3 | 1 |
| dio, file_picker, flutter_foreground_task | — | 0 |
| google_sign_in | 7.2.0 | n/a: issues live in `flutter/flutter`, not `flutter/packages` (see Blockers) |

`LwKallr/lib/services/call_scanner.dart:149` calls `CallLog.query(`. That edit is exactly what the hook exists to stop. These counts are raw search hits. landmines' verify step (version-polarity, other-product filtering) will cut them down, which is fine.

**Why DU=0:** the hook is passive and only fires when an edit touches a matched API. It pays off now and then, not every day. It still scored 3/4 on the other three.

## Do this today (no build)

This repo (VitePress) and any npm/Python project work with upstream as-is:

```sh
npx landmines scan && npx landmines install   # adds the Claude Code pre-edit hook
```

## Stack

- Fork of `landmines`, TypeScript on Node. Run it with nvm Node v24 (`~/.nvm/versions/node/v24.14.0/bin`); `/usr/bin/node` is v12.
- Upstream's layout is clean and split by ecosystem, so the change is additive:
  - `src/types.ts`: `Ecosystem = 'npm' | 'pypi'` → add `'pub'`
  - `src/lockfiles/`: one parser per lockfile, routed by `index.ts` `MARKERS`
  - `src/registry/resolve.ts`: `resolveNpmRepo` / PyPI → add `resolvePubRepo`
  - `src/source/lex.ts` (223 lines, `lexJs` / `lexPython`), `bindings.ts` (128), `touches.ts` (143), `lang.ts`: these are per-language, so Dart needs a branch in each
- Registry: `GET https://pub.dev/api/packages/<name>` → `latest.pubspec.{repository,issue_tracker,homepage}` (verified: `dio` → `cfug/dio`). Use `/api/packages/<name>/versions/<v>` for the pinned version's pubspec.

## MVP scope (pub only)

1. Parse `pubspec.lock`. Keep `dependency: "direct main"` / `"direct dev"` entries with `source: hosted`. Skip `sdk`, `git` and `path` with the matching `SkipReason`.
2. Map pub package → GitHub repo through pub.dev. Upstream's `GET /repos` canonicalization already handles renames (`mogol/flutter_secure_storage` 422s on issue search under its old name; `GET /repos` redirects it to `juliansteenbakker/flutter_secure_storage`).
3. Add Dart to the lexer and bindings:
   - `.dart` → `'dart'` in `langForPath`, and the `dart`/`flutter` fence tag in `langForFence`
   - `lexDart` = `lexJs` plus raw strings `r'…'`, triple-quoted strings, and `${}` interpolation
   - bindings from `import 'package:<pkg>/…' [as x] [show A, B] [hide C]`
4. Scan, cards, rules and hook run unchanged on top of that.

composer/Packagist is **not** in the MVP. See Phase 5.

## Phases

1. **Fork + parser (session 1, first half).** Add `src/lockfiles/pub.ts` and route it in `index.ts` (`MARKERS += 'pubspec.lock'`). Add a fixture test using a copy of `LwKallr/pubspec.lock`, and assert that `call_log 6.0.1` comes out as a direct hosted dep.
2. **Registry (session 1, second half).** Add `resolvePubRepo` in `resolve.ts`, reusing `getJson` plus `parseGitHubRepo`. Fixture-test `dio` → `cfug/dio`. Then run `landmines scan` on LwKallr and check that `.landmine/index.json` includes call_log #64.
3. **Dart lexing (session 2).** Add `lexDart`, `dartBindings`, and the `'dart'` branches in `touches.ts` (the identifier regex, and `walkChain`'s `!`/`<` handling, which Dart shares with JS). Test: an edit that adds `await CallLog.query(` to a file importing `package:call_log/call_log.dart` must match #64. An edit that doesn't touch `CallLog` must not.
4. **Install + dogfood.** `landmines install` in LwKallr. Make a throwaway edit near `call_scanner.dart:149`, confirm the hook blocks once and then lets the retry through, and look at the AGENTS.md/CLAUDE.md rules block. Open the upstream PR.
5. **(Later) composer.** Parse `composer.lock` `packages[]`. Packagist `GET https://repo.packagist.org/p2/<vendor>/<pkg>.json` → `packages[..][0].source.url` (verified: `guzzlehttp/guzzle` → `github.com/guzzle/guzzle`). PHP lexing (`use Vendor\Pkg\Class;`, `->`/`::` chains) is a separate session. Only worth it if the Linways repos commit `composer.lock`.

## Effort

About 2 Claude sessions for pub (Phases 1–4), plus 1 for composer if wanted.

## Blockers / risks

- **flutter/packages packages** (`google_sign_in`, `shared_preferences`, `path_provider`, `url_launcher`…): their issues live in **`flutter/flutter`**, labelled `p: <package>`, not in the repo that pub.dev points to. Map `repository: github.com/flutter/packages/...` → `flutter/flutter`, and add the label to the query. Otherwise those deps always come back as 0.
- **Flutter SDK version** (`sdks:` in `pubspec.lock`) against `flutter/flutter` would be very noisy. Leave it out of the MVP.
- **GitHub search rate limit:** upstream does one GraphQL query per dep and version. 27 deps is fine with `gh auth token` as `GITHUB_TOKEN`.
- **Upstream is 1 day old** (30 commits). The internals may move under the fork, so open the PR early.
- **Trigger cards** (`landmines cards`) call a model. Use a devgate endpoint at dev time, or skip cards. The hook works without them, it's just stricter.

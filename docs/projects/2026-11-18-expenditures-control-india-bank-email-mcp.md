# expenditures-control - MCP server that turns bank notification emails into a live spending report inside Claude

**Source:** <https://github.com/estebanjc78/expenditures-control>
**Discovered:** 2026-11-18
**Viability:** 3/4

> Rare personal-finance AI item that is Claude-native. The pattern of teaching the parser from examples suits Indian bank and credit-card alert emails (HDFC, ICICI, etc.) and fits the user's expense-tracking and card-management projects. It could be forked or extended with a Flutter or Nuxt dashboard.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

This is a strong fit for the user's personal-finance AI and Claude tooling interests. The only related project in ~/my-works is mycards, an offline card vault, so nothing they have ingests transactions automatically. An MVP is buildable in one or two sessions: read-only Gmail, Claude-proposed parsers checked against sample emails for their Indian banks (HDFC/ICICI alerts), SQLite storage, and a report tool. The learn-from-examples parsers and in-Claude report also set it apart from manual-entry tools like Firefly III and Actual Budget. Daily utility scores 0 because people check spending reports and budgets a few times a week rather than every day, and once the ingestion runs on its own the tool mostly sits in the background.

---

## Implementation Plan

## Overview

Fork `estebanjc78/expenditures-control` (MIT, TypeScript, Node 22.13+, `node:sqlite`, `@modelcontextprotocol/sdk` + `ext-apps`) and adapt it for India. The goal is an MCP server for Claude Code / Claude Desktop that reads HDFC and ICICI alert emails (SBI and Axis are optional) over read-only Gmail. It stores transactions in INR in a local SQLite file and shows the existing cross-filtering spending report.

Forking is much faster than a rewrite. Upstream already has the learn-from-examples parser engine (`src/parsers/engine.ts`, `profile.ts`, `safe-regex.ts`), Gmail PKCE OAuth (`src/gmail/*`), budgets, subscriptions, receipts and the MCP App panel (`src/panel/*`). The work is in the Colombia-specific parts:
- `DATABASE_CURRENCY = "COP"` in `src/parsers/profile.ts`
- `America/Bogota` as the default time zone
- the TRM FX feed in `src/domain/fx.ts`
- PSE and Bre-B categories
- date formats with no hyphenated month names (`17-Nov-26`)
- amount parsing with no `₹`/`Rs.`/`INR`

On top of that come seeded Indian bank profiles, UPI-aware merchant normalization, rules for credit-card bill payments (CRED/BBPS), and a background sync job so the tool runs on its own.

Keep the upstream tool names (`registrar_movimiento`, `abrir_panel`, …) so later upstream changes still merge cleanly. Their descriptions are already in English.

## Stack Recommendation

- **Runtime:** Node.js ≥ 22.13 (needed for `node:sqlite`). Check with `node -v`. `node` was not on PATH in at least one MCP context on this machine, so install through `nvm install 22` and use an absolute node path in MCP configs.
- **Language and tooling:** TypeScript (`tsc`), `vitest`, `zod` v4, all already in upstream `package.json`.
- **MCP:** `@modelcontextprotocol/sdk` ^1.32, `@modelcontextprotocol/ext-apps` ^1.7 (in-chat report).
- **Gmail:** upstream `src/gmail/oauth.ts` (Desktop OAuth client, loopback with PKCE, `gmail.readonly` scope only).
- **FX:** replace the Colombian TRM feed with Frankfurter (`https://api.frankfurter.dev/v1/{date}?base=USD&symbols=INR`, ECB rates, no key), cached in the existing `fx_rates` table.
- **Scheduling:** a systemd user timer (`~/.config/systemd/user/`) that runs a new headless sync CLI.
- **Host:** Claude Code on Linux, where `abrir_panel` falls back to the browser dashboard on `127.0.0.1`. The `.mcpb` bundle only matters if Claude Desktop is used on macOS or Windows.
- **Later:** a Nuxt 4 or Flutter dashboard that reads the same SQLite file. This is out of MVP scope.

## MVP Scope

In scope:
1. Database currency INR, time zone `Asia/Kolkata`, number formatting `en-IN` (lakh grouping) in the panel and tool output.
2. Amount parsing for `₹1,23,456.00`, `Rs.250`, `Rs 1,500`, `INR 2,000.50`. Date parsing for `17-11-26`, `17-Nov-26`, `17-Nov-2026`, `Nov 17, 2026`.
3. Seeded, test-verified profiles for HDFC (UPI debit, account debit and credit, credit-card spend, CC payment received) and ICICI (CC spend, account debit and credit, CC payment received). OTP, statement, e-mandate-registration and promo emails are skipped.
4. Merchant normalization for UPI VPAs (`swiggy@ybl` → `SWIGGY`, strip `paytmqr`, `@okhdfcbank` and similar) and an Indian category seed (Swiggy/Zomato → food, Uber/Ola/Rapido → transport, and so on).
5. Own-transfer rules: credit-card bill payments through CRED, BBPS or netbanking are booked as `transferencia_propia` on both sides, so they are not counted twice.
6. Gmail sync with the user's own Google Cloud OAuth client. The report works in Claude Code through the browser fallback.
7. A headless `sync` CLI and a systemd timer that runs it every 6 hours.

Out of scope: SMS ingestion, PDF statement parsing, multi-user use, publishing to npm, a Nuxt or Flutter UI.

## Implementation Phases

### Phase 1: Fork, baseline, and make currency, locale and time zone configurable
**Goal:** The fork builds, all upstream tests pass, and the database currency, time zone, display locale and FX provider come from config (default INR / Asia/Kolkata / en-IN), with no hard-coded COP left.
**Files to create/modify:**
- `src/config.ts` — new. Exports `DB_CURRENCY` (env `GASTOS_CURRENCY`, default `INR`), `DEFAULT_TZ` (env `GASTOS_TZ`, default `Asia/Kolkata`), `DISPLAY_LOCALE` (env `GASTOS_LOCALE`, default `en-IN`).
- `src/parsers/profile.ts` — `DATABASE_CURRENCY`, the `currency` default and the `timezone` default import from `config.ts`.
- `src/parsers/amount.ts` — add `INR` to `CURRENCY_RE`. Add `₹`, `Rs.`, `Rs` (word-bounded) and `INR` detection that maps to INR. `defaultCurrency` defaults to `DB_CURRENCY`.
- `src/parsers/date.ts` — add `DD-MM-YY`, `DD-MMM-YY` and `DD-MMM-YYYY` to `DATE_FORMATS`. Add a `HYPHEN_NAMED_RE = /(?<!\d)(\d{1,2})-([a-z]{3})-(\d{2}|\d{4})(?!\d)/i`. Treat a 2-digit year as `2000+yy`.
- `src/domain/fx.ts` — keep `trmRateProvider` and add `frankfurterRateProvider(db, fetchFn)`: base = the foreign currency, symbol = `DB_CURRENCY`, plausible range 1–1000 for INR, same caching in `fx_rates`. Add `selectRateProvider()` that returns TRM when `DB_CURRENCY === "COP"` and Frankfurter otherwise.
- `src/server.ts` / `src/tools/*.ts` / `src/panel/web-script-*.ts` — replace every `"COP"`, `"es-CO"` and `America/Bogota` literal with the config values. Pass `DISPLAY_LOCALE` and `DB_CURRENCY` into the panel bootstrap so `Intl.NumberFormat(locale, {style:"currency", currency})` renders `₹1,23,456`.
- `tests/amount-inr.test.ts`, `tests/date-in.test.ts`, `tests/fx-frankfurter.test.ts` — new unit tests (mock `fetch` for FX).
**Key steps:**
1. Ask the user whether the fork belongs to the personal (`sibincbaby`) or work account (CLAUDE.md requires this). Then run `gh repo fork estebanjc78/expenditures-control --clone=false` under that account, clone it to `/home/sibin/my-works/expenditures-control` with remote `git@github-personal:sibincbaby/expenditures-control.git`, set the repo-local `user.email`/`user.name`, and run `git checkout -b india`.
2. Run `npm ci && npm run typecheck && npm test` and record the baseline pass count.
3. Run `grep -rnE '"COP"|COP\b|America/Bogota|es-CO|TRM|trmRateProvider' src scripts manifest.json` and work through every hit.
4. Add `src/config.ts` and wire it in. Keep COP behavior when `GASTOS_CURRENCY=COP` so the upstream BBVA tests still pass. Run those tests with `GASTOS_CURRENCY=COP` set in `vitest.config.ts` `test.env`, and add a second vitest project or `describe` block for INR.
5. Extend amount and date parsing. Test cases: `"Rs.1,23,456.00"`→123456, `"INR 2,000.50"`→2000.5, `"₹ 250"`→250, `"Rs 1,500"`→1500, `"17-11-26"`→2026-11-17 (DD-MM-YY), `"17-Nov-26"`→2026-11-17, `"Nov 17, 2026"`→2026-11-17.
6. Implement the Frankfurter provider with an 8 s timeout. Only the date and currency code leave the machine.
**Verify:** `cd /home/sibin/my-works/expenditures-control && npm run typecheck && npm test` passes with zero failures. `grep -rn '"COP"' src | grep -v config.ts | grep -v test` returns nothing outside the COP-compat branch.

### Phase 2: Seeded Indian bank profiles, verified against real emails
**Goal:** HDFC and ICICI alert emails from the user's inbox parse into the correct kind, amount, merchant and date, and every seeded profile passes all of its fixtures before it is inserted.
**Files to create/modify:**
- `src/parsers/profiles/hdfc.json` — `BankProfile` JSON: `bank:"hdfc"`, `currency:"INR"`, `timezone:"Asia/Kolkata"`, `dateFormats:["DD-MM-YY","DD-MMM-YY","YYYY-MM-DD"]`. Templates: `upi_debit` (body has "has been debited" and "VPA", merchant regex `to VPA\s+(\S+)`), `account_debit`, `account_credit` (`ingreso`), `cc_spend` (body has "spent on" and "Credit Card"), `cc_payment_received` (`transferencia_propia`), plus `skip` templates for OTP, e-statement, "mandate" and promos.
- `src/parsers/profiles/icici.json` — same structure: `cc_spend` (`INR ([\d,.]+) spent using ICICI Bank Card`), `account_debit`, `account_credit`, `cc_payment_received`, skips.
- `src/parsers/profiles/index.ts` — loads the JSON files, validates them with `profileSchema`, and exports `SEEDED_PROFILES` along with their sender addresses.
- `src/parsers/seed.ts` — on DB open, for each seeded profile whose bank has no learned profile yet, runs the same "all examples must pass" check as the learn tool (reuse the validation in `src/parsers/resolve.ts`/`engine.ts`) against the bundled fixtures, then inserts it. Learned profiles still take priority.
- `src/db.ts` — call `seedProfiles(db)` after the migrations.
- `tests/fixtures/in/hdfc/*.txt`, `tests/fixtures/in/icici/*.txt` — redacted email bodies, 3–5 per template, each with a `.expected.json` sidecar.
- `tests/profiles-in.test.ts` — runs every fixture through `engine.ts` and asserts on the sidecar.
- `scripts/redact-fixture.mjs` — masks account and card digits (`XX1234`→`XX0000`), names, UPI ref numbers and available balance before a fixture is saved.
**Key steps:**
1. Pull real samples with the Claude Gmail connector (`mcp__claude_ai_Gmail__search_threads`), for example `from:(hdfcbank.net OR hdfcbank.bank.in) newer_than:120d` and `from:(icicibank.com OR icicibank.bank.in) newer_than:120d`, then read each with `get_message`. Note the exact sender addresses: Indian banks moved alert mail to `*.bank.in` domains in 2025–26, so record both old and new.
2. Group the samples by subject and body shape (UPI debit, CC spend, credit, CC payment, OTP/statement/promo). Pick 3–5 per shape, run `node scripts/redact-fixture.mjs <in> <out>`, and write the `.expected.json` files by hand.
3. Write the profile JSON. Prefer `label` extractors with `delimiters`, and use `regex` only where labels don't work. Every regex must pass `assertRegexUsable`.
4. Iterate until `npx vitest run tests/profiles-in.test.ts` is green.
5. Add the senders to the seed so `listar_remitentes` shows them without a manual `agregar_remitente`.
6. Optional: add an SBI (`alerts.sbi.co.in`) and Axis profile the same way if the inbox has samples.
**Verify:** `npx vitest run tests/profiles-in.test.ts` passes. `GASTOS_DB=/tmp/t.db node dist/index.js` started through `npx @modelcontextprotocol/inspector node dist/index.js` shows `formatos_banco` listing hdfc and icici as readable.

### Phase 3: India accounting rules (UPI merchants, categories, credit-card payments)
**Goal:** Synced transactions get clean merchant names and sensible categories, and credit-card bill payments are never counted as spending on either side.
**Files to create/modify:**
- `src/domain/india-rules.ts` — new.
  - `normalizeUpiMerchant(raw)`: lowercase, strip the VPA handle (`@ybl|@okaxis|@okhdfcbank|@okicici|@oksbi|@paytm|@ibl|@axl|@apl|@upi|@yapl`), strip `paytmqr`/`bharatpe`/`gpay-` prefixes and long digit runs, title-case. A P2P VPA that looks like a phone number or a person becomes `kind` transfer-to-person.
  - `CC_PAYMENT_PATTERNS`: `cred.club`, `CRED`, `BBPS`, `BILLDESK.*CREDIT CARD`, `CC PAYMENT`, `ICICI CARD PAYMENT`, `HDFC CC`.
- `src/domain/classify.ts` — call `normalizeUpiMerchant` before lookup. Debits that match `CC_PAYMENT_PATTERNS` become `transferencia_propia`. Gate the Colombian PSE and Bre-B branches behind `DB_CURRENCY === "COP"`.
- `src/domain/sanitize.ts` — make sure UPI ref numbers and masked account numbers are removed from stored merchant text.
- `src/domain/categories-in.ts` — seed merchant → category map: Swiggy/Zomato/Blinkit/Zepto → Food & groceries, Uber/Ola/Rapido/IRCTC → Transport, Amazon/Flipkart/Myntra → Shopping, Airtel/Jio/BSES/KSEB → Utilities, Netflix/Spotify/YouTube/Google Play → Subscriptions. Insert it only when the merchant has no category yet.
- `tests/india-rules.test.ts` — VPA normalization table, CC-payment detection, and a double-count check: a savings debit to `cred.club@axisb` plus the ICICI "payment received" email gives zero spend.
**Key steps:**
1. Read `src/domain/classify.ts` and `src/domain/sync.ts` to find where the merchant and kind are finalized. Hook in at that point only.
2. Implement and unit-test the normalizer against the real merchant strings from the Phase 2 fixtures.
3. Add the CC-payment rule on both sides. The bank side is the debit to CRED/BBPS. The card side is "payment received" (already `transferencia_propia` from the profile).
4. Seed categories through the existing `clasificar_comercios` domain function, not raw SQL.
5. Check that `gastos_recurrentes_no_listados` (subscription detection) still works with the INR amounts and the normalized merchants.
**Verify:** `npx vitest run tests/india-rules.test.ts` passes. In MCP Inspector, call `registrar_movimientos` with a CRED debit and a CC-payment-received row, then `consultar_movimientos` grouped by category. Total spend must not include either row.

### Phase 4: Live Gmail sync and report in Claude Code
**Goal:** In Claude Code, "Connect my Gmail" then "Sync my bank emails from 2026-08-01" loads real HDFC and ICICI transactions, and "Show me my spending" opens the report in INR.
**Files to create/modify:**
- `~/.gastos-mcp/google-client.json` — the user's own Desktop OAuth client. It is never committed. `build-secrets/` stays gitignored.
- `docs/india-setup.md` — Google Cloud steps (enable Gmail API, External consent screen, set to **In production** to avoid the 7-day Testing-mode refresh-token expiry, Desktop client), sender list, and the env vars.
- `README.md` — short "India fork" section that links to it.
- `manifest.json` — update `keywords` (`india`, `inr`, `upi`) and the `user_config` defaults for currency and time zone.
**Key steps:**
1. Run `npm run build`, then `claude mcp add gastos -e GASTOS_DB=$HOME/.gastos-mcp/gastos.db -- $(which node) /home/sibin/my-works/expenditures-control/dist/index.js`.
2. The user creates the Google Cloud OAuth client (Claude cannot click through the console) and saves the JSON to `~/.gastos-mcp/google-client.json`.
3. In a Claude Code session, call `conectar_gmail`. The browser opens and the user clicks Allow. Confirm with `estado_gmail`.
4. Sync about 90 days in chunks, calling again while `remaining > 0`. Review the "needs review" output, fix the profiles for any template that misses, and add the failing email as a new fixture (redacted).
5. Open `abrir_panel`. On Linux with Claude Code it falls back to the browser at `127.0.0.1`. Check `₹` formatting, the IST day boundaries, and the category cross-filter.
6. Set two budgets (`fijar_presupuesto` Food & groceries ₹15,000) and check that `estado_presupuesto` flags 80%.
**Verify:** `sqlite3 ~/.gastos-mcp/gastos.db "select bank, count(*), sum(amount) from movements group by bank;"` shows hdfc and icici rows. Check the real table name in `src/db.ts` first. The browser report shows the same totals as a manual check of 5 random emails.

### Phase 5: Headless background sync and packaging
**Goal:** Transactions keep arriving every 6 hours with no Claude session open, and the fork ships as a `.mcpb` bundle for any macOS or Windows Claude Desktop install.
**Files to create/modify:**
- `src/cli/sync.ts` — new bin `expenditures-control-sync`. It opens the DB, loads the stored Gmail token, calls the same `domain/sync.ts` entry point that the Gmail sync tool uses, loops until `remaining === 0`, and prints a JSON summary (`{inserted, skipped, review, newMerchants}`). Exit code 2 means the token is expired or revoked.
- `package.json` — add `"bin": {"expenditures-control-sync": "dist/cli/sync.js"}` and the script `"sync": "node dist/cli/sync.js"`.
- `deploy/systemd/expenditures-sync.service`, `deploy/systemd/expenditures-sync.timer` — `OnCalendar=*-*-* 00/6:00:00`, `Persistent=true`, absolute node path, `Environment=GASTOS_DB=%h/.gastos-mcp/gastos.db`.
- `scripts/install-timer.sh` — copies the units to `~/.config/systemd/user/`, then runs `systemctl --user daemon-reload && systemctl --user enable --now expenditures-sync.timer`.
- `tests/cli-sync.test.ts` — runs the CLI against a fake Gmail source (reuse the upstream `src/gmail/source.ts` interface) and asserts it is idempotent.
**Key steps:**
1. Read `src/tools/gmail.ts` to find the sync function it calls, and call it from the CLI. Do not copy the logic.
2. Make sure sync uses a lock (a `BEGIN IMMEDIATE` or `sync_lock` row) so a timer run during an MCP-session sync does not double-insert. Gmail message ids are already deduplicated upstream, so confirm it.
3. Install the timer and run once with `systemctl --user start expenditures-sync.service`.
4. Run `npm run build:mcpb`, with the user's client JSON in `build-secrets/google-client.json` if they want it bundled for personal use.
**Verify:** `journalctl --user -u expenditures-sync.service -n 20` shows a JSON summary with `inserted >= 0` and exit 0. `systemctl --user list-timers | grep expenditures` shows the next run. `ls build/expenditures-control.mcpb` exists.

## Estimated Effort

About 3 Claude Code sessions (1 session ≈ 2–4 hours of Claude work).
- **Session 1:** Phase 1 (fork, baseline, config, amount, date, FX, tests) and the start of Phase 2 (pull and redact real HDFC/ICICI samples through the Gmail connector).
- **Session 2:** Finish Phase 2 (profiles and fixtures green) and all of Phase 3 (UPI normalization, CC-payment rules, categories).
- **Session 3:** Phase 4 (live OAuth, real sync, profile fixes from the review queue, report check) and Phase 5 (sync CLI, systemd timer, `.mcpb`).

## Potential Blockers

- **Account confirmation:** creating the fork or remote must wait until the user confirms the personal or work account (CLAUDE.md rule).
- **Google OAuth setup needs a person:** someone has to create the Cloud project, enable the Gmail API, set up the consent screen and create the Desktop client. `gmail.readonly` is a restricted scope, so the app stays "unverified": the user sees a warning screen and there is a 100-user cap. If the app is left in **Testing**, refresh tokens expire after 7 days, which breaks the background timer. Setting it to **In production** while unverified avoids this. A personal Gmail account cannot use the "Internal" user type.
- **Missing or inconsistent bank emails:** some HDFC and ICICI UPI debits arrive only by SMS, depending on the account's alert settings. If email alerts are off, transactions will be missing. The user may need to enable "email alerts for all transactions" in netbanking. Banks also send different body layouts for the same event (old vs `.bank.in` sender domains, HTML-only bodies, card vs UPI-on-credit-card), so expect 1–2 rounds of profile fixes after the first real sync.
- **Upstream Colombian assumptions beyond currency:** PSE and Bre-B logic, USD→COP "conversion counts as income", Spanish `kind` enums (`gasto`, `ingreso`, `transferencia_propia`) and Spanish tool names are spread through `src/domain/*`. Gate them rather than delete them, so upstream merges stay possible. A full grep in Phase 1 is required. Diverging further makes rebasing on upstream painful.
- **Lakh-format edge cases:** `parseMoney` reads a trailing separator followed by 3 digits as a thousands mark. That is correct for `1,500`, but check odd forms like `Rs.1,00,000/-` and `INR 5.00 Lakh` (rare in alerts) and add tests.
- **MCP Apps support on Linux:** there is no official Claude Desktop for Linux, and Claude Code may not render the MCP App inline, so the browser fallback (`abrir_panel` → `127.0.0.1` with a secret token) becomes the main UI. The `.mcpb` bundle is only useful on macOS or Windows.
- **Node version:** `node:sqlite` needs Node ≥ 22.13. `node` was missing from PATH in at least one MCP context on this machine, so use absolute node paths in `claude mcp add` and in the systemd unit.
- **Privacy:** fixtures committed to a public fork must be redacted (card and account digits, names, UPI refs, balances). Run `scripts/redact-fixture.mjs` and check by hand before any `git add tests/fixtures`. Keep the fork private if in doubt.
- **FX:** Frankfurter (ECB) rates differ slightly from what Indian banks actually charge (bank markup plus GST on forex), so foreign-currency receipts converted to INR are estimates. Upstream already marks them as such.

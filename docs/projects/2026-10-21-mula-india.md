# mula (India fork) — Bank SMS → Budget → Your Claude Account

**Source:** GitHub — https://github.com/khaledsharara/mula (MIT, created 2026-10-20)  
**Tagline:** "Turns your bank's SMS alerts into a budget and connects it to your own Claude account."  
**Discovered:** 2026-10-21

---

## Why it fits

> **This is a fork-and-extend plan, not a build.** It replaces two unbuilt backlog plans: [2026-10-14 Flutter SMS expense tracker](/projects/2026-10-14-flutter-sms-expense-ai) (SMS capture) and [2026-10-04 myfinance MCP](/projects/2026-10-04-myfinance-mcp-hosted-personal-finance-server) (a claude.ai connector for finance). mula already ships both halves and joins them up. Build this instead of either of them.

mula is an Expo (React Native) app for Android and iPhone that does three things:

- **Reads bank SMS automatically.** On Android a native `mula-sms` module (Kotlin `SmsReceiver`) captures messages even while the app is closed. On iPhone it uses a Shortcuts automation.
- **Parses them into an inbox of transactions.** Amount, card last-4, merchant and balance are filled in, waiting for one swipe to accept.
- **Syncs to a relay in your own free Cloudflare account.** The relay (`relay/src/mcp.ts`, `tools/read.ts`, `tools/write.ts`, OAuth) is an MCP server that you add once under claude.ai **Settings › Connectors**. From then on, Claude on web or mobile can answer "food this month vs last?" and do bookkeeping writes.

The gap for you is that SMS parsing only understands **CIB (Egypt)**. Bank definitions live one per file in `src/modules/banks/definitions/`, so the job is to teach it Indian bank and UPI SMS.

**Prior art, checked 2026-10-21:**
- Indian-SMS parsing is a deep lane: 61 repos for `upi sms expense`, including `Moneyprism` (Flutter, claims 50+ Indian banks and 100+ UPI handles), `SBETS` (37★), `allwin-antony/Expense_tracker`, and `ujjwal04/expense-tracker` (Expo, 10-18).
- Claude-connector expense trackers exist, but they are 0–1★ toy FastMCP servers with manual entry.
- **Nothing else pairs automatic SMS capture with a claude.ai connector.** That pairing is the novel part, and mula is the only repo with it (2★, a day old).

## Viability

| Criterion | Score | Notes |
|-----------|-------|-------|
| weekend_buildable | 1 | One bank definition file per bank plus UPI kinds, tests that run on a laptop, and a one-click Cloudflare relay deploy. One session for parsers and tests, one for APK + relay + connector. |
| fills_gap | 0 | Backlog rule: 19 unbuilt finance plans already cover SMS capture (10-02, 10-14) and a claude.ai finance connector (10-04). The value here is that someone already built the join, not that the gap is new. |
| novel | 1 | SMS→budget is 24–61 repos deep, but SMS capture plus a claude.ai custom connector exists only in mula (2★, a day old). |
| daily_utility | 1 | Every UPI or card debit arrives as an SMS. You swipe it into the inbox and ask Claude about it from the phone app. |
| **Total** | **3/4** | **Viable** |

## Stack

- **Upstream:** fork `khaledsharara/mula`. It's TypeScript, Expo SDK 57, with a native Kotlin SMS module and a Cloudflare Workers relay with D1 storage.
- **Node 22+:** `/usr/bin/node` on this box is v12. Use `PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`.
- **Android build:** a local Gradle build (`npx expo prebuild && cd android && ./gradlew assembleRelease`) or the repo's `release.yml` workflow on your fork.
- **Relay:** the "Deploy to Cloudflare" button from the `relay-deploy` branch, on the free plan (100k row writes a day; the initial upload is about 9 rows per record).
- **Parser reference:** borrow regex shapes, not code, from `Moneyprism` and `peopleofproduct/Panini` (Indian bank narration parser, zero dependencies). Check their licenses before copying anything verbatim.

## MVP Scope

1. UPI debit and credit SMS from **your own bank(s)** parse into transactions with amount, VPA/payee, account last-4, balance and timestamp.
2. Card purchase and ATM SMS from the same bank(s) parse too.
3. OTPs, promos, declined-payment and mandate-reminder SMS are ignored.
4. The Android APK is sideloaded and captures new SMS automatically.
5. The relay is deployed, and the claude.ai connector answers "What did I spend on food this week?" from the phone app.

Out of scope for the MVP: other people's banks, iOS Shortcuts keywords for Indian banks, upstreaming the PR.

## Phases

### Phase 1 — Fork, run, read the bank layer (≈30 min)
- Fork under the **personal** account (`sibincbaby`) and confirm before creating the remote, per CLAUDE.md. Then `npm install`.
- Read `src/modules/banks/types/index.ts`, `definitions/cib.ts`, `utils/patterns.ts` and `docs/adding-a-bank.md`.
- Find every place that switches on `kind`. The direction mapping and the payment-type mapping are the ones UPI will touch.
- Gate: `npm run typecheck && npx expo lint && npm test` passes on the untouched fork.

### Phase 2 — UPI kinds + your bank definition (≈1–2 h)
- Add `upi_out` and `upi_in`, or map UPI onto the existing `instapay_out`/`instapay_in` if their semantics already match, which gives a smaller diff. Decide after reading the `kind` switch sites.
- Write `definitions/<bank>.ts` with sender IDs (Indian senders look like `AX-HDFCBK`, `VM-SBIUPI`; match the suffix), plus templates for UPI debit and credit, card, ATM and refund, and `ignore` rules for OTPs and promos.
- Add `INR` and the `Rs.`/`INR`/`₹` prefixes to `CCY` if they're missing.
- Write the tests from **made-up** messages (fake amounts `123.45`, digits `9001`). Never commit real SMS. `.gitignore` already blocks `*.csv`.
- Gate: every template's `example` parses, and the ignore cases return null.

### Phase 3 — Real-message dry run, on device only (≈30 min)
- Export about 3 months of bank SMS to CSV on the phone and import it through **Anywhere › import SMS history**. Don't copy the export into the repo folder.
- Count how many messages were parsed, ignored or unmatched. Any money message that ends up unmatched becomes a new template, and you return to Phase 2.
- Gate: at least 95% of money SMS parse. Account matching by last-4 links them to the right accounts.

### Phase 4 — APK + relay + connector (≈1 h)
- Build and sideload the APK. On Android 13+, turn on **Allow restricted settings** for the app before granting SMS permission (`docs/install-android.md`).
- Deploy the relay with the Cloudflare button, set `APP_TOKEN` (16+ random chars, treat it as a password), and connect in **More › Automation › Claude**.
- Add the connector in claude.ai **Settings › Connectors**. Test from the Claude Android app: "spending by category this month", then a write such as "recategorize Swiggy as food".
- Gate: a fresh UPI payment shows up in the inbox within a minute and is answerable from Claude once accepted.

### Phase 5 (optional) — Upstream PR
- Open an issue with the `new-bank.yml` template, then a PR containing only the definition, the tests and the UPI kind change. Other Indian users get it for free, and you stop carrying a fork.

## Effort

About 4–5 hours across two sessions: (1) Phases 1–2, (2) Phases 3–4. The parser work is plain TypeScript that you test on a laptop, so no phone is needed until Phase 3.

## Blockers & Risks

- **Bank `kind`s are Egypt-shaped** (`instapay_*`, `applepay_purchase`). UPI is more than the "one file" the README promises: it touches the types, the direction/payment-type mapping and the tests.
- **Android 13+ restricted settings:** sideloaded apps need a manual toggle before SMS permission can be granted. This is a one-time step.
- **Expo/React Native, not Flutter.** This is deliberate (it's built and MIT), but you'll be working outside your usual stack. The parser layer is plain TS, which keeps that contained.
- **Privacy:** transactions are copied to *your* Cloudflare D1 and are readable by Claude through the connector. Nothing goes to the mula author. Rotate `APP_TOKEN` if it ever leaks.
- **Upstream is a day old** (2★, single author), so expect churn. Keep your diff small and confined to the bank layer so rebases stay trivial, or upstream it in Phase 5.
- **Sender-ID drift:** Indian DLT sender prefixes change (`AX-`, `VM-`, `JD-`…). Match on the bank suffix, not the full header.

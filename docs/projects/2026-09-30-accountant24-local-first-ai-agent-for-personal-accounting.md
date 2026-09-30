# Accountant24 – Local-First AI Agent for Personal Accounting

**Source:** <https://github.com/machulav/accountant24>
**Discovered:** 2026-09-30
**Viability:** 3/4

> Direct hit on the personal finance AI interest area. The local-first + local-LLM approach mirrors the user's own sensibility across their personal tool projects. The git-versioned plain-text ledger is something Claude can read and reason over trivially — a strong foundation to layer further Claude-based queries on top of.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

The core MVP is a well-scoped sprint: LLM-to-hledger journal translation plus git auto-versioning is achievable in one or two Claude Code sessions. The user's profile shows clear interest in both personal finance AI tools and LLM CLI wrappers, and no existing project in their portfolio covers double-entry bookkeeping with an NL interface — this fills a genuine gap at the intersection of their two strongest interest clusters. The local-first + local-LLM + plain-text combination is a niche with no dominant polished open-source incumbent yet. The only weakness is daily utility: accounting is inherently periodic rather than a every-single-day workflow, which keeps the total at 3 rather than 4, but the project is still a strong fit overall.

---

## Implementation Plan

## Accountant24 — Implementation Plan

**3 Claude Code sessions** to a fully packaged, installable local-first accounting agent.

---

## Overview

Wraps `hledger` with an LLM interface: natural-language transactions → validated journal entries → auto-committed with git. All data stays as plain text on disk. Supports Claude (cloud) or Ollama (local) as the LLM backend.

---

## Stack Recommendation

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | Fast iteration, strong parsing libs |
| Accounting | hledger (system binary) | Called via subprocess |
| LLM default | Anthropic SDK / claude-3-5-haiku | Low latency + cost |
| LLM local | Ollama + llama3 | OpenAI-compatible endpoint |
| CLI | Typer + Rich | Clean help, colored output |
| PDF/image | pdfplumber + Pillow | Receipt text extraction |
| Config | TOML (stdlib tomllib) | `~/.config/accountant24/config.toml` |
| Versioning | GitPython | Auto-commit after every write |

---

## MVP Scope

NL → hledger transaction, append to `.journal` file, git auto-commit, balance/report query, CSV statement import, receipt image/PDF import, config file for LLM backend, hledger validation pass.

Out of scope for MVP: web UI, multi-currency conversion, recurring transactions, bank API integrations.

---

## Implementation Phases

### Phase 1: Project Scaffold & Core Translator
**Goal:** Running CLI that converts a natural-language sentence into a valid hledger transaction and appends it to a journal file.

**Files to create/modify:**
- `pyproject.toml` — project metadata, deps (anthropic, typer, rich, gitpython)
- `src/accountant24/cli.py` — Typer app, `add` and `init` commands
- `src/accountant24/config.py` — loads `~/.config/accountant24/config.toml`, resolves journal path and LLM settings
- `src/accountant24/translator.py` — `nl_to_hledger(text, config)`: sends prompt to LLM, returns hledger transaction string
- `src/accountant24/journal.py` — `append_transaction(path, tx)`: validates with `hledger -f <path> accounts`, appends to file
- `src/accountant24/versioning.py` — `git_commit(journal_path, message)`: init repo if needed, stage, commit
- `prompts/nl_to_hledger.txt` — system prompt with hledger format rules and few-shot examples

**Key steps:**
1. Run `uv init accountant24 --lib`, add deps, set `scripts.a24 = "accountant24.cli:app"`.
2. Write `config.py`: read TOML with `tomllib.open()`; fall back to env vars `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`.
3. Write the system prompt in `prompts/nl_to_hledger.txt`. Include: date inference rules, account hierarchy hints (`expenses:food`, `assets:checking`), three annotated examples (debit, transfer, income). Explicit instruction to return only the raw hledger block.
4. Implement `translator.py`: call `messages.create` with system prompt + user text, strip backticks from response.
5. Implement `journal.py`: after appending, run `subprocess.run(["hledger", "-f", path, "accounts"], check=True)`. On failure, remove the appended block and raise `ValidationError`.
6. Implement `versioning.py` using GitPython: `Repo.init()` if `.git` absent, then `repo.index.add` + `repo.index.commit(message)`.
7. Wire `cli.py`: `a24 add "bought coffee $4.50"` → translate → append → commit → print hledger block in Rich panel.
8. Add `a24 init` command that creates config interactively.

**Verify:** `a24 add "paid rent $1200 from checking"` → prints valid hledger transaction, `git log` shows one commit.

---

### Phase 2: CSV Statement Import
**Goal:** Importing a bank CSV export converts every row into a hledger transaction and commits the batch as a single git commit.

**Files to create/modify:**
- `src/accountant24/importer.py` — `import_csv(path, account, config)`: detects column schema, calls translator per batch, deduplicates
- `src/accountant24/dedup.py` — stores SHA256 hashes of imported rows in `.accountant24_imported` sidecar file
- `src/accountant24/cli.py` — adds `a24 import <file.csv> --account assets:checking` command
- `prompts/csv_row_to_hledger.txt` — system prompt variant for CSV rows with column-detection instruction

**Key steps:**
1. Parse CSV with `csv.DictReader`; auto-detect date, description, amount columns by trying common header names (Date/Transaction Date, Description/Memo, Amount/Debit/Credit).
2. Send rows to LLM in batches of 20; request a JSON array of hledger transaction strings back. Parse with `json.loads`; fall back to line-splitting on parse failure.
3. Hash each row as `sha256(date + amount + description)` and skip rows whose hash is already in `.accountant24_imported`.
4. Validate all translated transactions together with one `hledger -f <tmpfile> accounts` call before appending to the real journal.
5. Append valid transactions, update dedup sidecar, commit as: `Import N transactions from <filename> (account: <account>)`.
6. Print Rich table: rows processed / imported / skipped (duplicate).

**Verify:** `a24 import ~/Downloads/chase_oct.csv --account assets:checking` → "Imported 47 transactions, 0 skipped". Run again → "Imported 0 transactions, 47 skipped (duplicate)".

---

### Phase 3: Receipt & PDF Import
**Goal:** Pointing the tool at a receipt image or PDF extracts the transaction details and adds a properly annotated hledger entry.

**Files to create/modify:**
- `src/accountant24/receipt.py` — `extract_receipt(path)`: dispatches to PDF or image extraction, returns raw text
- `src/accountant24/cli.py` — adds `a24 receipt <file> [--account expenses:food]` command
- `prompts/receipt_to_hledger.txt` — prompt for structured receipt text → hledger entry with merchant name

**Key steps:**
1. For PDFs: `pdfplumber.open(path).pages[0].extract_text()`. For images (.jpg/.png/.webp): send as base64 `image` content block via Claude vision API with the receipt prompt.
2. In `receipt_to_hledger.txt` instruct LLM to extract: merchant name, date, total amount, best-guess expense category. Request hledger format output.
3. Display extracted transaction in Rich for user confirmation before appending (`--yes` flag skips).
4. After appending, copy receipt file to `receipts/` subfolder next to journal; add `; receipt: receipts/filename.pdf` comment to the transaction.
5. Stage and commit the receipt file alongside the journal update.

**Verify:** `a24 receipt ~/Downloads/whole_foods_receipt.jpg --account expenses:groceries` → shows parsed transaction, prompts y/n, appends + commits. Journal entry contains `; receipt: receipts/whole_foods_receipt.jpg`.

---

### Phase 4: NL Query & Reports
**Goal:** The user can ask plain-English questions about their finances and get answers drawn directly from the hledger journal.

**Files to create/modify:**
- `src/accountant24/query.py` — `nl_to_hledger_command(question, config)` + `run_query(args, journal)`
- `src/accountant24/cli.py` — adds `a24 ask "how much did I spend on food last month?"` and `a24 report [--period]`
- `prompts/nl_to_hledger_query.txt` — teaches hledger balance/register/incomestatement CLI syntax and date periods

**Key steps:**
1. Prompt documents: `balance`, `register`, `incomestatement`, `balancesheet`; date filters (`date:2024-10`, `date:lastmonth`); account filters. Provide 5 question→command examples.
2. LLM returns JSON: `{"command": "balance", "args": ["expenses:food", "date:lastmonth"]}`. Parse and run `hledger -f <journal> <command> <args...>`.
3. Pipe hledger stdout through a second LLM call that formats it as a brief English summary + raw table.
4. Add `a24 report [--period thismonth|lastmonth|thisyear]` shortcut running `hledger incomestatement` + `hledger balancesheet` rendered as Rich tables.

**Verify:** `a24 ask "what did I spend on groceries this month?"` → natural-language answer + table. `a24 report --period thismonth` → income statement + balance sheet in terminal.

---

### Phase 5: Local LLM Backend & Polish
**Goal:** Switching to a local Ollama model in config routes all LLM calls through it with no code changes, and the tool handles errors and edge cases gracefully.

**Files to create/modify:**
- `src/accountant24/llm.py` — unified `LLMClient` class: reads `config.llm.provider`, instantiates either `anthropic.Anthropic` or openai-compatible client at `http://localhost:11434/v1`
- All call sites updated to use `LLMClient` instead of the Anthropic SDK directly
- `src/accountant24/cli.py` — adds `a24 config set llm.provider ollama` and `a24 config set llm.model llama3`
- `tests/test_translator.py` — unit tests with mocked LLM responses
- `tests/test_journal.py` — integration tests for append + validation
- `Makefile` — targets: `install`, `test`, `lint` (ruff), `format` (ruff)

**Key steps:**
1. Extract all LLM calls into `llm.py`'s `LLMClient.chat(system, user)`. When `provider=ollama`, use `openai.OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")`.
2. Add retry logic: on `RateLimitError` or `APIConnectionError`, retry up to 3 times with 2-second back-off using `tenacity`.
3. Add `--dry-run` flag to `a24 add` and `a24 import` that prints translated entries without writing to disk.
4. Write tests using `unittest.mock.patch` on `LLMClient.chat`; test strip of markdown fences, missing amounts, empty response.
5. Write `README.md` with install steps, config format, and quickstart for both backends.

**Verify:** `a24 config set llm.provider ollama` + `a24 add "dinner $67"` → same output routed through local model. `make test` → all tests pass.

---

## Estimated Effort

**3 Claude Code sessions** (1 session ≈ 2–4 hours of Claude work).

- **Session 1** — Phase 1: scaffold, config, NL→hledger translator + prompt engineering, journal validation, git versioning, `a24 add` and `a24 init`. Most time on reliable hledger syntax from the LLM.
- **Session 2** — Phases 2 + 3: CSV import with column-detection, batch translation, deduplication; receipt/PDF extraction via pdfplumber and Claude vision. CSV prompt needs iteration across bank formats.
- **Session 3** — Phases 4 + 5: NL query → hledger CLI, report command, unified `LLMClient` for Ollama, retry logic, `--dry-run`, tests, Makefile, README.

---

## Potential Blockers

1. **hledger binary availability** — All validation relies on `hledger` being on PATH. Detect its absence at startup and print a clear install message; without it every validation step fails silently.

2. **Prompt reliability for hledger syntax** — Getting the LLM to consistently produce valid two-posting balanced entries is the largest quality risk. Mitigation: hard-gate with `hledger -f <tmp> accounts` and add a retry loop that feeds the validation error back to the LLM for one correction pass.

3. **Bank CSV format diversity** — Different banks export different column names and date formats. Auto-detection covers Chase/Amex/Schwab patterns; plan `--date-col`, `--amount-col`, `--desc-col` override flags from Phase 2 for edge cases.

4. **Ollama model quality gap** — llama3 8B produces invalid hledger syntax more often than Haiku. The retry loop partially mitigates; consider a `--strict` flag that forces the Claude backend for the NL query command specifically.

5. **Git dirty-tree warnings** — If the user edits the journal manually between `a24 add` calls, the auto-commit silently captures the manual edit. Detect a dirty working tree before the auto-commit and print a one-line notice so the user knows their manual change was included.

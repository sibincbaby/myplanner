# LedgerBot

> Local-first AI finance agent: log expenses in plain language, import bank PDFs, ask questions about your money — all stored as hledger plain-text files tracked in git, works with Claude or any local LLM

**Inspired by:** [machulav/accountant24](https://github.com/machulav/accountant24) (30 ★)  
**Date discovered:** 2026-07-23

---

## What gap it fills

Existing finance apps (YNAB, Monarch, Copilot) require account linking, subscriptions, or closed-source cloud sync. Accountant24 proved the pattern works, but it's a young project with 30 stars and limited onboarding. LedgerBot is a tighter, self-contained version: plain-text hledger files on disk (git-tracked), a Claude-powered conversational shell for logging and querying, PDF/CSV import for bank statements, and zero cloud dependency. Your financial data stays in a folder you own.

## Stack recommendation

| Layer | Choice | Why |
|-------|--------|-----|
| Accounting backend | hledger (Haskell binary, brew/apt installable) | POSIX standard plain-text double-entry; excellent query CLI |
| Agent runtime | Claude API (claude-haiku-4-5 for logging, sonnet for analysis) | Fast + cheap for one-liners; smart for monthly summaries |
| Local model fallback | Ollama + llama3.2 | Offline mode, sensitive data never leaves device |
| Shell | Node.js REPL or Python click CLI | Simple entry point; no Electron needed |
| PDF import | pdfplumber (Python) or pdf-parse (Node) | Extract text from bank statements |
| Storage | `~/.ledgerbot/` folder, hledger `.journal` files | Plain text, git-trackable |
| Git | libgit2 / simple-git | Auto-commit every change with timestamp message |

## MVP scope (1 Claude session)

Three working commands:

1. **`ledgerbot add "spent $45 at Whole Foods yesterday"`** → Claude normalises to hledger entry, writes to current month's `.journal`, git-commits
2. **`ledgerbot ask "how much did I spend on food last month?"`** → runs `hledger balance` with date filter, feeds output to Claude for a plain-English answer
3. **`ledgerbot import statement.csv`** → parses CSV rows, batches them through Claude for categorisation, writes hledger entries

Out of scope for MVP: multi-currency, investment accounts, PDF import, budgets.

## Phases

### Phase 1 — hledger scaffolding (1 h)
- `ledgerbot init`: creates `~/.ledgerbot/`, `accounts.journal` with default accounts (Expenses:Food, Expenses:Transport, etc.), `git init` and initial commit
- `ledgerbot add <text>`: passes text to Claude with a hledger format prompt; writes returned entry to `YYYY-MM.journal`; auto-commits

### Phase 2 — Natural language query (1 h)
- `ledgerbot ask <question>`: runs `hledger balance --tree` and `hledger register` for the relevant period; passes both outputs + question to Claude; prints answer
- Handles: balance questions, top spending categories, month-over-month diff

### Phase 3 — CSV import (1 h)
- `ledgerbot import <file.csv>`: detect bank format (YNAB, Chase, generic); extract date, amount, description per row
- Batch to Claude: "categorise these transactions into hledger accounts" with a few-shot prompt using the user's own account list
- Preview diff before writing; `--dry-run` flag

### Phase 4 — Memory and preferences (0.5 h)
- `~/.ledgerbot/memory.json`: learned mappings (Whole Foods → Expenses:Groceries)
- Claude gets memory context in system prompt; improves categorisation accuracy over time
- `ledgerbot learn "Uber → Expenses:Transport"` to add explicit rule

### Phase 5 — Monthly summary (0.5 h)
- `ledgerbot summary [month]`: generates a Markdown report with top categories, vs. prior month, any unusual items
- Writes to `~/.ledgerbot/reports/YYYY-MM.md`
- Optional: send via email or push notification

## Effort estimate

~2.5 hours for Phases 1–2 (MVP) · 1 Claude session  
~4.5 hours complete with CSV import and memory

## Blockers / risks

- **hledger install requirement**: users need to install hledger (not a Node package). Mitigation: `ledgerbot doctor` checks for hledger, prints install instructions; or ship a bundled static hledger binary.
- **CSV format variation**: every bank exports different column names. Mitigation: a Claude-based format-detection step that identifies date/amount/description columns before parsing.
- **Double-entry accounting complexity**: new users don't know account names. Mitigation: ship a curated `accounts.journal` starter file with 20 common accounts and let Claude pick from it, never asking users to know hledger syntax.

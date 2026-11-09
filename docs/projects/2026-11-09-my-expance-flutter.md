# my-expance — Flutter + Claude Expense Tracker (Reference Architecture)

**Source:** [Friday18/my-expance](https://github.com/Friday18/my-expance) (GitHub new repo 2026, Flutter/Python, MIT, 0★)
**Score:** 4/4 (WB 1 · FG 1 · N 1 · DU 1)
**Shape:** build-your-own using this as a reference. The repo is a solo hobby project with 5 commits and no community, but its architecture is exactly right: Flutter mobile UI + Flask API + Claude tool-calling agent. Build a polished personal version in a weekend.

## Why this one

Personal finance AI tools exist (Rocket Money's Rowan, Cleo Autopilot, Monarch AI) but they all require bank connections, subscriptions, and trusting a SaaS with financial data. The gap is a **local-first**, **Claude-powered** expense tracker that works from typed text or voice, runs on your own backend, and answers questions from YOUR data.

my-expance shows the architecture is simple: a Flutter app sends a natural-language message like "spent 450 on groceries" to a Flask API, which passes it to a Claude agent with tool-calling enabled. The agent calls `add_expense(amount, category, note)`, then answers follow-up questions like "how much did I spend on food this month?" by calling `query_expenses(filter, group_by)`. Six chart styles give visual feedback.

**Why FG=1:** No existing open-source tool combines Flutter (cross-platform mobile), Claude agent tool-calling, and a simple self-hosted backend. Monarch/YNAB are subscription SaaS; Actual Budget is powerful but not AI-native; existing Flutter trackers use Gemini without tool-calling.

**Why N=1:** The combination — Flutter for cross-platform UI + Claude for natural-language expense entry via tool-calling + self-hosted backend — doesn't exist as a polished tool. The reference repo proves the stack works.

**Why WB=1:** The full app is about 400 lines of Dart, 300 lines of Python. The database schema is four tables. Claude's tool-calling API makes the agent straightforward to wire up. Building a working MVP in one focused weekend session is realistic.

**Why DU=1:** Expense logging is daily. A voice-entry mode (dictate "lunch 12 euros") would make it sub-10-second, which is the threshold for consistent daily use.

## Stack recommendation

- **Flutter 3.x** (Dart) — UI, works on Android and iOS from one codebase
- **FastAPI** (Python) — cleaner than Flask for async + type hints; replace Flask from the reference
- **PostgreSQL** — production data; SQLite for local dev
- **Anthropic SDK** (Python) — Claude Sonnet 5.5 for the agent loop; Haiku 5.5 for quick categorizations
- **Firebase Auth** — the reference uses it; keeps auth out of scope for MVP
- **fl_chart** (Flutter package) — the reference uses it for all six chart styles
- **Render** (or Railway) — free-tier backend hosting; the reference includes a `render.yaml`

## MVP scope

An app where you:
1. Sign in with Google via Firebase Auth
2. Type (or later voice-dictate) "spent 450 on dinner with friends"
3. See the expense appear categorized in a list
4. Ask "how much did I spend eating out this week?" and get a natural-language answer
5. See a simple donut chart of spending by category for the month

Out of scope (MVP): receipt OCR, bank sync, recurring expense detection, budget alerts, iOS App Store distribution.

## Phases

1. **Backend scaffold (1 session).** FastAPI app with four tables (users, expenses, categories, sessions). Three endpoints: `POST /chat` (Claude agent loop), `GET /expenses` (filtered list), `GET /summary` (monthly totals). Dockerfile and `render.yaml`. Deploy to Render free tier.
2. **Claude agent (1 session).** Define four tools: `add_expense`, `edit_expense`, `delete_expense`, `query_expenses`. Implement the tool-calling loop in Python. Test with 20 natural-language inputs: edge cases like "split the dinner bill 3 ways", "undo the last entry", "show me all subscriptions".
3. **Flutter UI (1 session).** Chat-first interface: a message input at the bottom, expense list above, and a floating "Charts" tab. Use fl_chart for the donut. Connect to the backend via `http` package. Firebase Auth for sign-in.
4. **Budget tracking (30 min).** Add a monthly budget per category. Show remaining budget next to each category in the chart. Send a local notification when a category exceeds 80%.
5. **Voice entry (1 session, optional).** Use `speech_to_text` Flutter package. Record button in the chat input. Transcribe locally, send transcript to the agent. Test with accented speech and amounts in multiple currencies.

## Effort

Phases 1–3: 2–3 sessions. Phase 4: 30 minutes. Phase 5: 1 more session.

## Blockers / risks

- **Tool-calling accuracy:** Claude occasionally mis-categorizes or mis-parses amounts, especially for non-English inputs. Mitigate with a few-shot system prompt that includes 10 example expense statements with correct tool calls.
- **Flutter toolchain setup:** Flutter requires the Android SDK and Xcode (for iOS). Set up the dev environment before the coding session starts; this alone can take an hour.
- **Backend cold starts on Render free tier:** Render's free tier spins down after 15 minutes of inactivity. The first request after a cold start takes 10–30 seconds. Upgrade to Render Starter ($7/month) or use Railway's free tier (doesn't spin down).
- **Firebase costs:** Firebase Auth is free for personal use (10k sign-ins/month). Crashlytics is free. No billing risk for a personal tool.
- **Data migration:** when you change the database schema in phase 2 or 4, Alembic migrations handle it. Add Alembic from day one, not as an afterthought.

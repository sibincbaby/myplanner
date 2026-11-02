# fastbrowse — open-source browser agent with Jev choice model (10× cheaper than BrowserUse)

**Source:** [agent-labs-dev/fastbrowse](https://github.com/agent-labs-dev/fastbrowse) (PyPI v0.1.0–v0.9.1; MIT; Product Hunt 138 votes Nov 1)
**Score:** 3/4 (WB 1 · FG 1 · N 1 · DU 0)
**Shape:** install-first plus extend. The library is installable today; the plan is to use it for a real browser automation task and evaluate whether it genuinely replaces BrowserUse or screenshot-based approaches.

## Why this one

fastbrowse takes a different architectural approach to browser agents than Playwright-AI or BrowserUse:

1. **Page indexing:** instead of taking a screenshot and asking the model to find the target visually, fastbrowse indexes the page's interactive candidates (buttons, links, inputs) into a structured list
2. **Jev choice model:** a lightweight decision model picks the next candidate from the list rather than generating arbitrary actions from a full screenshot
3. **Safety gates:** irreversible actions (form submissions, purchases, deletes) require an explicit `authorize=True` flag; secrets are passed by name, never as plaintext to the model

Self-reported benchmark: 99.2% task success rate at $0.0296/task (vs. $0.3180 for BrowserUse), across 46 tasks. These are the project's own numbers; verify independently before relying on them.

**Why FG=1:** Claude Code sessions sometimes need to browse documentation, check URLs, or verify live data. The current toolkit has no browser agent integration. Playwright scripting is too manual for one-off agent tasks.

**Why N=1:** Page candidate indexing + a choice model is architecturally different from every screenshot-based browser agent in the ecosystem. This approach is inherently cheaper (no vision model for every step) and safer (reversibility gates are baked in).

**Why WB=1:** `pip install fastbrowse` and a 30-line Python script is enough to run the first real task.

**Why DU=0:** Browser automation is a specific tool, not something used every day. Worth having available; not a daily driver.

## Stack

- **Python 3.10+**, installable via `pip install fastbrowse`
- **Browser:** Chromium via Playwright (managed by fastbrowse)
- **Models:** any OpenAI-compatible API; configure with standard env vars
- **Jev choice model:** built-in to the library (no extra install)
- **Safety gates:** `authorize=True` flag on `Agent.do()` for irreversible actions

## MVP scope

1. Install fastbrowse, verify Playwright browser installs correctly
2. Run a real task: "go to GitHub, find the latest release of repo X, return the version number"
3. Run a form-submission task: "fill out the contact form at URL Y with these details" — test that it requires `authorize=True`
4. Wrap the above as an MCP tool callable from Claude Code sessions

Out of scope (MVP): session persistence, proxy/auth, custom Jev model fine-tuning.

## Phases

1. **Install and verify (30 min).** `pip install fastbrowse`, run the README example, confirm browser launches and Jev model initializes.
2. **Read-only task (1h).** Automate a real information-retrieval task: check a competitor's pricing page, extract a table, return structured JSON. Verify accuracy.
3. **Write task with safety gate (1h).** Test a form-submission task. Confirm the irreversible-action gate blocks it without `authorize=True`. Enable it and verify the submission happens correctly.
4. **MCP tool wrapping (1 session).** Write a simple MCP server with one tool: `browse(task: str, authorize: bool) -> str`. Add it to Claude Code's MCP config. Test invoking it from a Claude Code session.
5. **Benchmark vs. cost (optional).** Run 10 diverse tasks, measure token cost per task. Compare to BrowserUse to validate the 10× claim on real tasks.

## Effort

Install through MCP tool: 1 day (2 short sessions).

## Blockers / risks

- **Self-reported benchmarks:** The 99.2% / $0.0296 numbers come from the project's own PyPI README. Real-world task complexity varies widely. Don't assume these numbers hold for your specific use cases without testing.
- **Jev model updates:** The choice model is bundled; if it underperforms on unusual page layouts, there's no obvious way to fine-tune or swap it in the MVP. This is a research project — expect rough edges.
- **Playwright install on cloud sessions:** The pre-installed Chromium (`/opt/pw-browsers/chromium`) in cloud environments may conflict with fastbrowse's bundled Playwright install. Test with `executablePath='/opt/pw-browsers/chromium'` if the default install fails.
- **Auth and session state:** The current MVP has no cookie/session persistence. Authenticated flows (GitHub, banking) require additional setup. Skip those for the MVP.

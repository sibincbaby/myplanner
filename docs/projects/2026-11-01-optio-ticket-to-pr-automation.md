# optio — auto-drive any coding agent from issue-creation to merged PR via CI + review loop

**Source:** [jonwiggins/optio](https://github.com/jonwiggins/optio) (last push ~Oct 30, 2026; ~978★, MIT; also mirrored as 5rk7n/optio with Jira/Notion intake)
**Score:** 3/4 (WB 0 · FG 1 · N 1 · DU 1)
**Shape:** install-first (Helm on Kubernetes). The core loop is already built; this plan is about deploying it against a real repo and tuning the adapter for Claude Code.

## Why this one

Optio is a self-hosted orchestration system that turns a GitHub issue (or Jira/Notion ticket in the fork) into a merged pull request, fully autonomously:

1. **Issue intake:** triggered on new GitHub issue or PR open
2. **Agent spin-up:** starts a Claude Code (or Codex/Copilot/Gemini/OpenCode) session with the issue as the task
3. **CI watch:** polls the PR every 30s; on CI failure, resumes the agent with the failure log as context
4. **Review watch:** on "changes requested", resumes the agent with the review comments as context
5. **Merge:** squash-merges the PR when CI passes and no blocking reviews remain; closes the linked issue

**Why FG=1:** The current setup does multi-agent tasks via Claude Code Workflows but nothing that closes the loop back from GitHub CI or review comments to a running agent automatically. After an agent pushes a PR, the human still has to watch, fix CI failures, and re-push. Optio eliminates that middle gap.

**Why N=1:** Agent-to-CI-to-review-to-merge automation is distinct from all the multi-agent UIs and orchestration panels in seen.json. Those tools (Orca, Harness Studio, CCManagerUI, etc.) manage *starting* agents; Optio manages *finishing* them.

**Why DU=1:** On any project with a backlog of GitHub issues, Optio lets you create a batch of issues and walk away. The CI→review→merge cycle runs overnight.

**Why WB=0:** Helm deployment is more than a 2-session weekend build. But the Docker Compose path may be simpler — check the repo's deployment docs first.

## Do this today (evaluation)

```sh
# Clone and read the README / Helm chart before committing to deployment
git clone https://github.com/jonwiggins/optio ~/.scratch/optio-eval
cat ~/.scratch/optio-eval/README.md
cat ~/.scratch/optio-eval/charts/optio/values.yaml   # if Helm
```

Key questions to answer in the evaluation:
1. Is Docker Compose available as an alternative to Kubernetes?
2. Which coding agent adapters are production-ready vs experimental (Codex is listed as "experimental")?
3. What GitHub App permissions does the webhook need?
4. Does CI failure context get trimmed before passing to the agent, or is the full log injected?

## Stack

- **Deployment:** Helm chart on Kubernetes (primary); check if Docker Compose exists
- **Adapters:** Claude Code, OpenAI Codex, GitHub Copilot, Google Gemini CLI, OpenCode
- **Trigger:** GitHub webhook (PR open, CI status, PR review events)
- **Polling:** 30s interval on PR state
- **Merge:** squash merge via GitHub API; linked issues closed via "closes #N" in PR body

## MVP scope

1. Single repo connected with the Claude Code adapter
2. Create one test issue ("add a README badge"), let Optio drive it to a merged PR
3. Verify CI-failure resume works: deliberately break CI once and confirm Optio re-invokes the agent

Out of scope (MVP): Jira/Notion intake, multi-repo, custom merge strategies, review auto-approval.

## Phases

1. **Evaluate deployment options (30 min).** Read the README, confirm whether Docker Compose exists, note required environment variables and GitHub App setup steps.
2. **GitHub App + webhook (1h).** Create a GitHub App with the required permissions, install it on one test repo, configure the webhook URL pointing to the Optio deployment.
3. **First deployment (1 session).** Deploy Optio (Docker Compose or Helm), wire the Claude Code adapter with the API key, confirm it starts and shows the webhook listener.
4. **End-to-end test (1 session).** Create a "hello world" test issue. Watch Optio spin up Claude Code, open a PR, handle CI (green or red path), and merge. Verify the issue closes.
5. **Production repo (optional, 1 session).** Connect a real project's backlog. Create 3–5 issues with clear acceptance criteria. Let Optio run overnight.

## Effort

Evaluation: 30 min. Full install: 2–3 sessions spread over a weekend.

## Blockers / risks

- **Kubernetes dependency:** If Docker Compose isn't available, running a local K8s (k3s/minikube) adds 30–60 min setup. On the other hand, a cloud K8s cluster (fly.io, Railway) could work if the box doesn't have one running.
- **GitHub App permissions:** The webhook requires write access to PRs, issues, and status checks. Careful about which repos the App is installed on.
- **Claude Code adapter maturity:** Check the adapter version; a "last push Oct 30" is fresh, but a single-developer repo at ~978★ may have rough edges in the adapter implementations.
- **Long-running sessions:** Claude Code sessions have a context window limit. For complex issues, Optio needs to manage context hand-offs. Verify the adapter handles session expiry.
- **Review auto-response scope:** Optio resumes the agent on "changes requested" but doesn't interpret reviewer intent beyond the written comment. Code review quality from the agent depends on how specific the comments are.

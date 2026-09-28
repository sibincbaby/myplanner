# agent-messenger — Multi-Platform Messaging CLI for AI Agents

**Source:** <https://github.com/agent-messenger/agent-messenger>
**Discovered:** 2026-09-28
**Viability:** 3/4

> AI agents in CI/CD pipelines and autonomous Claude Code sessions need to notify humans — but setting up a Slack bot requires OAuth registration, scope approval, and workspace admin sign-off. `agent-messenger` extracts the user's existing Slack/Discord/Teams session token from the desktop app and sends messages as the user, with zero OAuth setup. The novel angle is "act as yourself, not as a bot." An MVP scoped to Slack + Discord is achievable in a weekend and independently useful.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

**Weekend-buildable (1):** Extracting a Slack token from the Electron app's LevelDB storage is a documented technique; a TypeScript/Bun CLI wrapping it with `am send slack @user "message"` is a focused 300-line build. Discord follows the same pattern. Both platforms in one weekend is achievable.

**Fills a gap (1):** Slack's official bot API requires workspace admin setup. Teams' webhooks require AAD registration. For a solo developer running an autonomous agent, "just send the message as me" removes the entire admin dependency. Nothing in the existing OSS landscape does this with a clean CLI interface.

**Novel (1):** Webhook-based and bot-based agent messaging tools exist (n8n, Make, Zapier). Acting as the user's own session — without a bot token or webhook URL — is the specific novel angle. The upstream project does this across 12+ platforms; a two-platform MVP is the novel core.

**Daily utility (0):** Only fires if you regularly run autonomous agents that need to notify people. Most Claude Code sessions are interactive. This earns its place in a CI/CD pipeline or an overnight research agent, not in a typical workday. The daily-utility ceiling keeps this at 3/4.

---

## Implementation Plan

### Overview

agent-messenger has two layers:
1. **Token extraction:** Read the platform's stored session token from the desktop app's local storage (Slack: Electron LevelDB; Discord: similar path).
2. **Message dispatch:** Use the platform's undocumented or documented internal API (not the bot API) to post a message using the extracted token.

The CLI wraps both layers with a single `am send <platform> <recipient> <message>` interface.

### Stack Recommendation

| Concern | Choice | Why |
|---|---|---|
| Runtime | Bun | Fast startup; TypeScript-native; upstream uses Bun |
| CLI framework | `commander` or raw `process.argv` | Minimal; CLI is simple |
| Slack API | Slack internal web API (`chat.postMessage` with user token) | Works with extracted xoxc/xoxd tokens |
| Discord API | Discord HTTP API (`POST /channels/{id}/messages`) | Works with extracted user token |
| Token storage | `~/.config/agent-messenger/credentials.json` (mode 600) | Local only; never transmitted |
| TypeScript SDK | Exported `sendMessage(platform, recipient, message)` function | For programmatic use from agent code |

### MVP Scope

**In:**

1. `am send slack @username "message"` — sends a Slack DM as the current user.
2. `am send discord @username "message"` — sends a Discord DM as the current user.
3. `am auth slack` — extracts and stores the Slack token from the desktop app.
4. `am auth discord` — extracts and stores the Discord token from the desktop app.
5. TypeScript SDK: `import { sendMessage } from 'agent-messenger'` for use inside agent code.

**Out of v1:** group channels, Teams/Telegram/WhatsApp, real-time event streaming, `am recv` for incoming messages, multi-account support.

### Phases

**Phase 1 — Slack token extraction + DM send (2 h).** Locate the Slack desktop app's LevelDB database (`~/Library/Application Support/Slack/` on macOS, `~/.config/Slack/` on Linux). Extract the `xoxc-*` and `xoxd-*` tokens. Use `chat.postMessage` with `channel` set to the DM channel ID (obtained via `conversations.list` filtered to DMs). Test: `am send slack @yourself "hello"` appears in Slack.

**Phase 2 — `am auth` credential storage (1 h).** Store extracted tokens in `~/.config/agent-messenger/credentials.json` with mode 600. Add `am auth list` to show stored platforms. Add `am auth revoke slack` to remove the token. Test: credential file is not world-readable; `am auth list` shows Slack as configured.

**Phase 3 — Discord support (1.5 h).** Locate the Discord desktop app's LevelDB (`~/Library/Application Support/discord/`). Extract the user token. Resolve the recipient username to a channel ID via `GET /api/v10/users/@me/channels`. Send via `POST /api/v10/channels/{id}/messages`. Test: `am send discord @yourself "hello"` appears in Discord.

**Phase 4 — TypeScript SDK (1 h).** Export `sendMessage(platform: 'slack' | 'discord', recipient: string, message: string): Promise<void>` from `index.ts`. Publish to npm as `agent-messenger`. Test: call from a Claude Code agent skill via `execSync('am send slack @user "task complete"')` or via the SDK import.

**Phase 5 — Channel messaging + recipient resolution (1 h).** Support `am send slack #channel-name "message"` for channel posts (not just DMs). Resolve channel names to IDs via `conversations.list`. Add `--dry-run` flag that prints the resolved channel ID without sending.

**Total effort:** 6.5 hours across one to two sessions. Phases 1–3 alone give a working two-platform CLI; Phases 4–5 add the programmatic SDK and channel support.

### Blockers and Known Ceilings

- **Platform TOS.** Both Slack and Discord's Terms of Service prohibit using user tokens for automated messaging in some interpretations. The use case (an agent notifying your own account or DM'ing a known colleague) is grey-zone at worst; using a user token you extracted from your own desktop app is not the same as credential stuffing. Document the caveat clearly in the README and add a disclaimer to `am auth`.
- **Token extraction path variance.** Slack's Electron app uses a different storage path and LevelDB version on Windows, macOS, and Linux. Start with macOS (Phase 1), then add Linux (Phase 3 concurrent). Windows is a Phase 6 stretch goal.
- **LevelDB dependency.** Extracting from LevelDB requires a native Node/Bun module (`classic-level` or `leveldb`). Pin the version; Bun's native module support may differ from Node's. Test on both runtimes before publishing.
- **Token rotation.** Slack's `xoxc` tokens expire after ~90 days or on logout. Add a `token_expires_hint` field to the credential store and warn the user if the token is likely stale (based on last-set date). `am auth refresh slack` should re-extract from the desktop app.
- **Daily-utility ceiling.** This tool earns its place in overnight agents and CI pipelines. In interactive Claude Code sessions, the user is already watching the terminal — sending a notification to themselves is not the killer use case. Market it as a CI/CD and autonomous-agent tool from day one.

# Agent Plugin — Personal Portable Plugin Bundle

**Source:** [agentplugins/agent-plugins-spec](https://github.com/agentplugins/agent-plugins-spec) · Spec v1.0.0 · 1.1k★ · Released Aug 6, 2026
**Date discovered:** 2026-08-26

## What it is

Agent Plugins 1.0.0 is a vendor-neutral open standard — backed by Amazon, Anysphere, Microsoft, OpenAI, and Vercel — for packaging Agent Skills and MCP servers into a single distributable folder. A `plugin.json` manifest declares which skills (Markdown files in `skills/`) and MCP servers (entries in `mcp.json`) the plugin contains. Any compliant client can install and use the plugin with one command.

The spec is already implemented in Codex CLI (shipped Aug 7, 2026) and is being adopted by other agents. Claude Code plugin support is expected as part of the rollout.

## Why it fits

- Core interest: **Claude/LLM tooling** — packages all existing skills and MCP configs into one portable unit
- Core interest: **Dev productivity** — eliminates per-project, per-agent skill/MCP setup overhead
- `novel = 1`: unified packaging across all agents is brand new (v1.0.0, Aug 6)
- `daily_utility = 1`: every project starts by installing the personal plugin; all tools land in one command

## Viability

| Criterion | Score | Reason |
|-----------|:-----:|--------|
| weekend_buildable | 1 | Writing a `plugin.json` and organizing existing skills/MCP configs is one session |
| fills_gap | 1 | Skills and MCP configs are currently spread across repos, CLAUDE.md files, and ad-hoc configs |
| novel | 1 | Agent Plugins 1.0.0 was released 20 days ago; the personal-plugin use case is new |
| daily_utility | 1 | Install once per project; every agent gets the full toolkit immediately |
| **Total** | **4/4** | **VIABLE** |

**Note:** The plan below is about building YOUR personal plugin package that bundles the tools and skills you already use, not re-implementing the spec. The spec is done; the deliverable is the plugin itself.

## Stack Recommendation

```
Format:        Agent Plugins 1.0.0 (agentplugins/agent-plugins-spec)
Skills:        Markdown files following the existing .claude/skills/ convention
MCP config:    JSON following the spec's mcp.json schema
Distribution:  GitHub repo (public or private) + npm publish for one-command install
Installer:     npx agent-plugin install <your-plugin-name> (or direct `agents-cli`)
CI:            GitHub Actions — validate plugin.json against JSON schema on push
```

## MVP Scope (1-2 Claude sessions)

A personal plugin repo `my-agent-plugin` with:

```
my-agent-plugin/
├── plugin.json          # manifest: name, version, description, skills, mcp
├── skills/
│   ├── morning.md       # daily brief skill
│   ├── code-review.md   # code review skill
│   ├── dataviz.md       # dataviz design skill
│   └── security-review.md
├── mcp.json             # MCP server declarations
├── README.md
└── .github/
    └── workflows/
        └── validate.yml  # validate plugin.json on push
```

The `plugin.json` declares everything; any agent that supports Agent Plugins 1.0.0 installs the full toolkit with one command.

## Phases

### Phase 1: Inventory + plugin.json (1h)
- List all skills currently in `.claude/skills/` and CLAUDE.md imports
- List all active MCP servers from Claude Desktop config (`~/.config/claude/mcp.json`)
- Write `plugin.json`:
  ```json
  {
    "name": "@sibincbaby/my-agent-plugin",
    "version": "0.1.0",
    "description": "Personal AI coding toolkit — skills + MCP servers",
    "skills": [
      { "name": "morning", "path": "skills/morning.md" },
      { "name": "code-review", "path": "skills/code-review.md" },
      { "name": "dataviz", "path": "skills/dataviz.md" },
      { "name": "security-review", "path": "skills/security-review.md" }
    ],
    "mcp": "./mcp.json"
  }
  ```
- Validate against the spec's JSON schema (`agentplugins/agent-plugins-spec/schemas/plugin-1.0.0.json`)
- Verify: schema validation passes with zero errors

### Phase 2: Skills Extraction (1h)
- Copy each active skill's Markdown file into `skills/`
- For skills that import external content (via `npx skills add`), inline the content so the plugin is self-contained
- Add a `metadata:` front-matter block to each skill file with `description`, `triggers`, `version`
- Verify: each skill file passes the spec's skill schema validator

### Phase 3: MCP Config (0.5h)
- Write `mcp.json` with all active MCP server declarations (Google Drive, Supabase, GitHub, etc.)
- Parameterize secrets using `${ENV_VAR}` syntax so the plugin is publishable without leaking credentials
- Include a `.env.example` listing all required environment variables
- Verify: `mcp.json` validates against spec schema; secrets are not hardcoded

### Phase 4: GitHub Repo + Validation CI (0.5h)
- Create GitHub repo `my-agent-plugin` under `sibincbaby`
- Add `.github/workflows/validate.yml`: on push, run `npx @agentplugins/cli validate .` against the JSON schema
- Add a README with one-line install instructions for Codex CLI and Claude Code
- Push and confirm CI passes green
- Verify: install from the repo in a fresh directory; skills and MCP entries appear in the agent client

### Phase 5: Version + Publish (0.5h)
- `npm init` + `npm publish --access public` to publish as `@sibincbaby/my-agent-plugin` on npm
- One-command install: `npx @agentplugins/cli install @sibincbaby/my-agent-plugin`
- Add SemVer tag `v0.1.0` on GitHub; set up Release workflow to auto-publish to npm on tag push
- Verify: install from npm in a clean environment; full toolkit appears

## Effort Estimate

| Phase | Hours |
|-------|-------|
| Inventory + plugin.json | 1h |
| Skills extraction | 1h |
| MCP config | 0.5h |
| GitHub repo + CI | 0.5h |
| Publish to npm | 0.5h |
| **Total** | **3.5h (half a day)** |

## Blockers / Risks

- **Claude Code plugin support.** As of Aug 26, Claude Code's client-side plugin install is not yet confirmed as GA. Check the Claude Code changelog before Phase 4. If it isn't supported, the plugin still works in Codex CLI and any other compliant client; Claude Code support can be added when it lands.
- **Self-contained vs. linked skills.** Some skills (`morning`, `ai-discovery`) have complex logic or import external skill packs. Inlining them increases the plugin size. Keep `skills/` under 500KB total; link out to external installs for skill packs larger than that.
- **MCP secret management.** Publishing a plugin with real MCP credentials is a security risk even in a private repo. Use `${ENV_VAR}` substitution and document required env vars. Confirm the agent client you target supports env var substitution before publishing.
- **Spec stability.** Agent Plugins 1.0.0 was released Aug 6; v1.1.0 is in working draft. Locking to `1.0.0` in `plugin.json` ensures compatibility; upgrade when the clients you use adopt 1.1.0.
- **Inventory completeness.** Skills added ad-hoc to individual CLAUDE.md files won't be caught by scanning `.claude/skills/`. Do a full grep across all active project directories before finalizing the skills list.

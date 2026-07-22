import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AI Discovery',
  description: 'Daily AI project discovery dashboard',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Daily', link: '/daily/' },
      { text: 'Projects', link: '/projects/' }
    ],
    sidebar: [
      {
        text: 'Daily Digests',
        items: [
          { text: '2026-07-22', link: '/daily/2026-07-22' },
          { text: '2026-07-21', link: '/daily/2026-07-21' },
          { text: '2026-07-19', link: '/daily/2026-07-19' },
          { text: '2026-07-18', link: '/daily/2026-07-18' },
          { text: '2026-07-17', link: '/daily/2026-07-17' },
          { text: '2026-07-16', link: '/daily/2026-07-16' },
          { text: '2026-07-15', link: '/daily/2026-07-15' },
          { text: '2026-07-14', link: '/daily/2026-07-14' },
          { text: '2026-07-13', link: '/daily/2026-07-13' },
          { text: '2026-07-12', link: '/daily/2026-07-12' },
          { text: '2026-07-11', link: '/daily/2026-07-11' },
          { text: '2026-07-10', link: '/daily/2026-07-10' },
          { text: '2026-07-09', link: '/daily/2026-07-09' },
          { text: '2026-07-08', link: '/daily/2026-07-08' },
          { text: '2026-07-07', link: '/daily/2026-07-07' },
          { text: '2026-07-06', link: '/daily/2026-07-06' },
          { text: '2026-07-05', link: '/daily/2026-07-05' },
          { text: '2026-07-03', link: '/daily/2026-07-03' },
          { text: '2026-07-02', link: '/daily/2026-07-02' },
          { text: '2026-07-01', link: '/daily/2026-07-01' }
        ]
      },
      {
        text: 'Project Plans',
        collapsed: false,
        items: [
          { text: 'LocalMic', link: '/projects/2026-07-22-localmic' },
          { text: 'VoiceCode', link: '/projects/2026-07-22-voicecode' },
          { text: 'EchoCode', link: '/projects/2026-07-22-echocode' },
          { text: 'SessionVault', link: '/projects/2026-07-22-sessionvault' },
          { text: 'ClaudeScope', link: '/projects/2026-07-22-claudescope' },
          { text: 'Personal Skill Forge', link: '/projects/2026-07-21-personal-skill-forge' },
          { text: 'VoxDiary Flutter', link: '/projects/2026-07-21-voxdiary-flutter' },
          { text: 'Claude Finance Mcp', link: '/projects/2026-07-21-claude-finance-mcp' },
          { text: 'Claude Session Nexus', link: '/projects/2026-07-21-claude-session-nexus' },
          { text: 'Claude Branch Tree Based Conversation Branching For Claude Code', link: '/projects/2026-07-19-claude-branch-tree-based-conversation-branching-for-claude-code' },
          { text: 'Local Finance Mcp Local First Personal Finance Copilot', link: '/projects/2026-07-19-local-finance-mcp-local-first-personal-finance-copilot' },
          { text: 'Managed Agent Bridge Mcp Server For Claude Managed Agents', link: '/projects/2026-07-19-managed-agent-bridge-mcp-server-for-claude-managed-agents' },
          { text: 'Retry Guard Claude Code Hook That Blocks Repeating Failed Fixes', link: '/projects/2026-07-18-retry-guard-claude-code-hook-that-blocks-repeating-failed-fixes' },
          { text: 'Radar Mcp Personal Discovery Feed Mcp For Claude', link: '/projects/2026-07-17-radar-mcp-personal-discovery-feed-mcp-for-claude' },
          { text: 'Memex Local First Ai Journal App With Byo Llm', link: '/projects/2026-07-16-memex-local-first-ai-journal-app-with-byo-llm' },
          { text: 'Pulse Phone Based Approval Dashboard For Claude Code Tool Calls', link: '/projects/2026-07-15-pulse-phone-based-approval-dashboard-for-claude-code-tool-calls' },
          { text: 'Claude Video Let Claude Process Videos Via Frame Extraction Transcription', link: '/projects/2026-07-14-claude-video-let-claude-process-videos-via-frame-extraction-transcription' },
          { text: 'Herdr Terminal Native Agent Multiplexer With Agent State Awareness', link: '/projects/2026-07-13-herdr-terminal-native-agent-multiplexer-with-agent-state-awareness' },
          { text: 'Aura Git Native Semantic Version Control Ide For Ai Coding Agents', link: '/projects/2026-07-13-aura-git-native-semantic-version-control-ide-for-ai-coding-agents' },
          { text: 'Context Warp Drive Deterministic Cache Preserving Context Folding', link: '/projects/2026-07-12-context-warp-drive-deterministic-cache-preserving-context-folding' },
          { text: 'Paleo Composable Token Saving Skills For Claude Code Codex Gemini 50 70 Output Reduction', link: '/projects/2026-07-11-paleo-composable-token-saving-skills-for-claude-code-codex-gemini-50-70-output-reduction-' },
          { text: 'Memsync One Shared Encrypted Local First Memory For Claude Code And Codex', link: '/projects/2026-07-11-memsync-one-shared-encrypted-local-first-memory-for-claude-code-and-codex' },
          { text: 'Peek Cli', link: '/projects/2026-07-10-peek-cli' },
          { text: 'Frugon', link: '/projects/2026-07-10-frugon' },
          { text: 'Claude Journal Mcp', link: '/projects/2026-07-10-claude-journal-mcp' },
          { text: 'Open Design', link: '/projects/2026-07-08-open-design' },
          { text: 'Monarch Mcp', link: '/projects/2026-07-08-monarch-mcp' },
          { text: 'Mcpsnoop', link: '/projects/2026-07-08-mcpsnoop' },
          { text: 'Apfel', link: '/projects/2026-07-08-apfel' },
          { text: 'Claude Code By Agents', link: '/projects/2026-07-07-claude-code-by-agents' },
          { text: 'Agents Ui', link: '/projects/2026-07-07-agents-ui' },
          { text: 'Statewright', link: '/projects/2026-07-06-statewright' },
          { text: 'Finance Agent', link: '/projects/2026-07-06-finance-agent' },
          { text: 'Dune Hotkeys', link: '/projects/2026-07-06-dune-hotkeys' },
          { text: 'Agent Messenger', link: '/projects/2026-07-06-agent-messenger' },
          { text: 'Wikix', link: '/projects/2026-07-03-wikix' },
          { text: 'Kojo', link: '/projects/2026-07-03-kojo' },
          { text: 'Calstakk', link: '/projects/2026-07-03-calstakk' },
          { text: 'Apparat', link: '/projects/2026-07-03-apparat' },
          { text: 'Private Agent', link: '/projects/2026-07-02-private-agent' },
          { text: 'Natively', link: '/projects/2026-07-02-natively' },
          { text: 'Expense Budget Tracker', link: '/projects/2026-07-02-expense-budget-tracker' },
          { text: 'Claudish', link: '/projects/2026-07-02-claudish' },
          { text: 'Agentic Tools Mcp', link: '/projects/2026-07-02-agentic-tools-mcp' },
          { text: 'Openknowledge', link: '/projects/2026-07-01-openknowledge' },
          { text: 'Moodiary', link: '/projects/2026-07-01-moodiary' },
          { text: 'Cloudcli Claude Code Mobile Ui', link: '/projects/2026-07-01-cloudcli-claude-code-mobile-ui' },
          { text: 'Agent Teams Ai', link: '/projects/2026-07-01-agent-teams-ai' }
        ]
      }
    ],
    socialLinks: [],
    search: { provider: 'local' }
  }
})

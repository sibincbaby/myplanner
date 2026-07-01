# agent-teams-ai — Multi-Agent Kanban Orchestration

**Inspired by:** [github.com/777genius/claude_agent_teams_ui](https://github.com/777genius/claude_agent_teams_ui)  
**Source:** GitHub search — Claude agent UIs (June 2026)  
**Interest score:** 3/4 (Claude tooling + agent UI + novel orchestration pattern)

## What It Is

A web app where you manage a "team" of Claude agents as if they were employees. Each agent has a role (e.g. Researcher, Coder, Reviewer), you assign tasks via a kanban board, agents work concurrently, can message each other, and one can review another's output before you approve. You watch the board and give high-level commands.

## Why Build Your Own

The original is a complex orchestration layer with 200+ model support. Your version can be lean and Claude-only, with exactly the workflow patterns you care about. The kanban metaphor for agent state is the novel insight worth capturing.

## Stack Recommendation

- **Next.js 15** (App Router) — frontend + API routes
- **Claude Agent SDK** (`@anthropic-ai/claude-code`) — agent spawning and tool use
- **Zustand** — shared kanban state (board, cards, agents)
- **Drizzle ORM + SQLite** (`better-sqlite3`) — persist tasks, messages, outputs
- **React DnD** or **@dnd-kit/core** — drag-and-drop between kanban columns
- **Server-Sent Events** — stream agent progress to the board

---

## Implementation Phases

### Phase 1 — Kanban Board UI
**Goal:** A static kanban board with columns: Backlog → In Progress → Review → Done.

**Files:**
- `app/page.tsx` — board layout
- `components/Board.tsx` — column container
- `components/TaskCard.tsx` — draggable card with title, assigned agent, status
- `store/boardStore.ts` — Zustand store for board state

**Key steps:**
1. `npm install @dnd-kit/core @dnd-kit/sortable zustand`
2. Define `Task` type: `{id, title, description, status, assignedAgent, output}`
3. Render 4 columns from `useBoard()` store, map tasks to `<TaskCard>`
4. `DndContext` + `SortableContext` → `onDragEnd` updates `task.status` in store
5. "New Task" button → modal with title + description fields → adds to Backlog

**Verify:** Create 3 tasks, drag them between columns — state persists in Zustand.

---

### Phase 2 — Agent Definitions + SQLite Persistence
**Goal:** Define named agents with roles; persist tasks and agent configs to SQLite.

**Files:**
- `db/schema.ts` — Drizzle schema: `tasks`, `agents`, `messages`
- `db/index.ts` — Drizzle client
- `app/api/agents/route.ts` — CRUD for agent definitions
- `components/AgentSidebar.tsx` — list of agents with role + avatar colour

**Key steps:**
1. `npm install drizzle-orm better-sqlite3 drizzle-kit`
2. Schema: `agents(id, name, role, systemPrompt, colour)`, `tasks(id, title, desc, status, agentId, output, createdAt)`
3. Seed 3 default agents: Researcher (web search), Coder (write code), Reviewer (critique)
4. Sync Zustand store with DB on load; write-through on state changes
5. AgentSidebar shows agents; click to edit system prompt

**Verify:** Add a custom agent "Finance Analyst", reload page — it persists.

---

### Phase 3 — Agent Execution
**Goal:** Assign a task to an agent; the agent runs and streams progress back to the board.

**Files:**
- `app/api/tasks/[id]/run/route.ts` — POST → spawn Claude SDK agent
- `lib/agentRunner.ts` — wraps Claude SDK, streams text deltas via SSE
- `hooks/useTaskStream.ts` — subscribes to SSE, updates task output in real time

**Key steps:**
1. `npm install @anthropic-ai/sdk`
2. `agentRunner.ts`: `Anthropic.messages.stream({model, system: agent.systemPrompt, messages: [{role:'user', content: task.description}]})`
3. Pipe stream deltas to SSE response
4. On POST, move task to `In Progress`, start stream
5. `useTaskStream(taskId)` reads SSE, appends to `task.output`, re-renders card
6. On stream end, set task status to `Review`

**Verify:** Assign "Research Flutter state management options" to the Researcher agent; watch output stream into the card.

---

### Phase 4 — Agent-to-Agent Review
**Goal:** A Reviewer agent reads another agent's output and adds a critique before the task moves to Done.

**Files:**
- `lib/reviewRunner.ts` — runs Reviewer agent with task output as input
- `components/ReviewPanel.tsx` — shows original output + review side by side
- `app/api/tasks/[id]/review/route.ts` — POST → run review

**Key steps:**
1. "Send for Review" button on cards in the Review column
2. `reviewRunner.ts`: prompt = `"Review this output critically: ${task.output}"` with Reviewer's system prompt
3. Stream review into `task.review` field, render in `ReviewPanel`
4. "Approve" button → move to Done; "Reject" button → move back to In Progress with reviewer comment prepended to description

**Verify:** Researcher produces output → Reviewer criticises it → you approve → card moves to Done with both outputs visible.

---

### Phase 5 — Agent Messaging Bus
**Goal:** Agents can post messages to a shared channel visible on the board.

**Files:**
- `db/schema.ts` — add `messages(id, agentId, content, createdAt)` table
- `components/MessageFeed.tsx` — scrollable feed of agent messages
- Updated `agentRunner.ts` — tool: `post_message(content: string)`

**Key steps:**
1. Add `post_message` as a Claude tool in the agent runner
2. Tool handler: write to `messages` table, broadcast via SSE to all connected clients
3. `MessageFeed` subscribes to messages SSE endpoint, renders messages with agent avatar
4. Agents can reference previous messages in their context (inject recent 10 messages into system prompt)

**Verify:** Two agents running concurrently; one posts "I need the API docs URL"; you can see it in the feed and respond.

---

## Estimated Effort

**2 Claude sessions.** Phases 1–3 (working kanban + running agents) in session 1 (~3 hours). Phases 4–5 (review workflow + messaging) in session 2 (~2 hours).

## Potential Blockers

- **Claude SDK concurrent streams**: each running agent holds an open HTTP connection; with 4+ concurrent agents you may hit rate limits; add a concurrency gate with `p-limit`
- **Cost management**: long-running agents can burn through tokens fast; add a per-task `maxTokens` cap and surface estimated cost on the UI before running
- **SSE and React strict mode**: double-mount in dev causes duplicate subscriptions; use `useEffect` cleanup to abort `EventSource` on unmount
- **Agent context window**: for the review step, the full task output goes into the Reviewer's context; large outputs may need truncation or summarisation before passing

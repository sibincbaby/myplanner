# Beyond the Chatbox — Agent UI Design Framework by Wavespace

**Source:** <https://aiagentstore.ai/ai-agent-news/this-week>
**Discovered:** 2026-09-21
**Viability:** 3/4

> Practical UX framework for building the kind of non-chatbot agent interfaces seen in openclaw-style projects — structured around showing agent state, source attribution, and approval flows. Directly applicable to custom agent UI projects and complements any MCP-backed agent shell.

## Viability Scores

| Criterion | Score |
|-----------|-------|
| Weekend-buildable | 1/1 |
| Fills a gap | 1/1 |
| Novel | 1/1 |
| Daily utility | 0/1 |
| **Total** | **3/4** |

The project is a design framework for AI agent interfaces featuring task-specific generative UI, visible reasoning, trust cues, and human approval checkpoints.

weekend_buildable: Score 1. An MVP component library or reference implementation — a working demo showing task-specific UI panels, a reasoning trace view, approval checkpoint flows, and trust indicators — is entirely achievable in 1-2 focused Claude Code sessions. The scope is bounded: it's a UI pattern library, not infrastructure. Score 0 if it required a full production-grade SDK with broad ecosystem integrations, but a demonstrable implementation of the core patterns is realistic in a sprint.

fills_gap: Score 1. The user builds multiple custom agent interfaces (openclaw, claw-desk, gravity-claw variants) and Claude/LLM tooling. Those projects almost certainly use basic chat-stream UX. The specific patterns here — generative task-specific UI, explicit reasoning visibility, trust cues, approval checkpoints — are a step above ad-hoc chat wrappers and would directly upgrade their existing agent UI work. Score 0 if they already had a systematic pattern library for these concerns, but the ad-hoc naming of their agent UI variants suggests they do not.

novel: Score 1. While Vercel AI SDK and LangChain have some UI utilities, no mature, well-maintained open-source framework comprehensively addresses this specific combination — task-specific generative UI (not just chat), explicit agent reasoning exposure, and staged human approval checkpoints together. The space is fragmented and early-stage. Score 0 if a polished, widely-adopted library already covered this, but none does.

daily_utility: Score 0. This is a development-time framework, not a runtime tool the user opens each day. It would be heavily used during agent UI projects but idle otherwise. Their work spans finance tools, dev productivity, Flutter apps, and integrations — only a subset of sessions would invoke this. Score 1 only if they were exclusively building agent UIs daily, which the breadth of their profile contradicts.

---

## Implementation Plan



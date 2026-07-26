# Mermaid diagrams

A diagram is a claim about how the system behaves. An ungrounded diagram is a
confidently-stated lie, which is worse than no diagram.

## Pick the right type

| Subject | Use |
|---|---|
| Request flow, call sequence, message passing | `sequenceDiagram` |
| Lifecycle, status transitions, state machine | `stateDiagram-v2` |
| Schemas, entities, relationships | `erDiagram` |
| Control flow, decision logic, pipelines | `flowchart` |

## Grounding rule

**Do not invent participants, states, entities, or relationships.** Every box, actor,
state, and edge must correspond to something you read in source. If you are unsure
whether an edge exists, leave it out and say so in prose.

Name nodes after real identifiers — real class, module, table, and endpoint names — so a
reader can grep for them.

## Where diagrams belong

Add one to any page documenting a runtime flow, call sequence, lifecycle, or data model.
Skip them on pure reference pages where a table communicates better.

One good diagram per page. Two is usually one too many.

## Keeping them true

On `update` runs, if a diagram's subject changed, **the diagram is stale and must be
revised**. A stale diagram is a stale claim. This is the single most common way a
generated wiki starts lying.

## Degraded fences

Upstream converts diagrams that fail to parse into plain `text` fences with an error
comment. If you find one:

1. Read the error comment.
2. Fix the syntax.
3. Restore the ```` ```mermaid ```` fence.

`scripts/validate.mjs` flags these.

## Syntax notes that bite

- Quote labels containing spaces, parentheses, or punctuation: `A["parse(input)"]`.
- In `sequenceDiagram`, declare participants before use for predictable ordering.
- Avoid `end` as a bare node id in flowcharts — it collides with block syntax.
- Keep node ids alphanumeric; put the human text in the label.

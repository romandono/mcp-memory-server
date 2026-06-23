---
name: sdd-memory-mcp
description: Store and retrieve Spec-Driven Development (SDD) project memory through the context-memory-mcp MCP server with minimal token cost. Use when an AI agent must persist or recall project context across sessions - creating projects, writing plan/design/tasks/general entries, recording design decisions and relationships, tracking tasks, or querying stored memory. Covers the optimal write model (sections, structured decisions, keyword-friendly content) and token-efficient retrieval (compact/summary views, TOON formats, item and char budgets, cursor pagination). Trigger when using any context-memory-mcp / mcp-memory tool, or when asked to save, remember, summarize, or look up project plans, designs, decisions, or tasks.
---

# SDD Memory MCP

## Overview

`context-memory-mcp` (CLI: `mcp-memory`) is a persistent local memory server. It stores
Spec-Driven Development context in SQLite and exposes it as MCP tools over STDIO. This skill
makes an agent store SDD context so it is **cheap to retrieve later**: write data the way the
server's derived-memory engine wants, then read it back in the smallest payload that answers the
question.

Two rules drive every decision:

1. **Write for retrieval.** Choose the right section, keep titles/content keyword-dense, and record
   decisions and relationships as structured records (not buried prose). The server auto-derives
   summaries, keywords, and facts from this on every write.
2. **Read the minimum.** Default to a compact view in TOON-dense format with explicit budgets.
   Escalate to full prose only when the task truly needs the raw body.

## Server Availability

Tools are exposed by an MCP server entry (e.g. `mcp-memory stdio` or
`npx -y @romandp/context-memory-mcp@latest stdio`). The MCP client may namespace tools under the
server name; the raw tool names are `project-create`, `entry-create`, etc. If MCP tools are not
present, the same operations exist as an HTTP REST API on `http://localhost:3001` (`mcp-memory start`).
Prefer the MCP tools when available.

## Mental Model

```
project
  └─ sdd_entry  (section: plan | design | tasks | general; status: draft | review | done)
        ├─ design_decision   (decision + rationale + alternatives)
        ├─ relationship       (depends_on | implements | related_to | supersedes) → other entry
        └─ task               (status: pending | in_progress | completed | cancelled; priority)
```

On every entry write the server **auto-derives** (no manual step):

- `summary_short` = `title :: first 140 chars of content`
- `summary_dense` = section + status + title + body preview + up to 5 decisions + relations + keywords
- `keywords` = top ~8 frequency tokens from title + content + decision text (stop words removed)
- `memory_facts` = subject/predicate/object triples of kind `section`, `status`, `decision`, `relationship`

Implication: **the title and the first sentence of content do most of the retrieval work.**
Front-load the meaningful technical terms. Detail that does not need to be keyword-searchable
belongs in decisions or child entries, not in a giant content blob.

## Write Workflow (optimized)

1. **Resolve the project id once, do not recreate it.** Before `project-create`, look for an existing
   project with `project-list` or `entry-search-global`. Reuse the returned `id` for the whole session.
   Creating duplicates fragments the memory.
2. **Pick the correct section** so later section-filtered reads work:
   - `plan` — scope, requirements, goals, milestones.
   - `design` — architecture, data model, interfaces, technical approach.
   - `tasks` — work breakdown, checklists (the work items themselves are `task` records).
   - `general` — notes, glossary, anything cross-cutting.
3. **Write keyword-dense entries.** Put key terms in the `title`; lead the `content` with the core
   statement. Keep content focused — only the first 140 chars feed `summary_short`.
4. **Record decisions as records, not prose.** Use `entry-add-decision` (decision + rationale +
   optional alternatives) for every architectural choice. Decisions become facts and feed keywords/
   summaries, so they stay compact and searchable.
5. **Link entries** with `entry-add-relationship`:
   - `implements` — a `tasks`/`design` entry implements a `plan`/`design` entry.
   - `depends_on` — ordering / prerequisite.
   - `related_to` — soft association.
   - `supersedes` — a new entry replaces an old one. **Prefer supersede + status over delete** to keep history.
6. **Create tasks linked to their entry.** `task-create` with `sdd_entry_id` pointing at the design/plan
   entry it implements; set `priority`. Advance lifecycle with `task-update`
   (`pending` → `in_progress` → `completed`/`cancelled`).
7. **Advance entry status** with `entry-update` (`draft` → `review` → `done`). Memory re-derives
   automatically on create/update/decision/relationship — no manual rebuild needed.
8. **Nest** with `parent_id` to group sub-entries under a parent (e.g. sub-designs under a design).

## Read Workflow (optimized)

Default read = **smallest payload that answers the question**. Escalate only as needed.

Pick the entry point by intent:

| Intent | Tool | Key args for low cost |
| --- | --- | --- |
| Project state / overview | `project-get` | `view: "summary"`, `format: "toon-d"`, `entry_limit`, `task_limit` |
| Find entries by text (one project) | `entry-search` | `view: "compact"`, `format: "toon-d"`, `max_items` |
| Find entries by text (all projects) | `entry-search-global` | `view: "compact"`, `format: "toon-d"`, `max_items` |
| Browse a project's entries | `entry-get` | `section`, `view: "compact"`, `format: "toon-d"`, `max_items`/`max_chars` |
| One entry + decisions + relationships + facts | `entry-get-context` | `view: "compact"`, `format: "toon-d"` |
| Known entry ids | `entry-batch-get` | `entry_ids`, `format: "toon-d"`, `max_items` |
| One entry's compact summary | `entry-get-summary` | `format: "toon-d"` |
| Quick triples about a project/entry | `memory-facts-get` | `kind` filter, `max_items` |
| Full prose body of an entry | `entry-get` / `entry-get-context` | `view: "full"` (only when prose is required) |

Cost knobs (apply to read tools that support them):

- **`view`**: `full` returns raw prose (`content`) and is the biggest. `summary` and `compact` are
  equivalent — both return the derived compact form (`summary_short`, keywords) and **omit the full
  `content`**. Use a non-full view unless you need the body.
- **`format`**: payload size `json` > `toon-r` > `toon-d`. Use `toon-d` for machine reads, `toon-r`
  if you need readable keys, `json` only when you need `summary_dense` (TOON drops it) or `metrics`.
- **`max_items`** / **`max_chars`**: hard budgets. The response sets `truncated`/`m.tr` and returns a
  `next_cursor`/`m.next` to continue.
- **`cursor`**: pass the previous `next_cursor` to page forward without re-reading. Honored by
  `entry-get`, `entry-search`, `entry-search-global`, `entry-batch-get`, `memory-facts-get`.
- Compact **JSON** responses include `metrics.estimated_tokens` — use it to verify a budget.

Caveat: `cursor` (all tools) and `max_items`/`max_chars` (on `memory-facts-get`) are honored
server-side but are not in those tools' advertised input schema. A strict MCP client may drop
unlisted args; if paging via `cursor` has no effect, fall back to `page`/`limit`.

**Reading TOON responses requires the decode key** (enums and field names are abbreviated). Load
`references/toon-format.md` before parsing any `toon-r`/`toon-d` payload.

## Tool Quick Reference

Write: `project-create`, `entry-create`, `entry-update`, `entry-delete`, `entry-add-decision`,
`entry-add-relationship`, `task-create`, `task-update`.
Read: `project-list`, `project-get`, `entry-get`, `entry-search`, `entry-search-global`,
`entry-get-summary`, `entry-batch-get`, `entry-get-context`, `memory-facts-get`, `audit-get`.

Full parameters, defaults, required fields, and return shapes: `references/tools.md`.

## Recipes

**Seed a new project (SDD bootstrap)**
1. `project-create` → keep `id`.
2. `entry-create` section `plan` (scope/requirements).
3. `entry-create` section `design` (architecture); add `entry-add-decision` for each key choice.
4. `entry-add-relationship` design `implements` plan.
5. `task-create` per work item with `sdd_entry_id` = design entry id.

**Resume a project next session (cheap context load)**
1. `entry-search-global` `query` + `view: "compact"` `format: "toon-d"` to find the project/entries.
2. `project-get` `view: "summary"` `format: "toon-d"` `entry_limit` `task_limit` for the state snapshot.
3. `entry-get-context` `view: "compact"` `format: "toon-d"` only on the entry you will work on.

**Record an architectural change without losing history**
1. `entry-create` the new design entry.
2. `entry-add-relationship` new `supersedes` old.
3. `entry-update` old entry `status: "done"` (or leave for history). Do not delete.

## Anti-patterns

- Recreating the project each session → duplicate ids and split memory. Search first.
- Dumping large blobs into `content` → only 140 chars feed the summary; push detail into decisions
  or child entries.
- Browsing with `view: "full"` + `format: "json"` → maximum tokens for data a compact view answers.
- Burying decisions in prose → not retrievable as facts; use `entry-add-decision`.
- Deleting superseded entries → lost history; use `supersedes` + status instead.
- Ignoring `section` → section-filtered search and `summary_dense` lose their value.

## References

- `references/tools.md` — every tool: parameters, defaults, required fields, return shapes, enums.
- `references/toon-format.md` — decode key for `toon-r`/`toon-d` envelopes, enum abbreviations, and
  budget/cursor/metrics semantics. Read this before parsing any TOON response.

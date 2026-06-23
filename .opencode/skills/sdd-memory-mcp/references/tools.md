# Tool Reference

Full parameter, default, and return-shape reference for every `context-memory-mcp` MCP tool.
Enums are listed verbatim. For how the abbreviated TOON output decodes, see `toon-format.md`.

## Contents

- [Conventions](#conventions)
- [Projects](#projects): `project-create`, `project-list`, `project-get`
- [Entries (write)](#entries-write): `entry-create`, `entry-update`, `entry-delete`
- [Entries (read)](#entries-read): `entry-get`, `entry-search`, `entry-search-global`, `entry-get-summary`, `entry-batch-get`
- [Context](#context): `entry-add-decision`, `entry-add-relationship`, `entry-get-context`, `memory-facts-get`
- [Tasks](#tasks): `task-create`, `task-list`, `task-update`
- [Audit](#audit): `audit-get`
- [Shared enums](#shared-enums)

## Conventions

- **Required** args must be present; **optional** args may be omitted.
- Pagination: `page` (1-based), `limit` (max 200). When passed, JSON responses add a `pagination`
  object `{ page, limit, total, totalPages }`.
- Read tools that accept `view`/`format`/budgets follow the cost rules in `SKILL.md` and decode per
  `toon-format.md`.
- All ids are UUID strings.
- `cursor` (all read tools) and `max_items`/`max_chars` (on `memory-facts-get`) are honored
  server-side but omitted from those tools' advertised schema; a strict client may strip them. Fall
  back to `page`/`limit` if cursor paging has no effect.

## Projects

### project-create
Create a project. Returns its id.
- `name` (string, **required**)
- `description` (string, optional)
- Returns: `{ success: true, id, message }`

### project-list
List projects.
- `page` (number, optional), `limit` (number, optional, max 200)
- Returns: `{ success: true, projects: Project[], pagination? }`

### project-get
Get a project with its entries and tasks. The view controls payload shape and size.
- `id` (string, **required**)
- `view` (`full` | `summary` | `compact`, optional; default `full`)
- `format` (`json` | `toon-r` | `toon-d`, optional; default `json`) — applies only to non-full views
- `entry_limit` (number, optional) — cap compact entries
- `task_limit` (number, optional) — cap compact tasks
- Returns:
  - `view: full` → `{ success, project, entries: SddEntry[] (with content), tasks: Task[], classifications[] }`
  - `view: summary|compact`, `format: json` → `{ success, project, entries: CompactEntry[], tasks: CompactTask[], classifications[] }`
  - `format: toon-*` → TOON `project_compact` envelope (see toon-format.md)

## Entries (write)

### entry-create
Create an SDD entry under a project. Triggers memory derivation.
- `project_id` (string, **required**)
- `section` (`plan` | `design` | `tasks` | `general`, **required**)
- `title` (string, **required**)
- `content` (string, optional; default `""`)
- `status` (`draft` | `review` | `done`, optional; default `draft`)
- `parent_id` (string, optional) — nest under a parent entry
- Returns: `{ success: true, id, message }`

### entry-update
Update fields on an entry. Re-derives memory. Only provided fields change.
- `id` (string, **required**)
- `title` (string, optional)
- `content` (string, optional)
- `status` (`draft` | `review` | `done`, optional)
- `section` (`plan` | `design` | `tasks` | `general`, optional)
- `parent_id` (string | null, optional) — pass null/empty to clear
- Returns: `{ success: true, entry: SddEntry, message }` or `{ success: false, message }` if not found

### entry-delete
Delete an entry. Prefer `supersedes` + status over deleting to keep history.
- `id` (string, **required**)
- Returns: `{ success, message }`

## Entries (read)

### entry-get
Get entries for a project, optionally section-filtered.
- `project_id` (string, **required**)
- `section` (enum, optional) — filter
- `page`, `limit` (optional)
- `view` (`full` | `summary` | `compact`, optional; default `full`)
- `format` (`json` | `toon-r` | `toon-d`, optional)
- `max_items` (number, optional, max 200), `max_chars` (number, optional)
- `cursor` (string, optional) — continue from a prior `next_cursor`
- Returns:
  - `view: full` → `{ success, count, entries: SddEntry[] (with content), pagination? }`
  - non-full `json` → `{ success, count, entries: CompactEntry[], truncated, next_cursor, metrics }`
  - non-full `toon-*` → TOON `entry_search` envelope

### entry-search
Full-text search within one project.
- `project_id` (string, **required**), `query` (string, **required**)
- `page`, `limit`, `view`, `format`, `max_items`, `max_chars`, `cursor` (optional, as `entry-get`)
- Returns: `{ success, count, results: [...], truncated, next_cursor, metrics?, pagination? }` or TOON `entry_search`

### entry-search-global
Full-text search across all projects.
- `query` (string, **required**)
- `page`, `limit`, `view`, `format`, `max_items`, `max_chars`, `cursor` (optional)
- Returns: same shape as `entry-search`

### entry-get-summary
Get the derived compact summary for a single entry.
- `entry_id` (string, **required**)
- `format` (`json` | `toon-r` | `toon-d`, optional)
- Returns: `json` → `{ success, entry: CompactEntry }`; `toon-*` → TOON `entry_summary` envelope

### entry-batch-get
Get many compact entries by id in one call (best for known ids).
- `entry_ids` (string[], **required**, 1..200)
- `format` (optional), `max_items` (optional), `max_chars` (optional), `cursor` (optional)
- Returns: `json` → `{ success, count, entries: CompactEntry[], truncated, next_cursor, metrics }`; `toon-*` → TOON `entry_search`

## Context

### entry-add-decision
Record a design decision on an entry. Becomes a `decision` fact; re-derives memory.
- `entry_id` (string, **required**)
- `decision` (string, **required**)
- `rationale` (string, **required**)
- `alternatives_considered` (string, optional)
- Returns: `{ success: true, id, message }`

### entry-add-relationship
Link two entries. Becomes a `relationship` fact; re-derives both entries.
- `source_entry_id` (string, **required**)
- `target_entry_id` (string, **required**)
- `relationship_type` (`depends_on` | `implements` | `related_to` | `supersedes`, **required**)
- Returns: `{ success: true, id, message }`

### entry-get-context
Get an entry plus its decisions, relationships, and (compact view) derived facts.
- `entry_id` (string, **required**)
- `view` (`full` | `summary` | `compact`, optional; default `full`)
- `format` (`json` | `toon-r` | `toon-d`, optional)
- Returns:
  - `view: full` → `{ success, context: { entry: SddEntry, decisions[], relationships[] } }`
  - non-full `json` → `{ success, context: { entry: CompactEntry, decisions[], relationships[], facts[] }, metrics }`
  - non-full `toon-*` → TOON `entry_ctx` envelope (includes facts)

### memory-facts-get
List derived memory facts (subject/predicate/object triples).
- `project_id` (string, optional), `entry_id` (string, optional)
- `kind` (string, optional) — one of `section`, `status`, `decision`, `relationship`
- `page`, `limit` (optional), `format` (optional), `max_items`, `max_chars`, `cursor` (optional)
- Returns: `json` → `{ success, count, facts: MemoryFact[], truncated, next_cursor, metrics, pagination? }`; `toon-*` → TOON `facts`

## Tasks

### task-create
Create a task, optionally linked to an entry. Status starts at `pending`.
- `project_id` (string, **required**)
- `title` (string, **required**)
- `sdd_entry_id` (string, optional) — link to the entry it implements
- `description` (string, optional)
- `priority` (`low` | `medium` | `high` | `critical`, optional; default `medium`)
- Returns: `{ success: true, id, message }`

### task-list
List tasks for a project (full shape; no compact view).
- `project_id` (string, **required**)
- `sdd_entry_id` (string, optional) — filter by entry
- `page`, `limit` (optional)
- Returns: `{ success, count, tasks: Task[], pagination? }`

### task-update
Advance a task's status.
- `id` (string, **required**)
- `status` (`pending` | `in_progress` | `completed` | `cancelled`, **required**)
- Returns: `{ success, message }`

## Audit

### audit-get
Read the audit log for an entity or project.
- `entity_type` (`entry` | `task`, optional)
- `entity_id` (string, optional)
- `project_id` (string, optional)
- `page`, `limit` (optional)
- Returns: `{ success, ... audit entries }`

## Shared enums

- Section: `plan`, `design`, `tasks`, `general`
- Entry status: `draft`, `review`, `done`
- Task status: `pending`, `in_progress`, `completed`, `cancelled`
- Task priority: `low`, `medium`, `high`, `critical`
- Relationship type: `depends_on`, `implements`, `related_to`, `supersedes`
- Fact kind: `section`, `status`, `decision`, `relationship`
- Response view: `full`, `summary`, `compact` (summary and compact are equivalent)
- Response format: `json`, `toon-r`, `toon-d`

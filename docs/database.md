# Database

## Core Schema

```text
projects
  id, name, description, status

sdd_entries
  id, project_id, section, title, content, status, parent_id, metadata

tasks
  id, project_id, sdd_entry_id, title, description, status, priority

design_decisions
  id, entry_id, decision, rationale, alternatives_considered

entry_relationships
  id, source_entry_id, target_entry_id, relationship_type

classifications
  classifiable_type, classifiable_id, tag, confidence

audit_log
  entity_type, entity_id, action, changes, project_id, timestamp
```

## Derived Memory Tables

- `entry_summaries`
- `memory_facts`
- `fts_entry_summaries`
- `fts_entries`

## Migrations

- `001_initial_schema`
- `002_add_fts5`
- `003_add_audit_log`
- `004_add_context_tables`
- `005_add_compact_memory`
- `006_add_compact_memory_fts`

Migrations are applied automatically on startup and tracked in `_migrations`.

## Notes

- SQLite runs in WAL mode
- Some legacy databases may still contain `file_changes`, but it is not part of the active public model

# API Reference

## HTTP API

Base URL:

```text
http://localhost:3001
```

Swagger UI:

```text
http://localhost:3001/api-docs
```

List endpoints support pagination with `page` and `limit`.

### Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id
```

### Entries

```text
GET    /api/projects/:pid/entries
POST   /api/projects/:pid/entries
GET    /api/projects/:pid/entries/search?q=...
GET    /api/projects/:pid/entries/:eid
PUT    /api/projects/:pid/entries/:eid
DELETE /api/projects/:pid/entries/:eid
```

### Global Search

```text
GET    /api/entries/search?q=...
```

### Context and Compact Views

```text
GET    /api/entries/:eid/context
GET    /api/entries/:eid/summary
GET    /api/entries/:eid/compact
GET    /api/entries/batch?ids=e1,e2
POST   /api/entries/:eid/decisions
POST   /api/entries/:eid/relationships
GET    /api/facts
```

Supported compact-response parameters:

- `view=full|summary|compact`
- `format=json|toon-r|toon-d`
- `max_items=<n>`
- `max_chars=<n>`
- `cursor=<last_id>`

### Tasks

```text
GET    /api/projects/:pid/tasks
POST   /api/projects/:pid/tasks
PUT    /api/projects/:pid/tasks/:tid
DELETE /api/projects/:pid/tasks/:tid
```

### Audit and Utilities

```text
GET    /api/audit
POST   /api/classify
GET    /api/db/download
GET    /health
```

## MCP Tools

- `project-create`
- `project-list`
- `project-get`
- `entry-create`
- `entry-get`
- `entry-search`
- `entry-search-global`
- `entry-update`
- `entry-delete`
- `entry-add-decision`
- `entry-add-relationship`
- `entry-batch-get`
- `entry-get-context`
- `entry-get-summary`
- `task-create`
- `task-list`
- `task-update`
- `memory-facts-get`
- `audit-get`

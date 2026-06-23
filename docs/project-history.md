# Project History

## Summary

- SDD-oriented memory model implemented
- Full CRUD for projects, entries, and tasks
- HTTP API and MCP tools available
- Compact memory and TOON responses added
- CLI packaging and npm release flow added
- Test suite passing

## Main Milestones

### SDD Memory Refactor

- replaced older schema with project, entry, task, and classification model
- added supporting context and relationship tables

### Test Coverage

- Vitest coverage for database, tools, and HTTP routes

### CLI Distribution

- installable `mcp-memory` command
- per-user runtime storage
- database migration and rebuild commands

### Compact Memory

- derived summaries and facts
- compact views
- TOON formats
- compact FTS search

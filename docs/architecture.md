# Architecture

## Runtime Overview

```text
MCP client (STDIO)
        |
        v
  MCP server layer
        |
        +---- HTTP REST server (Express)
        |
        v
   SQLite database
```

## Main Components

- `src/index.ts`: process bootstrap, tool dispatch, HTTP startup
- `src/server/setup.ts`: MCP server and tool definitions
- `src/http/routes.ts`: REST routes
- `src/db/schema.ts`: data access and queries
- `src/memory/*`: summaries, facts, TOON formatting, compact responses
- `bin/mcp-memory.js`: CLI wrapper and process management

## Retrieval Model

The server stores canonical project data in SQLite and derives compact memory artifacts for LLM-friendly access:

- entry summaries
- dense summaries
- memory facts
- FTS indexes for compact search

Compact retrieval supports:

- reduced payloads
- response budgets
- cursor pagination
- JSON or TOON output

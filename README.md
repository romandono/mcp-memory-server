# Context Memory MCP

Persistent local memory server for AI assistants over the Model Context Protocol (MCP).

It stores project context in SQLite and exposes:

- MCP over STDIO
- HTTP REST API
- CLI for start/stop/status and maintenance

## What It Stores

- Projects
- Structured entries (`plan`, `design`, `tasks`, `general`)
- Tasks
- Design decisions and relationships
- Derived summaries and compact memory facts for LLM-friendly retrieval

## Install

Requirements:

- Node.js 18+
- npm 9+

Install globally:

```bash
npm install -g @romandp/context-memory-mcp
```

Or run without installing globally:

```bash
npx -y @romandp/context-memory-mcp@latest stdio
```

## Quick Start

Start server in background:

```bash
mcp-memory start
```

Check status:

```bash
mcp-memory status
```

Show resolved paths:

```bash
mcp-memory paths
```

Run MCP server in foreground:

```bash
mcp-memory stdio
```

## CLI

```bash
mcp-memory start
mcp-memory stop
mcp-memory status
mcp-memory restart
mcp-memory logs
mcp-memory info
mcp-memory paths
mcp-memory version
mcp-memory rebuild-memory
mcp-memory migrate-db --from /path/to/old/memory.db
```

## HTTP API

Default base URL:

```text
http://localhost:3001
```

Swagger UI:

```text
http://localhost:3001/api-docs
```

Typical endpoints:

- `/health`
- `/api/projects`
- `/api/projects/:id`
- `/api/projects/:pid/entries`
- `/api/projects/:pid/tasks`
- `/api/entries/:eid/context`
- `/api/entries/:eid/summary`
- `/api/entries/batch`
- `/api/facts`

For full endpoint and MCP tool reference, see `docs/api.md`.

## MCP Client Setup

Example `opencode` config:

```json
{
  "mcp": {
    "context-memory-mcp": {
      "type": "local",
      "command": ["mcp-memory", "stdio"],
      "enabled": true,
      "env": {}
    }
  }
}
```

Without global install:

```json
{
  "mcp": {
    "context-memory-mcp": {
      "type": "local",
      "command": ["npx", "-y", "@romandp/context-memory-mcp@latest", "stdio"],
      "enabled": true,
      "env": {}
    }
  }
}
```

## Configuration

Supported environment variables:

```env
HTTP_PORT=3001
DB_PATH=/path/to/memory.db
MCP_MEMORY_HOME=/path/to/home
LOG_PATH=/path/to/server.log
PID_PATH=/path/to/server.pid
```

Default storage locations:

- Linux: `~/.local/share/mcp-memory/memory.db` and `~/.local/state/mcp-memory/`
- macOS: `~/Library/Application Support/mcp-memory/`
- Windows: `%LOCALAPPDATA%\mcp-memory\`

## Development

```bash
npm install
npm run build
npm test
```

## Documentation

- `docs/api.md`: HTTP endpoints and MCP tools
- `docs/architecture.md`: runtime architecture and data flow
- `docs/database.md`: schema and migrations
- `docs/release.md`: install, packaging, and release process
- `docs/project-history.md`: project history and milestones

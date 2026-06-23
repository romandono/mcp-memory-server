# Release and Installation

## Package

Published package:

```text
@romandp/context-memory-mcp
```

## Install

```bash
npm install -g @romandp/context-memory-mcp
```

```bash
npx -y @romandp/context-memory-mcp@latest stdio
```

## Runtime Paths

Defaults:

- Linux: `~/.local/share/mcp-memory/memory.db` and `~/.local/state/mcp-memory/`
- macOS: `~/Library/Application Support/mcp-memory/`
- Windows: `%LOCALAPPDATA%\mcp-memory\`

## Maintenance Commands

```bash
mcp-memory version
mcp-memory paths
mcp-memory status
mcp-memory rebuild-memory
mcp-memory migrate-db --from /path/to/old/memory.db
```

## Release Flow

- Tagging `v*` triggers `.github/workflows/release.yml`
- Workflow installs dependencies, runs tests, builds, packs, publishes to npm, and creates a GitHub Release
- Current workflow uses `NPM_TOKEN` for npm publish

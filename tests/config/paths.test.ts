import { describe, expect, it } from 'vitest';
import { getAppPaths } from '../../src/config/paths.js';

describe('getAppPaths', () => {
  it('uses XDG directories on linux by default', () => {
    const paths = getAppPaths({ HOME: '/home/test' }, 'linux');
    expect(paths.appHome).toBe('/home/test/.local/share/mcp-memory');
    expect(paths.stateDir).toBe('/home/test/.local/state/mcp-memory');
    expect(paths.dbPath).toBe('/home/test/.local/share/mcp-memory/memory.db');
    expect(paths.logPath).toBe('/home/test/.local/state/mcp-memory/server.log');
    expect(paths.pidPath).toBe('/home/test/.local/state/mcp-memory/server.pid');
  });

  it('keeps all data under MCP_MEMORY_HOME override', () => {
    const paths = getAppPaths({ MCP_MEMORY_HOME: '/tmp/mcp-memory-home' }, 'linux');
    expect(paths.appHome).toBe('/tmp/mcp-memory-home');
    expect(paths.dataDir).toBe('/tmp/mcp-memory-home/data');
    expect(paths.stateDir).toBe('/tmp/mcp-memory-home/state');
    expect(paths.dbPath).toBe('/tmp/mcp-memory-home/data/memory.db');
  });
});

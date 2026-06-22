import os from 'os';
import path from 'path';

const APP_NAME = 'mcp-memory';

export interface AppPaths {
  appHome: string;
  dataDir: string;
  stateDir: string;
  dbPath: string;
  logPath: string;
  pidPath: string;
}

function resolveAppHome(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  const homeDir = env.HOME || os.homedir();
  if (env.MCP_MEMORY_HOME) return path.resolve(env.MCP_MEMORY_HOME);

  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local');
    return path.join(localAppData, APP_NAME);
  }

  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', APP_NAME);
  }

  const dataHome = env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share');
  return path.join(dataHome, APP_NAME);
}

function resolveStateDir(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, appHome: string): string {
  const homeDir = env.HOME || os.homedir();
  if (env.MCP_MEMORY_HOME) return path.join(appHome, 'state');

  if (platform === 'win32' || platform === 'darwin') {
    return path.join(appHome, 'state');
  }

  const stateHome = env.XDG_STATE_HOME || path.join(homeDir, '.local', 'state');
  return path.join(stateHome, APP_NAME);
}

export function getAppPaths(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): AppPaths {
  const appHome = resolveAppHome(env, platform);
  const dataDir = env.MCP_MEMORY_HOME ? path.join(appHome, 'data') : appHome;
  const stateDir = resolveStateDir(env, platform, appHome);

  return {
    appHome,
    dataDir,
    stateDir,
    dbPath: path.resolve(env.DB_PATH || path.join(dataDir, 'memory.db')),
    logPath: path.resolve(env.LOG_PATH || path.join(stateDir, 'server.log')),
    pidPath: path.resolve(env.PID_PATH || path.join(stateDir, 'server.pid')),
  };
}

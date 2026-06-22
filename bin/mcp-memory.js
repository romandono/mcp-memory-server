#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, createWriteStream, mkdirSync, copyFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST_ENTRY = resolve(ROOT, 'dist/index.js');
const PKG = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

function getAppPaths(env = process.env, platform = process.platform) {
  const appName = 'mcp-memory';

  function resolveAppHome() {
    if (env.MCP_MEMORY_HOME) return resolve(env.MCP_MEMORY_HOME);

    if (platform === 'win32') {
      const localAppData = env.LOCALAPPDATA || resolve(os.homedir(), 'AppData', 'Local');
      return resolve(localAppData, appName);
    }

    if (platform === 'darwin') {
      return resolve(os.homedir(), 'Library', 'Application Support', appName);
    }

    const dataHome = env.XDG_DATA_HOME || resolve(os.homedir(), '.local', 'share');
    return resolve(dataHome, appName);
  }

  function resolveStateDir(appHome) {
    if (env.MCP_MEMORY_HOME) return resolve(appHome, 'state');
    if (platform === 'win32' || platform === 'darwin') return resolve(appHome, 'state');
    const stateHome = env.XDG_STATE_HOME || resolve(os.homedir(), '.local', 'state');
    return resolve(stateHome, appName);
  }

  const appHome = resolveAppHome();
  const dataDir = env.MCP_MEMORY_HOME ? resolve(appHome, 'data') : appHome;
  const stateDir = resolveStateDir(appHome);

  return {
    appHome,
    dataDir,
    stateDir,
    dbPath: resolve(env.DB_PATH || resolve(dataDir, 'memory.db')),
    logPath: resolve(env.LOG_PATH || resolve(stateDir, 'server.log')),
    pidPath: resolve(env.PID_PATH || resolve(stateDir, 'server.pid')),
  };
}

const PATHS = getAppPaths();

function ensureParentDirs() {
  mkdirSync(dirname(PATHS.dbPath), { recursive: true });
  mkdirSync(dirname(PATHS.logPath), { recursive: true });
  mkdirSync(dirname(PATHS.pidPath), { recursive: true });
}

function ensureDistExists() {
  if (!existsSync(DIST_ENTRY)) {
    console.error('[mcp-memory] Compiled server not found. Reinstall package or run npm run build in development checkout.');
    process.exit(1);
  }
}

function readPid() {
  if (!existsSync(PATHS.pidPath)) return null;
  const pid = parseInt(readFileSync(PATHS.pidPath, 'utf-8').trim(), 10);
  return isNaN(pid) ? null : pid;
}

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getStatus() {
  const pid = readPid();
  const running = pid && isRunning(pid);
  return { pid, running };
}

function spawnServer(detached, stdio, extraEnv = {}) {
  ensureParentDirs();
  ensureDistExists();

  return spawn(process.execPath, [DIST_ENTRY], {
    cwd: ROOT,
    detached,
    stdio,
    env: {
      ...process.env,
      DB_PATH: PATHS.dbPath,
      LOG_PATH: PATHS.logPath,
      PID_PATH: PATHS.pidPath,
      ...extraEnv,
    },
  });
}

async function cmdStart() {
  const { running, pid } = getStatus();
  if (running) {
    console.log(`[mcp-memory] Server already running (PID ${pid})`);
    return;
  }

  console.log('[mcp-memory] Starting server...');
  const child = spawnServer(true, ['ignore', 'pipe', 'pipe']);

  const outStream = createWriteStream(PATHS.logPath, { flags: 'a' });
  child.stdout.pipe(outStream);
  child.stderr.pipe(outStream);
  child.unref();

  const serverPid = child.pid;
  writeFileSync(PATHS.pidPath, String(serverPid));

  await new Promise(r => setTimeout(r, 1500));

  if (isRunning(serverPid)) {
    console.log(`[mcp-memory] Server started (PID ${serverPid})`);
    console.log(`[mcp-memory]   HTTP:     http://localhost:${process.env.HTTP_PORT || 3001}`);
    console.log(`[mcp-memory]   MCP:      stdio`);
    console.log(`[mcp-memory]   DB:       ${PATHS.dbPath}`);
    console.log(`[mcp-memory]   Logs:     ${PATHS.logPath}`);
    console.log(`[mcp-memory]   PID file: ${PATHS.pidPath}`);
  } else {
    console.error('[mcp-memory] Server failed to start. Check logs:');
    console.error(`  ${PATHS.logPath}`);
  }
}

function cmdStop() {
  const { running, pid } = getStatus();
  if (!running) {
    console.log('[mcp-memory] Server not running');
    return;
  }

  console.log(`[mcp-memory] Stopping server (PID ${pid})...`);
  try {
    process.kill(pid, 'SIGTERM');
    setTimeout(() => {
      if (isRunning(pid)) process.kill(pid, 'SIGKILL');
    }, 3000);
  } catch (e) {
    console.error(`[mcp-memory] Error: ${e.message}`);
  }

  try { unlinkSync(PATHS.pidPath); } catch {}
  console.log('[mcp-memory] Server stopped');
}

function cmdStatus() {
  const { running, pid } = getStatus();
  if (running) {
    console.log(`[mcp-memory] Server is RUNNING (PID ${pid})`);
    console.log(`  HTTP: http://localhost:${process.env.HTTP_PORT || 3001}`);
    console.log(`  DB:   ${PATHS.dbPath}`);
    console.log(`  Log:  ${PATHS.logPath}`);

    const healthUrl = `http://localhost:${process.env.HTTP_PORT || 3001}/health`;
    try {
      const req = http.get(healthUrl, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
          try {
            const j = JSON.parse(data);
            console.log(`  Health: ${j.status} (${j.timestamp})`);
          } catch {
            console.log('  Health: unreachable');
          }
        });
      });
      req.on('error', () => console.log('  Health: unreachable'));
      req.setTimeout(2000, () => { req.destroy(); });
    } catch {}
  } else {
    console.log('[mcp-memory] Server is STOPPED');
  }
}

function cmdRestart() {
  cmdStop();
  setTimeout(() => cmdStart(), 1000);
}

function cmdLogs() {
  if (!existsSync(PATHS.logPath)) {
    console.log('[mcp-memory] No logs yet');
    return;
  }
  const tail = spawn('tail', ['-f', PATHS.logPath], { stdio: 'inherit' });
  process.on('SIGINT', () => { tail.kill(); process.exit(0); });
}

function cmdStdio() {
  console.error('[mcp-memory] Starting MCP stdio server...');
  const child = spawnServer(false, ['inherit', 'inherit', 'inherit']);
  child.on('exit', (code) => process.exit(code ?? 0));
}

function cmdInfo() {
  console.log(`Project:    ${PKG.name} v${PKG.version}`);
  console.log(`Install:    ${ROOT}`);
  console.log(`DB:         ${PATHS.dbPath}`);
  console.log(`Log:        ${PATHS.logPath}`);
  console.log(`PID File:   ${PATHS.pidPath}`);
  console.log(`HTTP Port:  ${process.env.HTTP_PORT || 3001}`);
  console.log('');
  console.log('Commands:');
  console.log('  mcp-memory start                 Start server in background');
  console.log('  mcp-memory stop                  Stop server');
  console.log('  mcp-memory status                Check server status');
  console.log('  mcp-memory restart               Restart server');
  console.log('  mcp-memory logs                  Tail server logs');
  console.log('  mcp-memory stdio                 Run MCP server in foreground');
  console.log('  mcp-memory paths                 Show resolved storage paths');
  console.log('  mcp-memory version               Show package version');
  console.log('  mcp-memory rebuild-memory        Rebuild derived summaries and facts');
  console.log('  mcp-memory migrate-db --from X   Copy legacy database to default location');
}

function cmdPaths() {
  console.log(`Home: ${PATHS.appHome}`);
  console.log(`Data: ${PATHS.dataDir}`);
  console.log(`State: ${PATHS.stateDir}`);
  console.log(`DB: ${PATHS.dbPath}`);
  console.log(`Log: ${PATHS.logPath}`);
  console.log(`PID: ${PATHS.pidPath}`);
}

function cmdVersion() {
  console.log(PKG.version);
}

function cmdRebuildMemory() {
  ensureParentDirs();
  ensureDistExists();

  const child = spawn(process.execPath, [DIST_ENTRY, '--rebuild-memory'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DB_PATH: PATHS.dbPath,
      LOG_PATH: PATHS.logPath,
      PID_PATH: PATHS.pidPath,
    },
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

function cmdMigrateDb() {
  const fromFlag = process.argv.indexOf('--from');
  if (fromFlag === -1 || !process.argv[fromFlag + 1]) {
    console.error('Usage: mcp-memory migrate-db --from /path/to/memory.db');
    process.exit(1);
  }

  const sourcePath = resolve(process.argv[fromFlag + 1]);
  if (!existsSync(sourcePath)) {
    console.error(`[mcp-memory] Source database not found: ${sourcePath}`);
    process.exit(1);
  }

  ensureParentDirs();
  if (existsSync(PATHS.dbPath)) {
    console.error(`[mcp-memory] Destination database already exists: ${PATHS.dbPath}`);
    console.error('[mcp-memory] Move or override DB_PATH if you want another target.');
    process.exit(1);
  }

  copyFileSync(sourcePath, PATHS.dbPath);
  console.log(`[mcp-memory] Database copied to ${PATHS.dbPath}`);
}

const cmd = process.argv[2] || 'status';

switch (cmd) {
  case 'start': cmdStart(); break;
  case 'stop': cmdStop(); break;
  case 'status': cmdStatus(); break;
  case 'restart': cmdRestart(); break;
  case 'logs': cmdLogs(); break;
  case 'info': cmdInfo(); break;
  case 'stdio': cmdStdio(); break;
  case 'paths': cmdPaths(); break;
  case 'version': cmdVersion(); break;
  case 'rebuild-memory': cmdRebuildMemory(); break;
  case 'migrate-db': cmdMigrateDb(); break;
  default:
    console.log(`Unknown command: ${cmd}`);
    console.log('Usage: mcp-memory <start|stop|status|restart|logs|info|stdio|paths|version|rebuild-memory|migrate-db>');
    process.exit(1);
}

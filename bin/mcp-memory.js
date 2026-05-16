#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, createWriteStream } from 'fs';
import { spawn, execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PKG = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
const PID_FILE = resolve(ROOT, '.server.pid');
const LOG_FILE = resolve(ROOT, 'server.log');

function readPid() {
  if (!existsSync(PID_FILE)) return null;
  const pid = parseInt(readFileSync(PID_FILE, 'utf-8').trim(), 10);
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

async function cmdStart() {
  const { running, pid } = getStatus();
  if (running) {
    console.log(`[mcp-memory] Server already running (PID ${pid})`);
    return;
  }

  console.log(`[mcp-memory] Building...`);
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.error('[mcp-memory] Build failed');
    process.exit(1);
  }

  console.log(`[mcp-memory] Starting server...`);
  const child = spawn('node', ['dist/index.js'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  const outStream = createWriteStream(LOG_FILE, { flags: 'a' });
  child.stdout.pipe(outStream);
  child.stderr.pipe(outStream);

  child.unref();

  const serverPid = child.pid;
  writeFileSync(PID_FILE, String(serverPid));

  await new Promise(r => setTimeout(r, 1500));

  if (isRunning(serverPid)) {
    console.log(`[mcp-memory] Server started (PID ${serverPid})`);
    console.log(`[mcp-memory]   HTTP:     http://localhost:${process.env.HTTP_PORT || 3001}`);
    console.log(`[mcp-memory]   MCP:      stdio`);
    console.log(`[mcp-memory]   Logs:     ${LOG_FILE}`);
    console.log(`[mcp-memory]   DB:       data/memory.db`);
    console.log(`[mcp-memory]   Status:   mcp-memory status`);
    console.log(`[mcp-memory]   Stop:     mcp-memory stop`);
  } else {
    console.error('[mcp-memory] Server failed to start. Check logs:');
    console.error(`  tail -50 ${LOG_FILE}`);
  }
}

function cmdStop() {
  const { running, pid } = getStatus();
  if (!running) {
    console.log('[mcp-memory] Server not running');
    if (pid) execSync(`rm -f ${PID_FILE}`);
    return;
  }

  console.log(`[mcp-memory] Stopping server (PID ${pid})...`);
  try {
    process.kill(pid, 'SIGTERM');
    setTimeout(() => {
      if (isRunning(pid)) {
        process.kill(pid, 'SIGKILL');
      }
    }, 3000);
  } catch (e) {
    console.error(`[mcp-memory] Error: ${e.message}`);
  }
  execSync(`rm -f ${PID_FILE}`);
  console.log('[mcp-memory] Server stopped');
}

function cmdStatus() {
  const { running, pid } = getStatus();
  if (running) {
    console.log(`[mcp-memory] Server is RUNNING (PID ${pid})`);
    console.log(`  HTTP: http://localhost:${process.env.HTTP_PORT || 3001}`);
    console.log(`  DB:   data/memory.db`);

    const healthUrl = `http://localhost:${process.env.HTTP_PORT || 3001}/health`;
    try {
      const req = http.get(healthUrl, (r) => {
        let data = '';
        r.on('data', c => data += c);
        r.on('end', () => {
          try { const j = JSON.parse(data); console.log(`  Health: ${j.status} (${j.timestamp})`); } catch { console.log('  Health: unreachable'); }
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
  if (!existsSync(LOG_FILE)) {
    console.log('[mcp-memory] No logs yet');
    return;
  }
  const tail = spawn('tail', ['-f', LOG_FILE], { stdio: 'inherit' });
  process.on('SIGINT', () => { tail.kill(); process.exit(0); });
}

function cmdStdio() {
  console.log(`[mcp-memory] Building...`);
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.error('[mcp-memory] Build failed');
    process.exit(1);
  }

  console.log(`[mcp-memory] Starting MCP stdio server...`);
  const child = spawn('node', ['dist/index.js'], {
    cwd: ROOT,
    stdio: ['inherit', 'inherit', 'inherit'],
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

function cmdInfo() {
  console.log(`Project:    ${PKG.name} v${PKG.version}`);
  console.log(`Directory:  ${ROOT}`);
  console.log(`DB:         ${ROOT}/data/memory.db`);
  console.log(`Log:        ${LOG_FILE}`);
  console.log(`HTTP Port:  ${process.env.HTTP_PORT || 3001}`);
  console.log(`PID File:   ${PID_FILE}`);
  console.log('');
  console.log('Commands:');
  console.log('  mcp-memory start      Start the server (background)');
  console.log('  mcp-memory stop       Stop the server');
  console.log('  mcp-memory status     Check server status');
  console.log('  mcp-memory restart    Restart the server');
  console.log('  mcp-memory logs       Tail server logs');
  console.log('  mcp-memory info       Show project info');
  console.log('  mcp-memory stdio      Run MCP server in foreground (for opencode)');
}

const cmd = process.argv[2] || 'status';

switch (cmd) {
  case 'start':    cmdStart(); break;
  case 'stop':     cmdStop(); break;
  case 'status':   cmdStatus(); break;
  case 'restart':  cmdRestart(); break;
  case 'logs':     cmdLogs(); break;
  case 'info':     cmdInfo(); break;
  case 'stdio':    cmdStdio(); break;
  default:
    console.log(`Unknown command: ${cmd}`);
    console.log('Usage: mcp-memory <start|stop|status|restart|logs|info|stdio>');
    process.exit(1);
}

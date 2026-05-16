import 'dotenv/config.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, closeDatabase } from './db/init.js';
import { createMcpServer, getTools } from './server/setup.js';
import { handleProjectCreate, handleProjectList, handleProjectGet } from './tools/project.js';
import { handleEntryCreate, handleEntryGet, handleEntrySearch, handleEntryUpdate, handleEntryDelete } from './tools/entry.js';
import { handleTaskCreate, handleTaskList, handleTaskUpdate } from './tools/task.js';
import { handleAuditGet } from './tools/audit.js';
import { startHttpServer } from './http/server.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/memory.db');

async function main() {
  try {
    console.log('[INIT] Initializing database...');
    initializeDatabase(DB_PATH);
    console.log('[INIT] Database initialized at:', DB_PATH);

    console.log('[INIT] Creating MCP server...');
    const { server, transport } = createMcpServer();
    console.log('[INIT] MCP server created');

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log('[MCP] ListTools request');
      return { tools: getTools() };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      try {
        const toolName = request.params.name;
        const toolInput = request.params.arguments || {};

        console.log(`[MCP] CallTool: ${toolName}`);

        let result: any;

        switch (toolName) {
          case 'project-create':
            result = await handleProjectCreate(toolInput);
            break;
          case 'project-list':
            result = await handleProjectList();
            break;
          case 'project-get':
            result = await handleProjectGet(toolInput);
            break;
          case 'entry-create':
            result = await handleEntryCreate(toolInput);
            break;
          case 'entry-get':
            result = await handleEntryGet(toolInput);
            break;
          case 'entry-search':
            result = await handleEntrySearch(toolInput);
            break;
          case 'entry-update':
            result = await handleEntryUpdate(toolInput);
            break;
          case 'entry-delete':
            result = await handleEntryDelete(toolInput);
            break;
          case 'task-create':
            result = await handleTaskCreate(toolInput);
            break;
          case 'task-list':
            result = await handleTaskList(toolInput);
            break;
          case 'task-update':
            result = await handleTaskUpdate(toolInput);
            break;
          case 'audit-get':
            result = await handleAuditGet(toolInput);
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        } as CallToolResult;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[ERROR] Tool execution failed:`, errorMessage);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: errorMessage }, null, 2) }],
          isError: true,
        } as CallToolResult;
      }
    });

    console.log('[START] Connecting transport...');
    await server.connect(transport);
    console.log('[START] MCP Memory Server started successfully on STDIO!');

    const httpServer = startHttpServer();

    process.on('SIGINT', () => {
      console.log('[SHUTDOWN] Received SIGINT, closing server...');
      httpServer.close();
      closeDatabase();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('[SHUTDOWN] Received SIGTERM, closing server...');
      httpServer.close();
      closeDatabase();
      process.exit(0);
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[FATAL] Server startup failed:', errorMessage);
    console.error(error);
    closeDatabase();
    process.exit(1);
  }
}

main();

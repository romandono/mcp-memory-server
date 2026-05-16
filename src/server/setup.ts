import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export function createMcpServer(): { server: Server; transport: StdioServerTransport } {
  const server = new Server({
    name: 'mcp-memory-server',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  const transport = new StdioServerTransport();
  return { server, transport };
}

export function getTools(): Tool[] {
  return [
    {
      name: 'project-create',
      description: 'Creates a new project',
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string', description: 'Project name' },
          description: { type: 'string', description: 'Optional description' },
        },
        required: ['name'],
      },
    },
    {
      name: 'project-list',
      description: 'Lists all projects',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
    },
    {
      name: 'project-get',
      description: 'Gets a project by ID with its entries and tasks',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Project ID' },
        },
        required: ['id'],
      },
    },
    {
      name: 'entry-create',
      description: 'Creates an SDD entry (plan, design, tasks, or general) under a project',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'string', description: 'Project ID' },
          section: { type: 'string', enum: ['plan', 'design', 'tasks', 'general'], description: 'SDD section' },
          title: { type: 'string', description: 'Entry title' },
          content: { type: 'string', description: 'Entry content' },
          status: { type: 'string', enum: ['draft', 'review', 'done'], description: 'Entry status' },
          parent_id: { type: 'string', description: 'Optional parent entry ID for nesting' },
        },
        required: ['project_id', 'section', 'title'],
      },
    },
    {
      name: 'entry-get',
      description: 'Gets entries for a project, optionally filtered by section',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'string', description: 'Project ID' },
          section: { type: 'string', enum: ['plan', 'design', 'tasks', 'general'], description: 'Optional section filter' },
        },
        required: ['project_id'],
      },
    },
    {
      name: 'entry-search',
      description: 'Searches entries within a project by text',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'string', description: 'Project ID' },
          query: { type: 'string', description: 'Search text' },
        },
        required: ['project_id', 'query'],
      },
    },
    {
      name: 'task-create',
      description: 'Creates a task under a project, optionally linked to an SDD entry',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'string', description: 'Project ID' },
          sdd_entry_id: { type: 'string', description: 'Optional SDD entry ID' },
          title: { type: 'string', description: 'Task title' },
          description: { type: 'string', description: 'Optional description' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Task priority' },
        },
        required: ['project_id', 'title'],
      },
    },
    {
      name: 'task-list',
      description: 'Lists tasks for a project, optionally filtered by entry',
      inputSchema: {
        type: 'object' as const,
        properties: {
          project_id: { type: 'string', description: 'Project ID' },
          sdd_entry_id: { type: 'string', description: 'Optional entry ID to filter tasks' },
        },
        required: ['project_id'],
      },
    },
    {
      name: 'task-update',
      description: 'Updates a task status',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Task ID' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'New status' },
        },
        required: ['id', 'status'],
      },
    },
  ];
}

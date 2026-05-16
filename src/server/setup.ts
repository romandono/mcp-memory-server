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
        properties: {
          page: { type: 'number', description: 'Page number (1-based)' },
          limit: { type: 'number', description: 'Items per page (max 200)' },
        },
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
          page: { type: 'number', description: 'Page number (1-based)' },
          limit: { type: 'number', description: 'Items per page (max 200)' },
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
          page: { type: 'number', description: 'Page number (1-based)' },
          limit: { type: 'number', description: 'Items per page (max 200)' },
        },
        required: ['project_id', 'query'],
      },
    },
    {
      name: 'entry-search-global',
      description: 'Searches entries across all projects by text',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Search text' },
          page: { type: 'number', description: 'Page number (1-based)' },
          limit: { type: 'number', description: 'Items per page (max 200)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'entry-add-file-change',
      description: 'Records a file change associated with an SDD entry',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entry_id: { type: 'string', description: 'Entry ID' },
          file_path: { type: 'string', description: 'Path to the file that changed' },
          change_type: { type: 'string', enum: ['added', 'modified', 'removed'], description: 'Type of change' },
          line_start: { type: 'number', description: 'Start line number (optional)' },
          line_end: { type: 'number', description: 'End line number (optional)' },
          summary: { type: 'string', description: 'Brief summary of what changed' },
        },
        required: ['entry_id', 'file_path', 'change_type', 'summary'],
      },
    },
    {
      name: 'entry-add-decision',
      description: 'Records a design decision for an SDD entry',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entry_id: { type: 'string', description: 'Entry ID' },
          decision: { type: 'string', description: 'The decision made' },
          rationale: { type: 'string', description: 'Why this decision was made' },
          alternatives_considered: { type: 'string', description: 'Alternatives considered (optional)' },
        },
        required: ['entry_id', 'decision', 'rationale'],
      },
    },
    {
      name: 'entry-add-relationship',
      description: 'Creates a relationship between two SDD entries',
      inputSchema: {
        type: 'object' as const,
        properties: {
          source_entry_id: { type: 'string', description: 'Source entry ID' },
          target_entry_id: { type: 'string', description: 'Target entry ID' },
          relationship_type: { type: 'string', enum: ['depends_on', 'implements', 'related_to', 'supersedes'], description: 'Type of relationship' },
        },
        required: ['source_entry_id', 'target_entry_id', 'relationship_type'],
      },
    },
    {
      name: 'entry-get-context',
      description: 'Gets full context for an entry (entry + file changes + decisions + relationships)',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entry_id: { type: 'string', description: 'Entry ID' },
        },
        required: ['entry_id'],
      },
    },
    {
      name: 'entry-update',
      description: 'Updates an SDD entry',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Entry ID' },
          title: { type: 'string', description: 'New title' },
          content: { type: 'string', description: 'New content' },
          status: { type: 'string', enum: ['draft', 'review', 'done'], description: 'New status' },
          section: { type: 'string', enum: ['plan', 'design', 'tasks', 'general'], description: 'New section' },
          parent_id: { type: 'string', description: 'New parent entry ID (null to clear)' },
        },
        required: ['id'],
      },
    },
    {
      name: 'entry-delete',
      description: 'Deletes an SDD entry',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Entry ID' },
        },
        required: ['id'],
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
          page: { type: 'number', description: 'Page number (1-based)' },
          limit: { type: 'number', description: 'Items per page (max 200)' },
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
    {
      name: 'audit-get',
      description: 'Gets audit log entries for an entity or project',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_type: { type: 'string', enum: ['entry', 'task'], description: 'Filter by entity type' },
          entity_id: { type: 'string', description: 'Filter by entity ID' },
          project_id: { type: 'string', description: 'Filter by project ID' },
          page: { type: 'number', description: 'Page number (1-based)' },
          limit: { type: 'number', description: 'Items per page (max 200)' },
        },
      },
    },
  ];
}

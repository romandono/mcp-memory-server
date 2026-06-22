import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MCP Memory Server API',
      version: '1.0.0',
      description: 'API REST para gestionar contexto de IA en SQLite local',
    },
    servers: [
      {
        url: 'http://localhost:{port}',
        variables: {
          port: {
            default: '3001',
          },
        },
      },
    ],
    components: {
      schemas: {
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['active', 'archived', 'completed'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'name', 'status', 'created_at', 'updated_at'],
        },
        SddEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            project_id: { type: 'string', format: 'uuid' },
            section: { type: 'string', enum: ['plan', 'design', 'tasks', 'general'] },
            title: { type: 'string' },
            content: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'review', 'done'] },
            parent_id: { type: 'string', format: 'uuid', nullable: true },
            metadata: { type: 'object', additionalProperties: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'project_id', 'section', 'title', 'content', 'status', 'created_at', 'updated_at'],
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            project_id: { type: 'string', format: 'uuid' },
            sdd_entry_id: { type: 'string', format: 'uuid', nullable: true },
            title: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'project_id', 'title', 'status', 'priority', 'created_at', 'updated_at'],
        },
        AuditLogEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            entity_type: { type: 'string', enum: ['entry', 'task'] },
            entity_id: { type: 'string', format: 'uuid' },
            action: { type: 'string', enum: ['created', 'updated', 'deleted'] },
            changes: { type: 'string' },
            project_id: { type: 'string', format: 'uuid' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
    },
  },
  apis: [
    path.join(__dirname, './routes.js'),
    path.join(__dirname, './routes.ts'),
    './src/http/routes.ts',
    './dist/http/routes.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

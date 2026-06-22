import express from 'express';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import router from './routes.js';
import { swaggerSpec } from './swagger.js';

const DEFAULT_PORT = 3001;

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use(router);
  return app;
}

export function startHttpServer(): http.Server {
  const app = createApp();

  const port = parseInt(process.env.HTTP_PORT || String(DEFAULT_PORT), 10);

  const server = app.listen(port, () => {
    console.log(`[HTTP] REST API listening on http://localhost:${port}`);
    console.log(`[HTTP] Swagger UI available at http://localhost:${port}/api-docs`);
    console.log(`[HTTP]   GET    /health`);
    console.log(`[HTTP]   GET    /api/projects`);
    console.log(`[HTTP]   POST   /api/projects`);
    console.log(`[HTTP]   GET    /api/projects/:id`);
    console.log(`[HTTP]   PUT    /api/projects/:id`);
    console.log(`[HTTP]   DELETE /api/projects/:id`);
    console.log(`[HTTP]   GET    /api/projects/:pid/entries`);
    console.log(`[HTTP]   POST   /api/projects/:pid/entries`);
    console.log(`[HTTP]   GET    /api/projects/:pid/entries/search`);
    console.log(`[HTTP]   GET    /api/projects/:pid/entries/:eid`);
    console.log(`[HTTP]   PUT    /api/projects/:pid/entries/:eid`);
    console.log(`[HTTP]   DELETE /api/projects/:pid/entries/:eid`);
    console.log(`[HTTP]   GET    /api/projects/:pid/tasks`);
    console.log(`[HTTP]   POST   /api/projects/:pid/tasks`);
    console.log(`[HTTP]   PUT    /api/projects/:pid/tasks/:tid`);
    console.log(`[HTTP]   DELETE /api/projects/:pid/tasks/:tid`);
    console.log(`[HTTP]   GET    /api/audit`);
    console.log(`[HTTP]   GET    /api/db/download`);
    console.log(`[HTTP]   POST   /api/classify`);
    console.log(`[HTTP]   GET    /api/entries/:eid/context`);
    console.log(`[HTTP]   POST   /api/entries/:eid/decisions`);
    console.log(`[HTTP]   POST   /api/entries/:eid/relationships`);
  });

  return server;
}

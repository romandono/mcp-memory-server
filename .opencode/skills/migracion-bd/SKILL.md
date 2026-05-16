---
name: migracion-bd
description: Usa cuando trabajes con migraciones SQLite en mcp-memory-server.
---

# Migración de BD en mcp-memory-server

1. Crea el archivo en `src/db/migrations/` con formato `XXX_descripcion.ts`
2. Exporta una función `up(db: Database)` que ejecute los SQL
3. La migración debe ser idempotente (usa IF NOT EXISTS)
4. Registra en `src/db/migrations/runner.ts` añadiendo al array de migraciones
5. Si agregas tablas nuevas, añade también los tipos en `src/types/` y CRUD en `src/db/schema.ts`
6. Build: `npm run build` (tsc sin errores)
7. Tests: `npx vitest run`

# MCP Memory Server

Servidor de memoria persistente para asistentes de IA vía **Model Context Protocol (MCP)**. Almacena y organiza planes SDD (Software Design Document) con la estructura **Proyecto → Entradas → Tareas**, todo en una base de datos **SQLite** local.

Expone tanto un transporte **MCP sobre STDIO** como una **API REST HTTP**.

---

## Arquitectura

```
           ┌──────────────────────────────────┐
Cliente    │         MCP Memory Server        │
MCP ◄────► │  ┌──────────┐  ┌──────────────┐  │
(stdio)    │  │ MCP over │  │ Express REST │  │
           │  │   STDIO   │  │ :3001        │  │
           │  └────┬─────┘  └──────┬───────┘  │
           │       └──────┬────────┘           │
           │              ▼                    │
           │    ┌─────────────────┐            │
           │    │   better-sqlite3 │            │
           │    │   (WAL mode)    │            │
           │    └────────┬────────┘            │
           └─────────────┼─────────────────────┘
                         ▼
       ~/.local/share/mcp-memory/memory.db
```

### Estructura de datos

```
projects
 ├── id, name, description, status
 │
 ├── sdd_entries
 │    ├── id, project_id
 │    ├── section (plan | design | tasks | general)
 │    ├── title, content, status, parent_id
 │    └── metadata (JSON)
 │
 ├── tasks
 │    ├── id, project_id, sdd_entry_id
 │    ├── title, description
 │    └── status, priority
 │
    ├── design_decisions
    │    ├── id, entry_id
    │    ├── decision, rationale
   │    └── alternatives_considered
   │
   ├── entry_relationships
   │    ├── id, source_entry_id, target_entry_id
   │    └── relationship_type (depends_on|implements|related_to|supersedes)
   │
   ├── classifications (polymorphic)
   │    ├── classifiable_type (project | entry | task)
   │    └── tag, confidence
   │
   ├── audit_log
   │    ├── id, entity_type, entity_id
   │    ├── action (created | updated | deleted)
   │    └── changes (JSON), project_id, timestamp
   │
   └── fts_entries (FTS5 virtual table)
        ├── entry_id, section, title, content
        └── auto-sincronizada via triggers

_migrations (tracking de cambios de schema)
```

### Tecnologías

| Capa | Tecnología |
|------|-----------|
| Lenguaje | TypeScript (ESM) |
| MCP SDK | `@modelcontextprotocol/sdk` |
| HTTP Server | Express 5 |
| Base de datos | SQLite vía `better-sqlite3` (WAL mode) |
| Validación | Zod |
| Tests | Vitest + Supertest |

---

## Instalación

### Requisitos

- Node.js ≥ 18
- npm ≥ 9

### Instalación global desde release/npm

```bash
# Instalar última release publicada
npm install -g mcp-memory-server

# Ver rutas resueltas y versión
mcp-memory paths
mcp-memory version

# Iniciar servidor
mcp-memory start

# Ver estado
mcp-memory status
```

### Uso sin instalación global

```bash
npx -y mcp-memory-server@latest stdio
```

### Upgrade / rollback

```bash
# Actualizar a última release
npm install -g mcp-memory-server@latest

# Instalar versión concreta
npm install -g mcp-memory-server@1.0.0
```

### Releases

- Cada tag `v*` publica paquete npm y crea GitHub Release mediante `.github/workflows/release.yml`
- El workflow requiere secreto `NPM_TOKEN`
- El artefacto `.tgz` de la release permite probar instalación sin clonar repo

### Desarrollo local

```bash
git clone <repo>
cd mcp-memory-server
npm install
npm run build
node bin/mcp-memory.js start
```

### Migrar base de datos antigua

```bash
mcp-memory migrate-db --from /ruta/antigua/memory.db
```

---

## Uso

### CLI

```bash
mcp-memory start      # Inicia en background
mcp-memory stop       # Detiene el servidor
mcp-memory status     # Muestra estado (PID, health)
mcp-memory restart    # Reinicia
mcp-memory logs       # Tail de logs
mcp-memory info       # Información del proyecto
mcp-memory paths      # Muestra rutas resueltas
mcp-memory version    # Muestra versión instalada
mcp-memory rebuild-memory   # Regenera summaries/facts compactos
mcp-memory migrate-db --from /ruta/db.sqlite
```

O via npm:

```bash
npm run start:bg   # start en background
npm run stop       # stop
npm run status     # status
npm start          # start en foreground
```

### API REST

El servidor HTTP corre en `http://localhost:3001` (configurable con `HTTP_PORT`).

Documentación interactiva disponible en: `http://localhost:3001/api-docs`

> Todos los endpoints de listado soportan paginación con `?page=1&limit=50` (max 200).  
> La respuesta incluye `pagination: { page, limit, total, totalPages }`.

#### Proyectos

```
GET    /api/projects                              → Listar proyectos (?page=&limit=)
POST   /api/projects                              → Crear proyecto { name, description? }
GET    /api/projects/:id                          → Proyecto con entries + tasks + clasificaciones
PUT    /api/projects/:id                          → Actualizar proyecto { name?, status?, description? }
DELETE /api/projects/:id                          → Eliminar proyecto (cascade)
```

#### Entradas SDD

```
GET    /api/projects/:pid/entries                     → Listar entradas (?section=&page=&limit=)
POST   /api/projects/:pid/entries                     → Crear entrada { section, title, content? }
GET    /api/projects/:pid/entries/search?q=texto      → Buscar entradas en el proyecto (FTS5, ?page=&limit=)
GET    /api/projects/:pid/entries/:eid                → Obtener entrada + clasificaciones
PUT    /api/projects/:pid/entries/:eid                → Actualizar entrada
DELETE /api/projects/:pid/entries/:eid                → Eliminar entrada
```

#### Búsqueda global

```
GET    /api/entries/search?q=texto                    → Buscar entradas en todos los proyectos (FTS5, ?page=&limit=)
GET    /api/entries/search?q=texto&view=compact       → Resultados compactos optimizados para LLM
```

### TOON y vistas compactas

Parámetros nuevos en rutas/tools compatibles:

- `view=full|summary|compact`
- `format=json|toon-r|toon-d`
- `max_items=<n>`
- `max_chars=<n>`
- `cursor=<last_id>`

Uso recomendado para agentes/LLM:

```bash
curl "http://localhost:3001/api/entries/<eid>/context?view=compact&format=toon-r"
curl "http://localhost:3001/api/entries/search?q=release&view=compact&format=toon-d"
curl "http://localhost:3001/api/entries/batch?ids=e1,e2,e3&max_items=2"
```

Semántica:

- `full`: contrato legacy completo
- `summary`: respuesta resumida sin contenido largo
- `compact`: respuesta basada en summaries/facts derivadas
- `toon-r`: TOON legible para debug
- `toon-d`: TOON denso para mínimo tamaño
- `max_items`: corta arrays compactos y marca `truncated`
- `max_chars`: limita volumen aproximado de texto compacto
- `cursor`: continúa desde último `id` devuelto en respuesta previa
- `metrics`: cada respuesta compacta JSON incluye `bytes`, `chars`, `estimated_tokens`

Implementación actual:

- `summary_short` y `summary_dense` derivadas por entry
- `memory_facts` derivadas desde entries, decisiones y relaciones
- FTS5 compacta sobre `fts_entry_summaries` para búsquedas TOON/compact
- Fallback automático al índice legacy si faltan datos derivados

#### Contexto enriquecido

```
GET    /api/entries/:eid/context                      → Entry + decisions + relationships
GET    /api/entries/:eid/summary                      → Summary derivada compacta
GET    /api/entries/:eid/compact                      → Contexto compacto/TOON
GET    /api/entries/batch?ids=e1,e2                   → Batch compacto por IDs
POST   /api/entries/:eid/decisions                    → Registrar decisión de diseño { decision, rationale, alternatives_considered? }
POST   /api/entries/:eid/relationships                → Relacionar entries { target_entry_id, relationship_type }
GET    /api/facts                                     → Facts derivadas (?project_id=&entry_id=&kind=&page=&limit=&max_items=&max_chars=&cursor=)
```

#### Tareas

```
GET    /api/projects/:pid/tasks                   → Listar tareas (?entry_id=&page=&limit=)
POST   /api/projects/:pid/tasks                   → Crear tarea { title, priority?, sdd_entry_id? }
PUT    /api/projects/:pid/tasks/:tid              → Actualizar tarea { status? }
DELETE /api/projects/:pid/tasks/:tid              → Eliminar tarea
```

#### Auditoría

```
GET    /api/audit                                  → Historial de cambios (?entity_type=&entity_id=&project_id=&page=&limit=)
```

#### Clasificaciones

```
POST   /api/classify    → Añadir clasificación { classifiable_type, classifiable_id, tag, confidence }
GET    /api/db/download → Descargar el fichero SQLite
```

### MCP Tools

El servidor expone estas herramientas vía MCP (STDIO):

| Tool | Descripción |
|------|-------------|
| `project-create` | Crear proyecto |
| `project-list` | Listar proyectos (con paginación opcional) |
| `project-get` | Proyecto completo con entries y tasks |
| `entry-create` | Crear entrada SDD (plan/design/tasks/general) |
| `entry-get` | Listar entradas de un proyecto (con paginación opcional) |
| `entry-search` | Buscar entradas por texto (FTS5, con paginación opcional) |
| `entry-search-global` | Buscar entradas en todos los proyectos (FTS5, sin project_id) |
| `entry-update` | Actualizar entrada (title, content, status, section, parent_id) |
| `entry-delete` | Eliminar entrada |
| `entry-add-decision` | Registrar decisión de diseño |
| `entry-add-relationship` | Relacionar dos entradas |
| `entry-batch-get` | Obtener varias entradas compactas por ID |
| `entry-get-context` | Obtener entrada + decisions + relationships |
| `entry-get-summary` | Obtener summary derivada compacta |
| `task-create` | Crear tarea |
| `task-list` | Listar tareas de un proyecto (con paginación opcional) |
| `task-update` | Actualizar estado de tarea |
| `memory-facts-get` | Consultar facts derivadas |
| `audit-get` | Consultar historial de cambios (filtros: entity_type, entity_id, project_id) |

---

## Configuración

Variables de entorno (fichero `.env`):

```env
HTTP_PORT=3001        # Puerto del servidor REST
DB_PATH=/ruta/memory.db   # Override directo de base de datos
MCP_MEMORY_HOME=/ruta/base
LOG_PATH=/ruta/server.log
PID_PATH=/ruta/server.pid
```

Rutas por defecto sin overrides:

- Linux: `~/.local/share/mcp-memory/memory.db` y `~/.local/state/mcp-memory/`
- macOS: `~/Library/Application Support/mcp-memory/`
- Windows: `%LOCALAPPDATA%\mcp-memory\`

---

## Configuración para opencode

Para conectar este servidor MCP desde **opencode**, añade la siguiente configuración en tu `opencode.json` (global en `~/.config/opencode/opencode.jsonc` o local en la raíz del proyecto):

```json
{
  "mcp": {
    "mcp-memory-server": {
      "type": "local",
      "command": ["mcp-memory", "stdio"],
      "enabled": true,
      "env": {}
    }
  }
}
```

> Requiere tener paquete instalado globalmente con `npm install -g mcp-memory-server`, o usar un wrapper `npx` propio.

Ejemplo sin instalación global permanente:

```json
{
  "mcp": {
    "mcp-memory-server": {
      "type": "local",
      "command": ["npx", "-y", "mcp-memory-server@latest", "stdio"],
      "enabled": true,
      "env": {}
    }
  }
}
```

> **Nota:** Después de guardar los cambios, reinicia opencode para que la configuración surta efecto.

### Herramientas MCP disponibles

Una vez conectado, opencode tendrá acceso a estas herramientas:

| Tool | Descripción |
|------|-------------|
| `project-create` | Crear un proyecto nuevo |
| `project-list` | Listar todos los proyectos |
| `project-get` | Obtener un proyecto completo con entradas y tareas |
| `entry-create` | Crear una entrada SDD (plan/design/tasks/general) |
| `entry-get` | Obtener entradas de un proyecto |
| `entry-search` | Buscar entradas por texto (FTS5) |
| `entry-search-global` | Buscar entradas en todos los proyectos |
| `entry-update` | Actualizar una entrada (title, content, status, section, parent_id) |
| `entry-delete` | Eliminar una entrada |
| `entry-add-decision` | Registrar decisión de diseño |
| `entry-add-relationship` | Relacionar dos entradas |
| `entry-batch-get` | Obtener varias entradas compactas por ID |
| `entry-get-context` | Obtener entrada + decisions + relationships |
| `entry-get-summary` | Obtener summary derivada compacta |
| `task-create` | Crear una tarea |
| `task-list` | Listar tareas de un proyecto |
| `task-update` | Actualizar estado de una tarea |
| `memory-facts-get` | Consultar facts derivadas |
| `audit-get` | Consultar historial de cambios de entradas y tareas |

---

## Tests y calidad

```bash
npm test             # Ejecutar tests (Vitest, 137 tests)
npm run test:watch   # Modo watch
npm run lint         # ESLint
npm run lint:fix     # ESLint con auto-fix
npm run format       # Prettier (check)
npm run format:fix   # Prettier (formatear)
npm run type-check   # TypeScript strict check
```

---

## Migraciones

El schema de la base de datos se gestiona mediante migraciones numeradas en `src/db/migrations/runner.ts`:

| Migración | Descripción |
|-----------|-------------|
| `001_initial_schema` | Tablas base: projects, sdd_entries, tasks, classifications |
| `002_add_fts5` | Búsqueda de texto completo (FTS5) con sincronización automática |
| `003_add_audit_log` | Auditoría de cambios con triggers en entries y tasks |
| `004_add_context_tables` | Tablas de contexto enriquecido: file_changes (legacy), design_decisions, entry_relationships |
| `005_add_compact_memory` | Summaries derivadas y memory facts para views compactas / TOON |
| `006_add_compact_memory_fts` | Índice FTS5 sobre summaries/keywords para búsqueda compacta |

Las migraciones se aplican automáticamente al iniciar el servidor.  
La tabla `_migrations` registra cuáles se han ejecutado.

> Nota: `file_changes` puede seguir existiendo en bases de datos antiguas para preservar historial, pero ya no forma parte del modelo activo ni de la API/MCP pública.

---

## Acceso a la base de datos

Primero obtén ruta real:

```bash
mcp-memory paths
```

En Linux/WSL, consulta SQLite así:

```bash
sqlite3 ~/.local/share/mcp-memory/memory.db "SELECT * FROM projects;"
```

Para abrirla en DBeaver desde Windows, haz una copia:

```bash
cp ~/.local/share/mcp-memory/memory.db /tmp/memory-view.db
```

Y abre `\\wsl.localhost\Ubuntu-24.04\tmp\memory-view.db` en DBeaver.

O descárgala vía HTTP:

```bash
curl -o memory-view.db http://localhost:3001/api/db/download
```

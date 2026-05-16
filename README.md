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
                 data/memory.db
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

### Paso a paso

```bash
# 1. Clonar o copiar el proyecto
cd mcp-memory-server

# 2. Instalar dependencias
npm install

# 3. Compilar TypeScript
npm run build

# 4. Iniciar el servidor (background)
npm run start:bg

# 5. Verificar que está corriendo
npm run status
```

### Instalación global (opcional)

Para usar `mcp-memory` desde cualquier directorio:

```bash
npm link
```

Ahora puedes usar el CLI globalmente:

```bash
mcp-memory start
mcp-memory status
mcp-memory stop
```

---

## Uso

### CLI

```bash
mcp-memory start      # Compila + inicia en background
mcp-memory stop       # Detiene el servidor
mcp-memory status     # Muestra estado (PID, health)
mcp-memory restart    # Reinicia
mcp-memory logs       # Tail de logs
mcp-memory info       # Información del proyecto
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
GET    /api/projects/:pid/entries                 → Listar entradas (?section=&page=&limit=)
POST   /api/projects/:pid/entries                 → Crear entrada { section, title, content? }
GET    /api/projects/:pid/entries/search?q=texto  → Buscar entradas (FTS5, ?page=&limit=)
GET    /api/projects/:pid/entries/:eid            → Obtener entrada + clasificaciones
PUT    /api/projects/:pid/entries/:eid            → Actualizar entrada
DELETE /api/projects/:pid/entries/:eid            → Eliminar entrada
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
| `entry-update` | Actualizar entrada (title, content, status, section, parent_id) |
| `entry-delete` | Eliminar entrada |
| `task-create` | Crear tarea |
| `task-list` | Listar tareas de un proyecto (con paginación opcional) |
| `task-update` | Actualizar estado de tarea |
| `audit-get` | Consultar historial de cambios (filtros: entity_type, entity_id, project_id) |

---

## Configuración

Variables de entorno (fichero `.env`):

```env
HTTP_PORT=3001        # Puerto del servidor REST
DB_PATH=./data/memory.db  # Ruta a la base de datos
```

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

> Requiere tener el paquete instalado globalmente (`npm link` en el directorio del proyecto).

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
| `entry-update` | Actualizar una entrada (title, content, status, section, parent_id) |
| `entry-delete` | Eliminar una entrada |
| `task-create` | Crear una tarea |
| `task-list` | Listar tareas de un proyecto |
| `task-update` | Actualizar estado de una tarea |
| `audit-get` | Consultar historial de cambios de entradas y tareas |

---

## Tests y calidad

```bash
npm test             # Ejecutar tests (Vitest, 90+ tests)
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

Las migraciones se aplican automáticamente al iniciar el servidor.  
La tabla `_migrations` registra cuáles se han ejecutado.

---

## Acceso a la base de datos

Mientras el servidor está en ejecución, la base de datos se puede consultar desde WSL:

```bash
sqlite3 data/memory.db "SELECT * FROM projects;"
```

Para abrirla en DBeaver desde Windows, haz una copia:

```bash
cp data/memory.db /tmp/memory-view.db
```

Y abre `\\wsl.localhost\Ubuntu-24.04\tmp\memory-view.db` en DBeaver.

O descárgala vía HTTP:

```bash
curl -o memory-view.db http://localhost:3001/api/db/download
```

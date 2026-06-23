# Proceso de Instalación y Distribución (@romandono/context-cache-mcp)

Este documento registra flujo actual para instalar `@romandono/context-cache-mcp` sin clonar repositorio, publicar releases y ubicar datos runtime fuera del directorio del paquete.

## Fecha
2026-06-03

## Estado actual

1. **Paquete instalable desde npm/GitHub Release:**
   El proyecto se empaqueta con `dist/` precompilado mediante `prepack`, por lo que instalación final no depende de compilar TypeScript en máquina cliente.

2. **Instalación global estándar:**
   ```bash
   npm install -g @romandono/context-cache-mcp
   ```

3. **Uso sin instalación global permanente:**
   ```bash
   npx -y @romandono/context-cache-mcp@latest stdio
   ```

4. **Upgrade / rollback por versión:**
   ```bash
   npm install -g @romandono/context-cache-mcp@latest
   npm install -g @romandono/context-cache-mcp@1.0.0
   ```

5. **Rutas runtime por usuario:**
   La base de datos, logs y PID ya no se guardan dentro del repo ni del directorio del paquete instalado.

   Defaults:
   - Linux: `~/.local/share/mcp-memory/memory.db` y `~/.local/state/mcp-memory/`
   - macOS: `~/Library/Application Support/mcp-memory/`
   - Windows: `%LOCALAPPDATA%\mcp-memory\`

6. **Migración manual de BD antigua:**
   Para copiar una BD legacy desde un checkout anterior:
   ```bash
   mcp-memory migrate-db --from /ruta/antigua/memory.db
   ```

7. **Release automation:**
   Taggear `v*` ejecuta workflow `.github/workflows/release.yml`, corre tests/build, publica en npm y crea GitHub Release. Requiere secreto `NPM_TOKEN`.

8. **Memoria compacta / TOON:**
   El servidor expone vistas `summary` y `compact`, formato `toon-r` / `toon-d`, batch retrieval, budgets (`max_items`, `max_chars`), cursor pagination y métricas de payload para agentes/LLM.

9. **Índice FTS derivado:**
   La búsqueda compacta usa `fts_entry_summaries` sobre summaries/keywords derivadas, con fallback a búsqueda legacy si todavía no existen datos derivados.

## Verificación
Comandos relevantes:
```bash
mcp-memory version
mcp-memory paths
mcp-memory status
mcp-memory rebuild-memory
```

## Configuración MCP Recomendada
Para integrar con agentes de IA (como opencode), usar:
- **Command:** `mcp-memory stdio`
- **Alternativa sin instalación global:** `npx -y @romandono/context-cache-mcp@latest stdio`

Parámetros recomendados para clientes que optimizan tokens:
- `view=compact`
- `format=toon-r` o `toon-d`
- `max_items`, `max_chars`, `cursor`

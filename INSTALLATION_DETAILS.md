# Proceso de Instalación Global (mcp-memory-server)

Este documento registra los pasos realizados para que `mcp-memory-server` funcione globalmente en un entorno gestionado por `asdf` e `ivm-node`.

## Fecha
2026-06-03

## Pasos Realizados

1. **Configuración de Versión Global de Node:**
   Para evitar el error "No version is set", se estableció una versión de `ivm-node` como predeterminada para el sistema.
   ```bash
   asdf set ivm-node 22.17.1
   ```

2. **Vinculación Global del Paquete (npm link):**
   Se utilizó `npm link` dentro del directorio del proyecto para registrar el binario `mcp-memory` de forma que cualquier cambio en el código fuente sea inmediato.
   ```bash
   cd /home/romandp/projects/owner/mcp-memory-server
   npm link
   ```

3. **Actualización de Shims de asdf:**
   Se regeneraron los accesos directos (shims) de `asdf` para que el comando `mcp-memory` sea reconocido por el shell en cualquier ubicación.
   ```bash
   asdf reshim ivm-node 22.17.1
   ```

## Verificación
El comando ahora es accesible globalmente:
```bash
mcp-memory --help
# Usage: mcp-memory <start|stop|status|restart|logs|info|stdio>
```

## Configuración MCP Recomendada
Para integrar con agentes de IA (como opencode), usar:
- **Command:** `mcp-memory stdio`

# Plan de Implementación: Migración y Estructuración Completa a Angular (ConsoleFlow Workspace Hub)

## Resumen
Transformar **ConsoleFlow Workspace Hub** de un conjunto de archivos HTML monolíticos (con iframes, React+Babel embebido y Vanilla JS mezclado) a una arquitectura profesional basada en **Angular** (`@angular/core`, `@angular/router`, `@angular/forms`), integrada con **Electron** y el servidor backend de **Node.js** (`server.js`). Cada vista y subcomponente tendrá sus propios archivos separados (`.component.html`, `.component.css`, `.component.ts`).

## Decisiones de Arquitectura
- **Angular Standalone Components**: Estructura modular en `src/app/core` y `src/app/features/<herramienta>/components/<subcomponente>`, donde cada componente separa estrictamente su plantilla (`.html`), estilos encapsulados (`.css`) y lógica (`.ts`).
- **Router SPA con Persistencia en Memoria (`KeepAliveRouteReuseStrategy`)**: Uso de `@angular/router` con una estrategia personalizada de reutilización de rutas para que al cambiar entre herramientas (`/hub`, `/dashboard-cmd`, `/doc-generator`, `/redes`, `/api-doc`, `/repo-doc`, `/emulador`) las vistas no se destruyan de memoria y conserven su progreso y el `<webview>` de Electron.
- **Unificación de Frameworks**: Las herramientas que antes cargaban React 18 + Babel por CDN (`doc-Generator` y `redes`) se migran nativamente a componentes y servicios de Angular en TypeScript.
- **Compatibilidad Total con Backend y Electron**: `server.js` y `navegacion.js` servirán el bundle compilado de Angular (`dist/consoleflow/browser`) manteniendo intactos todos los endpoints (`/data`, `/dataEmulador`, `/execute`, `/api/doc/*`) y la comunicación IPC con el System Tray de `main.js`.

## Fases de Trabajo
1. **Fase 1: Base de Angular, Configuración, Router y Servicios Core**
2. **Fase 2: Hub Principal + Dashboard CMD (y sus subcomponentes)**
3. **Fase 3: API Doc Manager + Repo Docs (y sus subcomponentes)**
4. **Fase 4: Doc Generator + Emulador de Dispositivos (y sus subcomponentes)**
5. **Fase 5: Generador de Redes Cisco (y sus subcomponentes)**
6. **Fase 6: Integración con `server.js`, `main.js`, compilación y verificación**


# Lista de Tareas: Migración a Angular

## Fase 1: Fundación Angular y Core
- [x] **Tarea 1**: Configurar `package.json`, `angular.json`, `tsconfig.json` e instalar dependencias de Angular (`@angular/core`, `@angular/router`, `@angular/forms`, `@angular/common`, `@angular/platform-browser`, `@angular/cli`, `@angular-devkit/build-angular`).
- [x] **Tarea 2**: Crear `src/app/core` con `KeepAliveRouteReuseStrategy`, servicios (`ConsoleFlowApiService`, `DocApiService`, `EmulatorHistoryService`, `ElectronService`, `LucideIconService`) y el layout principal con `SidebarNavComponent` (`.html`, `.css`, `.ts`).

## Fase 2: Hub y Dashboard CMD
- [x] **Tarea 3**: Crear `features/hub` (`HubComponent` y subcomponente `ToolCardComponent` en `.html`, `.css`, `.ts`).
- [x] **Tarea 4**: Crear `features/dashboard-cmd` dividido en subcomponentes (`CmdSidebarComponent`, `CmdHeaderComponent`, `CmdGridComponent`, `CmdConsoleDrawerComponent`, `CmdModalsComponent`).

## Fase 3: API Doc Manager y Repo Docs
- [x] **Tarea 5**: Crear `features/api-doc` dividido en subcomponentes (`ApiExplorerSidebarComponent`, `ApiDocEditorComponent`, `ApiFolderModalComponent`).
- [x] **Tarea 6**: Crear `features/repo-doc` dividido en subcomponentes (`RepoSidebarTreeComponent`, `RepoBranchDetailComponent`, `RepoModalsComponent`).

## Fase 4: Doc Generator y Emulador
- [x] **Tarea 7**: Migrar `features/doc-generator` de React/Babel a Angular dividido en `PdfExportService`, `DocEditorPanelComponent`, `DocPreviewPaperComponent` y `DocImportModalComponent`.
- [x] **Tarea 8**: Migrar `features/emulador` dividido en `EmuladorHeaderComponent`, `EmuladorViewportComponent` y soporte nativo para `<webview>` de Electron.

## Fase 5: Generador de Redes Cisco
- [x] **Tarea 9**: Migrar `features/redes` de React/Babel a Angular dividido en `CiscoCliService`, `RedesSidebarComponent`, `RedesInterfacesEditorComponent`, `RedesRoutingEditorComponent`, `RedesServicesEditorComponent` y `RedesCliConsoleComponent`.

## Fase 6: Integración Backend, Electron y Build
- [x] **Tarea 10**: Actualizar `server.js`, `navegacion.js` y `main.js` para servir la aplicación Angular compilada y responder a eventos IPC de navegación.
- [x] **Tarea 11**: Compilar el proyecto con `npm run build:web` y verificar que todas las rutas y controladores respondan sin errores.

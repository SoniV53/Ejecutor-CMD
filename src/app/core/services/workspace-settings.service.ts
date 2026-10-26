import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ElectronService } from './electron.service';

export interface WorkspaceModuleItem {
  id: string;
  route: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  color: 'indigo' | 'purple' | 'orange' | 'sky' | 'emerald' | 'blue';
  enabled: boolean;
}

const STORAGE_KEY = 'consoleflow_enabled_modules_v1';
const BG_STORAGE_KEY = 'consoleflow_run_in_background_v1';

const DEFAULT_MODULES: Omit<WorkspaceModuleItem, 'enabled'>[] = [
  {
    id: 'dashboard-cmd',
    route: '/dashboard-cmd',
    title: 'Panel Local',
    shortTitle: 'Dashboard CMD',
    description: 'Administra tus proyectos y ejecuta scripts en tu máquina local.',
    icon: 'terminal',
    color: 'indigo'
  },
  /* Temporalmente comentados por solicitud
  {
    id: 'doc-generator',
    route: '/doc-generator',
    title: 'Doc Generator',
    shortTitle: 'Doc Generator',
    description: 'Genera documentación estructurada automáticamente.',
    icon: 'file-text',
    color: 'purple'
  },
  {
    id: 'redes',
    route: '/redes',
    title: 'Redes',
    shortTitle: 'Redes',
    description: 'Generador y simulador de redes.',
    icon: 'network',
    color: 'orange'
  },
  */
  {
    id: 'api-doc',
    route: '/api-doc',
    title: 'API Doc Manager',
    shortTitle: 'API Docs',
    description: 'Gestiona, visualiza y documenta tus tramas API.',
    icon: 'file-json',
    color: 'sky'
  },
  {
    id: 'repo-doc',
    route: '/repo-doc',
    title: 'Repo Docs',
    shortTitle: 'Repo Docs',
    description: 'Documentador de ramas y commits guardado en tus archivos.',
    icon: 'git-branch',
    color: 'emerald'
  },
  {
    id: 'emulador',
    route: '/emulador',
    title: 'Emulador de Dispositivos',
    shortTitle: 'Emulador',
    description: 'Previsualiza y ajusta interfaces móviles de forma nativa.',
    icon: 'smartphone',
    color: 'blue'
  }
];

@Injectable({ providedIn: 'root' })
export class WorkspaceSettingsService {
  private readonly modulesSubject = new BehaviorSubject<WorkspaceModuleItem[]>(this.loadModules());
  readonly modules$ = this.modulesSubject.asObservable();

  private readonly runInBackgroundSubject = new BehaviorSubject<boolean>(this.loadRunInBackground());
  readonly runInBackground$ = this.runInBackgroundSubject.asObservable();

  constructor(private electronService: ElectronService) {
    // Sincronizar con el proceso principal de Electron al iniciar
    this.electronService.setRunInBackground(this.runInBackgroundSubject.getValue());
  }

  getModules(): WorkspaceModuleItem[] {
    return this.modulesSubject.getValue();
  }

  getRunInBackground(): boolean {
    return this.runInBackgroundSubject.getValue();
  }

  toggleRunInBackground(): void {
    this.setRunInBackground(!this.getRunInBackground());
  }

  setRunInBackground(enabled: boolean): void {
    try {
      localStorage.setItem(BG_STORAGE_KEY, JSON.stringify(enabled));
    } catch {
      // Ignorar errores de almacenamiento
    }
    this.runInBackgroundSubject.next(enabled);
    this.electronService.setRunInBackground(enabled);
  }

  toggleModule(id: string): void {
    const updated = this.getModules().map(m =>
      m.id === id ? { ...m, enabled: !m.enabled } : m
    );
    this.saveAndEmit(updated);
  }

  setModuleEnabled(id: string, enabled: boolean): void {
    const updated = this.getModules().map(m =>
      m.id === id ? { ...m, enabled } : m
    );
    this.saveAndEmit(updated);
  }

  enableAllModules(): void {
    const updated = this.getModules().map(m => ({ ...m, enabled: true }));
    this.saveAndEmit(updated);
  }

  private loadRunInBackground(): boolean {
    try {
      const raw = localStorage.getItem(BG_STORAGE_KEY);
      if (raw !== null) {
        return JSON.parse(raw) === true;
      }
    } catch {
      // Ignorar
    }
    return true;
  }

  private loadModules(): WorkspaceModuleItem[] {
    let savedMap: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        savedMap = JSON.parse(raw) || {};
      }
    } catch {
      savedMap = {};
    }

    return DEFAULT_MODULES.map(mod => ({
      ...mod,
      enabled: typeof savedMap[mod.id] === 'boolean' ? savedMap[mod.id] : true
    }));
  }

  private saveAndEmit(modules: WorkspaceModuleItem[]): void {
    const mapToSave: Record<string, boolean> = {};
    for (const m of modules) {
      mapToSave[m.id] = m.enabled;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapToSave));
    } catch {
      // Ignorar errores de almacenamiento
    }
    this.modulesSubject.next(modules);
  }
}

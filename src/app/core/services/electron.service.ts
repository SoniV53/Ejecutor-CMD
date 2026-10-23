import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class ElectronService {
  readonly isElectron: boolean;
  private ipcRenderer: any = null;

  private readonly viewMap: Record<string, string> = {
    'hub-view': '/hub',
    'cmd-view': '/dashboard-cmd',
    'doc-view': '/doc-generator',
    'redes-view': '/redes',
    'api-view': '/api-doc',
    'repo-view': '/repo-doc',
    'emu-view': '/emulador'
  };

  constructor(private router: Router, private ngZone: NgZone) {
    this.isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
    this.initIpcListener();
  }

  private initIpcListener(): void {
    try {
      const win = window as any;
      if (win.require) {
        const electron = win.require('electron');
        this.ipcRenderer = electron.ipcRenderer;
        if (this.ipcRenderer) {
          this.ipcRenderer.on('navigate', (_event: any, targetView: string) => {
            const route = this.viewMap[targetView] || (targetView.startsWith('/') ? targetView : `/${targetView}`);
            this.ngZone.run(() => {
              this.router.navigateByUrl(route);
            });
          });
        }
      }
    } catch {
      // Ejecutándose en navegador estándar o con contextIsolation
    }
  }

  setRunInBackground(enabled: boolean): void {
    try {
      if (this.ipcRenderer) {
        this.ipcRenderer.send('set-run-in-background', enabled);
      }
    } catch {
      // Ignorar si no está en Electron
    }
  }

  async selectDirectory(defaultPath?: string): Promise<string | null> {
    try {
      if (this.ipcRenderer) {
        return await this.ipcRenderer.invoke('select-directory', defaultPath);
      }
      const win = window as any;
      if (win.require) {
        const electron = win.require('electron');
        if (electron && electron.ipcRenderer) {
          return await electron.ipcRenderer.invoke('select-directory', defaultPath);
        }
      }
    } catch (e) {
      console.warn('Error en Electron selectDirectory:', e);
    }
    return null;
  }

  async openExternal(url: string): Promise<boolean> {
    try {
      if (this.ipcRenderer) {
        return await this.ipcRenderer.invoke('open-external-url', url);
      }
      const win = window as any;
      if (win.require) {
        const electron = win.require('electron');
        if (electron?.shell) {
          await electron.shell.openExternal(url);
          return true;
        }
      }
    } catch (e) {
      console.warn('Error en Electron openExternal:', e);
    }
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
      return true;
    }
    return false;
  }
}


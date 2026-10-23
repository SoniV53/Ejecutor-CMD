import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ElectronService } from './electron.service';

export interface GoogleUserProfile {
  name: string;
  email: string;
  picture: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  size?: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSync: number | null;
  message: string;
  error?: string | null;
}

export interface LocalSyncBundle {
  status: string;
  timestamp: number;
  counts: { json: number; bat: number; api_docs: number };
  data: {
    json: Array<{ name: string; relativePath: string; content: string; mtime?: number }>;
    bat: Array<{ name: string; relativePath: string; content: string; mtime?: number }>;
    api_docs: Array<{ name: string; relativePath: string; content: string; mtime?: number }>;
  };
}

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService {
  readonly APP_FOLDER_NAME = 'Workspace-Hub';

  private accessToken: string | null = null;
  private cachedRootFolderId: string | null = null;
  private currentUser: GoogleUserProfile | null = null;

  // Estado reactivo de sesión y sincronización
  private userSubject = new BehaviorSubject<GoogleUserProfile | null>(null);
  public user$ = this.userSubject.asObservable();

  private syncSubject = new BehaviorSubject<SyncStatus>({
    isSyncing: false,
    lastSync: null,
    message: 'Listo'
  });
  public syncStatus$: Observable<SyncStatus> = this.syncSubject.asObservable();

  constructor(private electronService: ElectronService) {
    this.restoreSession();
    this.checkBackendSession();
  }

  // --- SESIÓN Y AUTENTICACIÓN VÍA NAVEGADOR ---

  private restoreSession(): void {
    try {
      const savedUser = localStorage.getItem('gdrive_user');
      const savedLastSync = localStorage.getItem('gdrive_last_sync');

      if (savedUser) {
        this.currentUser = JSON.parse(savedUser);
        this.userSubject.next(this.currentUser);
      }

      if (savedLastSync) {
        this.syncSubject.next({
          ...this.syncSubject.value,
          lastSync: parseInt(savedLastSync, 10)
        });
      }
    } catch {
      this.clearSession();
    }
  }

  async checkBackendSession(): Promise<boolean> {
    try {
      const res = await fetch('/api/auth/google/status');
      if (res.ok) {
        const data = await res.json();
        if (data.isLoggedIn && data.user) {
          this.currentUser = data.user;
          this.accessToken = data.token || null;
          this.userSubject.next(this.currentUser);
          localStorage.setItem('gdrive_user', JSON.stringify(this.currentUser));
          return true;
        } else {
          this.clearSession();
          return false;
        }
      }
    } catch (e) {
      console.warn('Error verificando sesión de Google en backend:', e);
    }
    return false;
  }

  isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  getUser(): GoogleUserProfile | null {
    return this.currentUser;
  }

  get lastSyncTime(): number | null {
    return this.syncSubject.value.lastSync;
  }

  clearSession(): void {
    this.accessToken = null;
    this.currentUser = null;
    this.cachedRootFolderId = null;
    this.userSubject.next(null);
    localStorage.removeItem('gdrive_user');
  }

  /**
   * Inicia el proceso de autenticación abriendo el navegador predeterminado del sistema (Chrome, Edge, etc.)
   */
  async login(): Promise<GoogleUserProfile> {
    const loginUrl = 'http://localhost:3000/api/auth/google/login';
    await this.electronService.openExternal(loginUrl);

    // Esperar y consultar periódicamente el estado hasta que el usuario complete el login en el navegador
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 80; // ~2 minutos de espera
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch('/api/auth/google/status');
          if (res.ok) {
            const data = await res.json();
            if (data.isLoggedIn && data.user) {
              clearInterval(interval);
              this.currentUser = data.user;
              this.accessToken = data.token || null;
              this.userSubject.next(this.currentUser);
              localStorage.setItem('gdrive_user', JSON.stringify(this.currentUser));
              resolve(this.currentUser);
              return;
            }
          }
        } catch {}

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Tiempo de espera agotado para el inicio de sesión en el navegador.'));
        }
      }, 1500);
    });
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/google/logout', { method: 'POST' });
    } catch {}
    this.clearSession();
  }

  private async getFreshToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const res = await fetch('/api/auth/google/token');
    if (!res.ok) throw new Error('No se pudo obtener el token de Google');
    const data = await res.json();
    if (!data.token) {
      this.clearSession();
      throw new Error('La sesión de Google Drive ha expirado. Por favor, conéctate nuevamente.');
    }
    this.accessToken = data.token;
    return this.accessToken!;
  }

  // --- CLIENTE BASE DE GOOGLE DRIVE API V3 ---

  private async driveFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getFreshToken();

    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);

    const res = await fetch(`https://www.googleapis.com/drive/v3/${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      // Intentar refrescar token
      this.accessToken = null;
      const fresh = await this.getFreshToken();
      headers.set('Authorization', `Bearer ${fresh}`);
      return await fetch(`https://www.googleapis.com/drive/v3/${endpoint}`, {
        ...options,
        headers
      });
    }

    return res;
  }

  /**
   * Obtiene o crea la carpeta raíz principal en Google Drive: 'Workspace-Hub'
   */
  async getOrCreateAppFolder(): Promise<string> {
    if (this.cachedRootFolderId) return this.cachedRootFolderId;

    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${this.APP_FOLDER_NAME}' and trashed = false`;
    const res = await this.driveFetch(`files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    if (!res.ok) throw new Error('Error buscando carpeta en Google Drive');

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      this.cachedRootFolderId = data.files[0].id;
      return this.cachedRootFolderId!;
    }

    // Crear carpeta raíz si no existe
    const createRes = await this.driveFetch('files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: this.APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    if (!createRes.ok) throw new Error('No se pudo crear la carpeta raíz Workspace-Hub en Google Drive');
    const newFolder = await createRes.json();
    this.cachedRootFolderId = newFolder.id;
    return this.cachedRootFolderId!;
  }

  /**
   * Obtiene o crea una subcarpeta dentro de un padre
   */
  async getOrCreateSubfolder(parentId: string, folderName: string): Promise<string> {
    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and '${parentId}' in parents and trashed = false`;
    const res = await this.driveFetch(`files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
    }

    // Crear la subcarpeta
    const createRes = await this.driveFetch('files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      })
    });

    if (!createRes.ok) throw new Error(`No se pudo crear la subcarpeta ${folderName}`);
    const folder = await createRes.json();
    return folder.id;
  }

  // --- SINCRONIZACIÓN GLOBAL DE TODA LA APP (api_docs, bat, json) ---

  async uploadFullWorkspaceToDrive(): Promise<{ uploaded: number; message: string }> {
    if (!this.isLoggedIn()) {
      throw new Error('Debes conectar tu cuenta de Google para respaldar.');
    }

    this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Obteniendo datos locales...' });

    try {
      const resLocal = await fetch('/api/sync/bundle');
      if (!resLocal.ok) throw new Error('Error al leer archivos locales');
      const bundle: LocalSyncBundle = await resLocal.json();

      this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Conectando con Google Drive...' });
      const rootId = await this.getOrCreateAppFolder();
      const jsonFolderId = await this.getOrCreateSubfolder(rootId, 'json');
      const batFolderId = await this.getOrCreateSubfolder(rootId, 'bat');
      const docsFolderId = await this.getOrCreateSubfolder(rootId, 'api_docs');

      let uploadedCount = 0;

      // Subir archivos JSON
      this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Sincronizando configuraciones (json)...' });
      for (const item of bundle.data.json) {
        await this.uploadOrUpdateFile(jsonFolderId, item.name, item.content);
        uploadedCount++;
      }

      // Subir archivos BAT
      this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Sincronizando scripts (bat)...' });
      for (const item of bundle.data.bat) {
        await this.uploadOrUpdateFile(batFolderId, item.name, item.content);
        uploadedCount++;
      }

      // Subir archivos API_DOCS
      this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Sincronizando notas y documentación (api_docs)...' });
      for (const item of bundle.data.api_docs) {
        const parts = (item.relativePath || item.name).split('/').filter(Boolean);
        let currentParent = docsFolderId;
        while (parts.length > 1) {
          const subDirName = parts.shift()!;
          currentParent = await this.getOrCreateSubfolder(currentParent, subDirName);
        }
        const fileName = parts[0];
        await this.uploadOrUpdateFile(currentParent, fileName, item.content);
        uploadedCount++;
      }

      const now = Date.now();
      localStorage.setItem('gdrive_last_sync', now.toString());

      this.syncSubject.next({
        isSyncing: false,
        lastSync: now,
        message: `${uploadedCount} archivos respaldados exitosamente en Google Drive.`
      });

      return {
        uploaded: uploadedCount,
        message: `${uploadedCount} archivos respaldados exitosamente en Google Drive`
      };
    } catch (err: any) {
      this.syncSubject.next({
        isSyncing: false,
        lastSync: this.syncSubject.value.lastSync,
        message: 'Error en la sincronización',
        error: err.message || err
      });
      throw err;
    }
  }

  async downloadFullWorkspaceFromDrive(): Promise<{ downloaded: number; message: string }> {
    if (!this.isLoggedIn()) {
      throw new Error('Debes conectar tu cuenta de Google para restaurar.');
    }

    this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Consultando Google Drive...' });

    try {
      const rootId = await this.getOrCreateAppFolder();

      const q = `trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
      const fields = 'files(id, name, mimeType, parents)';
      const res = await this.driveFetch(`files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=1000`);
      if (!res.ok) throw new Error('Error al listar archivos en Drive');
      const data = await res.json();
      const files: GoogleDriveFile[] = data.files || [];

      const jsonFolderId = await this.getOrCreateSubfolder(rootId, 'json');
      const batFolderId = await this.getOrCreateSubfolder(rootId, 'bat');
      const docsFolderId = await this.getOrCreateSubfolder(rootId, 'api_docs');

      const jsonFilesToRestore: Array<{ name: string; content: string }> = [];
      const batFilesToRestore: Array<{ name: string; content: string }> = [];
      const docFilesToRestore: Array<{ relativePath: string; content: string }> = [];

      for (const f of files) {
        if (!f.parents || f.parents.length === 0) continue;
        const parentId = f.parents[0];

        if (parentId === jsonFolderId) {
          const content = await this.readFile(f.id);
          jsonFilesToRestore.push({ name: f.name, content });
        } else if (parentId === batFolderId) {
          const content = await this.readFile(f.id);
          batFilesToRestore.push({ name: f.name, content });
        } else {
          const content = await this.readFile(f.id);
          docFilesToRestore.push({ relativePath: f.name, content });
        }
      }

      this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Guardando archivos en el disco local...' });
      const restoreRes = await fetch('/api/sync/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            json: jsonFilesToRestore,
            bat: batFilesToRestore,
            api_docs: docFilesToRestore
          }
        })
      });

      if (!restoreRes.ok) throw new Error('Error al restaurar archivos localmente');
      const restoreData = await restoreRes.json();

      const now = Date.now();
      localStorage.setItem('gdrive_last_sync', now.toString());

      this.syncSubject.next({
        isSyncing: false,
        lastSync: now,
        message: `${restoreData.writtenCount || files.length} archivos restaurados exitosamente en local.`
      });

      return {
        downloaded: restoreData.writtenCount || files.length,
        message: 'Archivos sincronizados desde la nube a tu máquina local'
      };
    } catch (err: any) {
      this.syncSubject.next({
        isSyncing: false,
        lastSync: this.syncSubject.value.lastSync,
        message: 'Error al descargar de Google Drive',
        error: err.message || err
      });
      throw err;
    }
  }

  private async readFile(fileId: string): Promise<string> {
    const res = await this.driveFetch(`files/${fileId}?alt=media`);
    if (!res.ok) throw new Error(`Error al leer archivo (${res.status})`);
    return await res.text();
  }

  private async uploadOrUpdateFile(parentId: string, fileName: string, content: string): Promise<string> {
    const q = `'${parentId}' in parents and name = '${fileName.replace(/'/g, "\\'")}' and trashed = false`;
    const searchRes = await this.driveFetch(`files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const fileId = searchData.files[0].id;
        const token = await this.getFreshToken();
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'text/plain; charset=UTF-8'
          },
          body: content
        });
        return fileId;
      }
    }

    const metadata = {
      name: fileName,
      parents: [parentId]
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
      content +
      closeDelimiter;

    const token = await this.getFreshToken();
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!res.ok) throw new Error(`Error al crear archivo ${fileName} en Google Drive`);
    const created = await res.json();
    return created.id;
  }
}

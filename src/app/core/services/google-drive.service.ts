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

export interface LocalSyncFileItem {
  name: string;
  relativePath: string;
  content: string;
  mtime?: number;
  size?: number;
}

export interface LocalSyncFolderEntry {
  name: string;
  fileCount: number;
  files: LocalSyncFileItem[];
}

export interface LocalSyncBundle {
  status: string;
  timestamp: number;
  baseDir?: string;
  folders?: LocalSyncFolderEntry[];
  counts: Record<string, number>;
  data: Record<string, LocalSyncFileItem[]>;
}

@Injectable({
  providedIn: 'root'
})
export class GoogleDriveService {
  readonly APP_FOLDER_NAME = 'Workspace-Hub';
  private readonly baseUrl: string;

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
    this.baseUrl =
      window.location.protocol === 'file:' || window.location.port === '4200'
        ? 'http://localhost:3000'
        : window.location.origin;
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
      const res = await fetch(`${this.baseUrl}/api/auth/google/status`);
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
    const loginUrl = `${this.baseUrl}/api/auth/google/login`;
    await this.electronService.openExternal(loginUrl);

    // Esperar y consultar periódicamente el estado hasta que el usuario complete el login en el navegador
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 80; // ~2 minutos de espera
      const interval = setInterval(async () => {
        attempts++;
        try {
          const res = await fetch(`${this.baseUrl}/api/auth/google/status`);
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
      await fetch(`${this.baseUrl}/api/auth/google/logout`, { method: 'POST' });
    } catch {}
    this.clearSession();
  }

  private async getFreshToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const res = await fetch(`${this.baseUrl}/api/auth/google/token`);
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

  // --- SINCRONIZACIÓN GLOBAL DE TODAS LAS CARPETAS DE LA APP ---

  private readonly ignoredSystemDirs = new Set([
    'node_modules',
    'src',
    'dist',
    'release',
    'out',
    'build',
    'controllers',
    'scripts',
    'assets',
    'tasks',
    'resources',
    'locales',
    'swiftshader',
    'win-unpacked',
    '.git',
    '.angular',
    '.vscode',
    '.gemini',
    '.idea',
    '.github'
  ]);

  private flattenDocTree(nodes: any[]): Array<{ name: string; relativePath: string }> {
    let result: Array<{ name: string; relativePath: string }> = [];
    for (const node of nodes || []) {
      if (node.isFolder) {
        result = result.concat(this.flattenDocTree(node.children || []));
      } else {
        result.push({
          name: node.name,
          relativePath: (node.path || node.name).replace(/\\/g, '/')
        });
      }
    }
    return result;
  }

  async getLocalWorkspaceFiles(): Promise<LocalSyncBundle> {
    const resLocal = await fetch(`${this.baseUrl}/api/sync/bundle`, { cache: 'no-store' });
    if (!resLocal.ok) throw new Error('Error al leer archivos locales de las carpetas de la app');
    const bundle: LocalSyncBundle = await resLocal.json();

    // Si el servidor en memoria ya devuelve bundle.folders con todas las carpetas dinámicas, retornarlo directo
    if (bundle.folders && Array.isArray(bundle.folders)) {
      return bundle;
    }

    // Respaldo dinámico: si el proceso de Node se inició antes de actualizar syncController.js,
    // escanear el directorio raíz de la app vía /api/doc/info y /api/doc/browse-dirs para incluir cualquier carpeta nueva (ej. notas/)
    try {
      const infoRes = await fetch(`${this.baseUrl}/api/doc/info?_t=${Date.now()}`);
      if (infoRes.ok) {
        const info = await infoRes.json();
        const baseDir: string = info.baseDir || '';
        if (baseDir) {
          const browseRes = await fetch(
            `${this.baseUrl}/api/doc/browse-dirs?path=${encodeURIComponent(baseDir)}&_t=${Date.now()}`
          );
          if (browseRes.ok) {
            const browseData = await browseRes.json();
            const dirs: Array<{ name: string; path: string }> = browseData.directories || [];
            const userDirs = dirs.filter(
              (d) =>
                d.name &&
                !d.name.startsWith('.') &&
                !this.ignoredSystemDirs.has(d.name.toLowerCase())
            );

            const priority: Record<string, number> = { api_docs: 1, bat: 2, json: 3 };
            userDirs.sort((a, b) => {
              const pa = priority[a.name.toLowerCase()] || 99;
              const pb = priority[b.name.toLowerCase()] || 99;
              if (pa !== pb) return pa - pb;
              return a.name.localeCompare(b.name);
            });

            const folders: LocalSyncFolderEntry[] = [];
            const dataMap: Record<string, LocalSyncFileItem[]> = { ...(bundle.data || {}) };

            for (const dir of userDirs) {
              const existingInBundle = bundle.data ? bundle.data[dir.name] : undefined;
              // Para carpetas nuevas (ej. notas/) o json/ (para incluir subcarpetas como json/gravity/), obtener árbol real
              const treeRes = await fetch(
                `${this.baseUrl}/api/doc/tree?root=${encodeURIComponent(dir.path)}&_t=${Date.now()}`
              );
              if (treeRes.ok) {
                const treeNodes = await treeRes.json();
                const flatFiles = this.flattenDocTree(treeNodes);
                const filesWithContent: LocalSyncFileItem[] = [];

                for (const f of flatFiles) {
                  const foundExisting = (existingInBundle || []).find(
                    (ex) => (ex.relativePath || ex.name) === f.relativePath
                  );
                  if (foundExisting && typeof foundExisting.content === 'string') {
                    filesWithContent.push({
                      name: f.name,
                      relativePath: f.relativePath,
                      content: foundExisting.content
                    });
                  } else {
                    try {
                      const readRes = await fetch(
                        `${this.baseUrl}/api/doc/read?path=${encodeURIComponent(f.relativePath)}&root=${encodeURIComponent(dir.path)}&_t=${Date.now()}`
                      );
                      if (readRes.ok) {
                        const readData = await readRes.json();
                        filesWithContent.push({
                          name: f.name,
                          relativePath: f.relativePath,
                          content: readData.content || ''
                        });
                      }
                    } catch {}
                  }
                }

                dataMap[dir.name] = filesWithContent;
                folders.push({
                  name: dir.name,
                  fileCount: filesWithContent.length,
                  files: filesWithContent
                });
              } else if (existingInBundle) {
                folders.push({
                  name: dir.name,
                  fileCount: existingInBundle.length,
                  files: existingInBundle
                });
              }
            }

            bundle.folders = folders;
            bundle.data = dataMap;
          }
        }
      }
    } catch {}

    return bundle;
  }

  async uploadFullWorkspaceToDrive(
    selectedKeys?: Set<string>,
    selectedFolders?: Set<string>
  ): Promise<{ uploaded: number; message: string }> {
    if (!this.isLoggedIn()) {
      throw new Error('Debes conectar tu cuenta de Google para respaldar.');
    }

    this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Obteniendo carpetas y archivos locales...' });

    try {
      const bundle = await this.getLocalWorkspaceFiles();
      const folderEntries: LocalSyncFolderEntry[] =
        bundle.folders && bundle.folders.length > 0
          ? bundle.folders
          : Object.keys(bundle.data || {}).map((name) => ({
              name,
              fileCount: (bundle.data[name] || []).length,
              files: bundle.data[name] || []
            }));

      // Preparar qué carpetas y archivos se van a subir
      const uploadPlan: Array<{ folderName: string; files: LocalSyncFileItem[] }> = [];
      let totalSelectedFiles = 0;

      for (const folder of folderEntries) {
        const folderFiles = folder.files || [];
        const filteredFiles = selectedKeys
          ? folderFiles.filter((item) => selectedKeys.has(`${folder.name}:${item.relativePath || item.name}`))
          : folderFiles;

        const isFolderExplicitlySelected = selectedFolders ? selectedFolders.has(folder.name) : true;
        if (filteredFiles.length > 0 || (folderFiles.length === 0 && isFolderExplicitlySelected)) {
          uploadPlan.push({ folderName: folder.name, files: filteredFiles });
          totalSelectedFiles += filteredFiles.length;
        }
      }

      if (uploadPlan.length === 0) {
        this.syncSubject.next({
          isSyncing: false,
          lastSync: this.syncSubject.value.lastSync,
          message: 'No seleccionaste ninguna carpeta ni archivo para subir.'
        });
        return { uploaded: 0, message: 'No seleccionaste ninguna carpeta ni archivo para subir.' };
      }

      this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Conectando con Google Drive...' });
      const rootId = await this.getOrCreateAppFolder();

      let uploadedCount = 0;
      let uploadedFoldersCount = 0;

      for (const plan of uploadPlan) {
        this.syncSubject.next({
          ...this.syncSubject.value,
          isSyncing: true,
          message: `Sincronizando carpeta ${plan.folderName}/...`
        });

        const topFolderId = await this.getOrCreateSubfolder(rootId, plan.folderName);
        uploadedFoldersCount++;

        for (const item of plan.files) {
          const parts = (item.relativePath || item.name).split('/').filter(Boolean);
          let currentParent = topFolderId;
          while (parts.length > 1) {
            const subDirName = parts.shift()!;
            currentParent = await this.getOrCreateSubfolder(currentParent, subDirName);
          }
          const fileName = parts[0];
          await this.uploadOrUpdateFile(currentParent, fileName, item.content);
          uploadedCount++;
        }
      }

      const now = Date.now();
      localStorage.setItem('gdrive_last_sync', now.toString());

      const summaryMsg = `${uploadedCount} archivo(s) en ${uploadedFoldersCount} carpeta(s) respaldados en Google Drive.`;
      this.syncSubject.next({
        isSyncing: false,
        lastSync: now,
        message: summaryMsg
      });

      return {
        uploaded: uploadedCount,
        message: summaryMsg
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

      const q = `trashed = false`;
      const fields = 'files(id, name, mimeType, parents)';
      const res = await this.driveFetch(`files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&pageSize=1000`);
      if (!res.ok) throw new Error('Error al listar archivos en Drive');
      const data = await res.json();
      const allItems: GoogleDriveFile[] = data.files || [];

      const folderMap = new Map<string, GoogleDriveFile>();
      const topLevelFoldersById = new Map<string, string>(); // folderId -> folderName dentro de Workspace-Hub
      const files: GoogleDriveFile[] = [];

      for (const item of allItems) {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          folderMap.set(item.id, item);
          if (item.parents && item.parents.includes(rootId)) {
            topLevelFoldersById.set(item.id, item.name);
          }
        } else {
          files.push(item);
        }
      }

      const resolveRelativeToTopFolder = (
        file: GoogleDriveFile
      ): { bucket: string | null; relativePath: string } => {
        const parts: string[] = [file.name];
        let currentParentId = file.parents && file.parents.length > 0 ? file.parents[0] : null;
        let safety = 0;
        while (currentParentId && safety < 25) {
          safety++;
          if (topLevelFoldersById.has(currentParentId)) {
            return {
              bucket: topLevelFoldersById.get(currentParentId)!,
              relativePath: parts.join('/')
            };
          }
          const parentFolder = folderMap.get(currentParentId);
          if (!parentFolder) break;
          parts.unshift(parentFolder.name);
          currentParentId =
            parentFolder.parents && parentFolder.parents.length > 0 ? parentFolder.parents[0] : null;
        }
        return { bucket: null, relativePath: file.name };
      };

      const filesByFolder: Record<string, Array<{ name: string; relativePath: string; content: string }>> = {};
      const emptyFolders: string[] = Array.from(topLevelFoldersById.values());

      for (const f of files) {
        const resolved = resolveRelativeToTopFolder(f);
        if (!resolved.bucket) continue;

        const content = await this.readFile(f.id);
        if (!filesByFolder[resolved.bucket]) {
          filesByFolder[resolved.bucket] = [];
        }
        filesByFolder[resolved.bucket].push({
          name: f.name,
          relativePath: resolved.relativePath,
          content
        });
      }

      this.syncSubject.next({ ...this.syncSubject.value, isSyncing: true, message: 'Guardando carpetas y archivos en el disco local...' });
      const restoreRes = await fetch(`${this.baseUrl}/api/sync/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emptyFolders,
          data: filesByFolder
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
        message: 'Carpetas y archivos sincronizados desde la nube a tu máquina local'
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

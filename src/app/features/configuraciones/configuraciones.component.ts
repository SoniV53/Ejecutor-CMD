import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  WorkspaceSettingsService,
  WorkspaceModuleItem
} from '../../core/services/workspace-settings.service';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { GoogleDriveService, GoogleUserProfile, SyncStatus } from '../../core/services/google-drive.service';

@Component({
  selector: 'app-configuraciones',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './configuraciones.component.html',
  styleUrls: ['./configuraciones.component.css']
})
export class ConfiguracionesComponent implements OnInit, OnDestroy, AfterViewInit {
  modules: WorkspaceModuleItem[] = [];
  enabledCount = 0;
  runInBackground = true;

  // Google Drive
  isLoggedIn = false;
  user: GoogleUserProfile | null = null;
  syncStatus: SyncStatus = { isSyncing: false, lastSync: null, message: 'Listo' };
  showFileSelector = false;
  detectedFolders: Array<{
    name: string;
    fileCount: number;
    selected: boolean;
  }> = [];
  localFiles: Array<{
    key: string;
    bucket: string;
    name: string;
    relativePath: string;
    selected: boolean;
  }> = [];
  isLoadingLocalFiles = false;
  activeBucketFilter = 'all';

  toastMsg = '';
  toastVisible = false;
  private toastTimeout: any;
  private subs = new Subscription();

  constructor(
    private settingsService: WorkspaceSettingsService,
    private lucide: LucideIconService,
    public googleDrive: GoogleDriveService
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.settingsService.modules$.subscribe(mods => {
        this.modules = mods;
        this.enabledCount = mods.filter(m => m.enabled).length;
        this.lucide.refresh();
      })
    );

    this.subs.add(
      this.settingsService.runInBackground$.subscribe(val => {
        this.runInBackground = val;
        this.lucide.refresh();
      })
    );

    this.subs.add(
      this.googleDrive.user$.subscribe(u => {
        this.user = u;
        this.isLoggedIn = !!u;
        this.lucide.refresh();
      })
    );

    this.subs.add(
      this.googleDrive.syncStatus$.subscribe(status => {
        this.syncStatus = status;
        this.lucide.refresh();
      })
    );

    this.loadLocalFiles();
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  trackByModuleId(_index: number, mod: WorkspaceModuleItem): string {
    return mod.id;
  }

  onToggleModule(id: string): void {
    this.settingsService.toggleModule(id);
  }

  onToggleRunInBackground(): void {
    this.settingsService.toggleRunInBackground();
  }

  onEnableAll(): void {
    this.settingsService.enableAllModules();
  }

  async loginGoogle(): Promise<void> {
    try {
      await this.googleDrive.login();
      this.showToast('Conectado con Google Drive');
      setTimeout(() => this.lucide.refresh(), 50);
    } catch (err: any) {
      this.showToast('Error al conectar: ' + (err.message || err));
    }
  }

  logoutGoogle(): void {
    this.googleDrive.logout();
    this.showToast('Sesión de Google cerrada');
    setTimeout(() => this.lucide.refresh(), 50);
  }

  toggleFileSelector(): void {
    this.showFileSelector = !this.showFileSelector;
    if (this.showFileSelector) {
      this.loadLocalFiles();
    }
    setTimeout(() => this.lucide.refresh(), 40);
  }

  async loadLocalFiles(): Promise<void> {
    this.isLoadingLocalFiles = true;
    try {
      const bundle = await this.googleDrive.getLocalWorkspaceFiles();
      const prevUnselectedFiles = new Set(
        this.localFiles.filter(f => !f.selected).map(f => f.key)
      );
      const prevUnselectedFolders = new Set(
        this.detectedFolders.filter(fl => !fl.selected).map(fl => fl.name)
      );

      const folderEntries =
        bundle.folders && bundle.folders.length > 0
          ? bundle.folders
          : Object.keys(bundle.data || {}).map(name => ({
              name,
              fileCount: (bundle.data[name] || []).length,
              files: bundle.data[name] || []
            }));

      const foldersList: Array<{ name: string; fileCount: number; selected: boolean }> = [];
      const list: Array<{
        key: string;
        bucket: string;
        name: string;
        relativePath: string;
        selected: boolean;
      }> = [];

      for (const folder of folderEntries) {
        const folderSelected = !prevUnselectedFolders.has(folder.name);
        const items = folder.files || [];

        foldersList.push({
          name: folder.name,
          fileCount: items.length,
          selected: folderSelected
        });

        for (const item of items) {
          const rel = item.relativePath || item.name;
          const key = `${folder.name}:${rel}`;
          list.push({
            key,
            bucket: folder.name,
            name: item.name,
            relativePath: `${folder.name}/${rel}`,
            selected: folderSelected && !prevUnselectedFiles.has(key)
          });
        }
      }

      this.detectedFolders = foldersList;
      this.localFiles = list;
    } catch {
      // Ignorar error de red
    } finally {
      this.isLoadingLocalFiles = false;
      setTimeout(() => this.lucide.refresh(), 40);
    }
  }

  get filteredLocalFiles() {
    if (this.activeBucketFilter === 'all') return this.localFiles;
    return this.localFiles.filter(f => f.bucket === this.activeBucketFilter);
  }

  get selectedFilesCount(): number {
    return this.localFiles.filter(f => f.selected).length;
  }

  get selectedFoldersCount(): number {
    return this.detectedFolders.filter(fl => fl.selected).length;
  }

  toggleFolderSelection(
    folder: { name: string; fileCount: number; selected: boolean },
    event?: Event
  ): void {
    if (event) event.stopPropagation();
    folder.selected = !folder.selected;
    for (const file of this.localFiles) {
      if (file.bucket === folder.name) {
        file.selected = folder.selected;
      }
    }
  }

  toggleFileItemSelection(file: { bucket: string; selected: boolean }): void {
    file.selected = !file.selected;
    const parentFolder = this.detectedFolders.find(fl => fl.name === file.bucket);
    if (parentFolder) {
      parentFolder.selected = this.localFiles.some(
        f => f.bucket === file.bucket && f.selected
      );
    }
  }

  selectAllFiles(selected: boolean): void {
    if (this.activeBucketFilter === 'all') {
      for (const fl of this.detectedFolders) {
        fl.selected = selected;
      }
      for (const f of this.localFiles) {
        f.selected = selected;
      }
    } else {
      const targetFolder = this.detectedFolders.find(fl => fl.name === this.activeBucketFilter);
      if (targetFolder) targetFolder.selected = selected;
      for (const f of this.filteredLocalFiles) {
        f.selected = selected;
      }
    }
  }

  async syncUpload(): Promise<void> {
    try {
      let selectedKeys: Set<string> | undefined;
      let selectedFolders: Set<string> | undefined;
      if (this.localFiles.length > 0 || this.detectedFolders.length > 0) {
        selectedKeys = new Set(this.localFiles.filter(f => f.selected).map(f => f.key));
        selectedFolders = new Set(
          this.detectedFolders.filter(fl => fl.selected).map(fl => fl.name)
        );
        if (selectedKeys.size === 0 && selectedFolders.size === 0) {
          this.showToast('Selecciona al menos una carpeta o archivo para subir');
          return;
        }
      }
      const res = await this.googleDrive.uploadFullWorkspaceToDrive(
        selectedKeys,
        selectedFolders
      );
      this.showToast(res.message);
    } catch (err: any) {
      this.showToast('Error al subir: ' + (err.message || err));
    }
  }

  async syncDownload(): Promise<void> {
    try {
      const res = await this.googleDrive.downloadFullWorkspaceFromDrive();
      if (this.showFileSelector) {
        await this.loadLocalFiles();
      }
      this.showToast(res.message);
    } catch (err: any) {
      this.showToast('Error al descargar: ' + (err.message || err));
    }
  }

  formatLastSync(timestamp: number | null): string {
    if (!timestamp) return 'Nunca';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} minutos`;
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} a las ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  showToast(msg: string): void {
    this.toastMsg = msg;
    this.toastVisible = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastVisible = false;
    }, 3500);
  }

  getIconBgClass(color: string, enabled: boolean): string {
    if (!enabled) {
      return 'bg-slate-800/60 text-slate-500 border-slate-700/60';
    }
    const map: Record<string, string> = {
      indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
      sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    };
    return map[color] || map['indigo'];
  }
}

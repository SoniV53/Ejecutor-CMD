import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LucideIconService } from '../../services/lucide-icon.service';
import { WorkspaceSettingsService } from '../../services/workspace-settings.service';
import { GoogleDriveService, GoogleUserProfile, SyncStatus } from '../../services/google-drive.service';

export interface NavItem {
  route: string;
  title: string;
  icon: string;
}

export interface SelectableSyncFolder {
  name: string;
  fileCount: number;
  selected: boolean;
}

export interface SelectableSyncFile {
  key: string;
  bucket: string;
  folderLabel: string;
  name: string;
  relativePath: string;
  selected: boolean;
}

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-nav.component.html',
  styleUrls: ['./sidebar-nav.component.css']
})
export class SidebarNavComponent implements OnInit, OnDestroy, AfterViewInit {
  navItems: NavItem[] = [];
  private subs = new Subscription();

  // Estado de Google Drive
  isLoggedIn = false;
  user: GoogleUserProfile | null = null;
  syncStatus: SyncStatus = { isSyncing: false, lastSync: null, message: 'Listo' };
  showSyncModal = false;

  // Selector de todas las carpetas y archivos donde está ubicada la app
  detectedFolders: SelectableSyncFolder[] = [];
  localFiles: SelectableSyncFile[] = [];
  isLoadingLocalFiles = false;
  activeBucketFilter = 'all';

  toastMsg = '';
  toastVisible = false;
  private toastTimeout: any;

  constructor(
    private router: Router,
    private lucide: LucideIconService,
    private settingsService: WorkspaceSettingsService,
    public googleDrive: GoogleDriveService
  ) {
    this.subs.add(
      this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => {
          this.lucide.refresh();
        })
    );
  }

  ngOnInit(): void {
    this.subs.add(
      this.settingsService.modules$.subscribe((modules) => {
        this.navItems = [
          { route: '/hub', title: 'Inicio (Hub)', icon: 'grid' },
          ...modules
            .filter((m) => m.enabled)
            .map((m) => ({
              route: m.route,
              title: m.shortTitle,
              icon: m.icon
            }))
        ];
        this.lucide.refresh();
      })
    );

    // Suscripción al estado del usuario de Google
    this.subs.add(
      this.googleDrive.user$.subscribe((u) => {
        this.user = u;
        this.isLoggedIn = !!u;
        this.lucide.refresh();
      })
    );

    // Suscripción al estado de sincronización
    this.subs.add(
      this.googleDrive.syncStatus$.subscribe((status) => {
        this.syncStatus = status;
        this.lucide.refresh();
      })
    );
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
  }

  trackByRoute(_index: number, item: NavItem): string {
    return item.route;
  }

  toggleSyncModal(): void {
    this.showSyncModal = !this.showSyncModal;
    if (this.showSyncModal) {
      this.loadLocalFiles();
    }
    setTimeout(() => this.lucide.refresh(), 50);
  }

  async loadLocalFiles(): Promise<void> {
    this.isLoadingLocalFiles = true;
    try {
      const bundle = await this.googleDrive.getLocalWorkspaceFiles();
      const prevUnselectedFiles = new Set(
        this.localFiles.filter((f) => !f.selected).map((f) => f.key)
      );
      const prevUnselectedFolders = new Set(
        this.detectedFolders.filter((fl) => !fl.selected).map((fl) => fl.name)
      );

      const folderEntries =
        bundle.folders && bundle.folders.length > 0
          ? bundle.folders
          : Object.keys(bundle.data || {}).map((name) => ({
              name,
              fileCount: (bundle.data[name] || []).length,
              files: bundle.data[name] || []
            }));

      const foldersList: SelectableSyncFolder[] = [];
      const filesList: SelectableSyncFile[] = [];

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
          filesList.push({
            key,
            bucket: folder.name,
            folderLabel: `${folder.name}/`,
            name: item.name,
            relativePath: `${folder.name}/${rel}`,
            selected: folderSelected && !prevUnselectedFiles.has(key)
          });
        }
      }

      this.detectedFolders = foldersList;
      this.localFiles = filesList;
    } catch (err) {
      console.warn('No se pudieron listar carpetas y archivos locales:', err);
    } finally {
      this.isLoadingLocalFiles = false;
      setTimeout(() => this.lucide.refresh(), 50);
    }
  }

  get filteredLocalFiles(): SelectableSyncFile[] {
    if (this.activeBucketFilter === 'all') return this.localFiles;
    return this.localFiles.filter((f) => f.bucket === this.activeBucketFilter);
  }

  get selectedFilesCount(): number {
    return this.localFiles.filter((f) => f.selected).length;
  }

  get selectedFoldersCount(): number {
    return this.detectedFolders.filter((fl) => fl.selected).length;
  }

  get canUploadSelection(): boolean {
    return this.selectedFilesCount > 0 || this.selectedFoldersCount > 0;
  }

  getBucketCount(bucket: string): number {
    return this.localFiles.filter((f) => f.bucket === bucket).length;
  }

  setBucketFilter(filter: string): void {
    this.activeBucketFilter = filter;
  }

  toggleFolderSelection(folder: SelectableSyncFolder, event?: Event): void {
    if (event) event.stopPropagation();
    folder.selected = !folder.selected;
    for (const file of this.localFiles) {
      if (file.bucket === folder.name) {
        file.selected = folder.selected;
      }
    }
  }

  toggleFileSelection(file: SelectableSyncFile): void {
    file.selected = !file.selected;
    const parentFolder = this.detectedFolders.find((fl) => fl.name === file.bucket);
    if (parentFolder) {
      const anySelectedInFolder = this.localFiles.some(
        (f) => f.bucket === file.bucket && f.selected
      );
      parentFolder.selected = anySelectedInFolder;
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
      const targetFolder = this.detectedFolders.find((fl) => fl.name === this.activeBucketFilter);
      if (targetFolder) targetFolder.selected = selected;
      for (const f of this.filteredLocalFiles) {
        f.selected = selected;
      }
    }
  }

  async loginGoogle(): Promise<void> {
    try {
      await this.googleDrive.login();
      this.showToast('Conectado con Google Drive');
      setTimeout(() => this.lucide.refresh(), 50);
    } catch (err: any) {
      this.showToast('Error: ' + (err.message || err));
    }
  }

  logoutGoogle(): void {
    this.googleDrive.logout();
    this.showToast('Sesión de Google cerrada');
    setTimeout(() => this.lucide.refresh(), 50);
  }

  async syncUpload(): Promise<void> {
    try {
      const selectedKeys = new Set(
        this.localFiles.filter((f) => f.selected).map((f) => f.key)
      );
      const selectedFolders = new Set(
        this.detectedFolders.filter((fl) => fl.selected).map((fl) => fl.name)
      );
      if (selectedKeys.size === 0 && selectedFolders.size === 0) {
        this.showToast('Selecciona al menos una carpeta o archivo para subir');
        return;
      }
      const res = await this.googleDrive.uploadFullWorkspaceToDrive(selectedKeys, selectedFolders);
      this.showToast(res.message);
    } catch (err: any) {
      this.showToast('Error al subir: ' + (err.message || err));
    }
  }

  async syncDownload(): Promise<void> {
    try {
      const res = await this.googleDrive.downloadFullWorkspaceFromDrive();
      await this.loadLocalFiles();
      this.showToast(res.message);
    } catch (err: any) {
      this.showToast('Error al descargar: ' + (err.message || err));
    }
  }

  formatLastSync(timestamp: number | null): string {
    if (!timestamp) return 'Nunca';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Hace un momento';
    if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  showToast(msg: string): void {
    this.toastMsg = msg;
    this.toastVisible = true;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastVisible = false;
    }, 3500);
  }
}

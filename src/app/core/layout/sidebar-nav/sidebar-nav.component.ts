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
    setTimeout(() => this.lucide.refresh(), 50);
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
      const res = await this.googleDrive.uploadFullWorkspaceToDrive();
      this.showToast(res.message);
    } catch (err: any) {
      this.showToast('Error al subir: ' + (err.message || err));
    }
  }

  async syncDownload(): Promise<void> {
    try {
      const res = await this.googleDrive.downloadFullWorkspaceFromDrive();
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

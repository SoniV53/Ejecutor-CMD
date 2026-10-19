import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewChild,
  AfterViewInit,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmulatorHistoryService } from '../../core/services/emulator-history.service';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { ElectronService } from '../../core/services/electron.service';
import { EmuladorHeaderComponent } from './components/emulador-header/emulador-header.component';
import { EmuladorViewportComponent } from './components/emulador-viewport/emulador-viewport.component';

@Component({
  selector: 'app-emulador',
  standalone: true,
  imports: [CommonModule, EmuladorHeaderComponent, EmuladorViewportComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './emulador.component.html',
  styleUrls: ['./emulador.component.css']
})
export class EmuladorComponent implements OnInit, AfterViewInit {
  private static readonly PREFS_KEY = 'consoleflow_emulator_prefs_v1';

  @ViewChild(EmuladorViewportComponent) viewport!: EmuladorViewportComponent;

  url = '';
  history: string[] = [];
  isHistoryOpen = false;
  isMenuVisible = true;
  currentDeviceKey = 'iphone14';
  lastDeviceKey = 'iphone14';
  isLandscape = false;
  currentZoom = 0.8;
  appZoom = 1.0;
  isConsoleOpen = false;
  isTouchEnabled = true;

  showElectronToast = false;
  electronToastMessage = '';
  toastMessage = '';
  isToastVisible = false;
  private toastTimeout: any;

  constructor(
    private historyService: EmulatorHistoryService,
    private lucideService: LucideIconService,
    public electronService: ElectronService
  ) {
    this.loadPreferences();
  }

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  ngAfterViewInit(): void {
    this.lucideService.refresh();
  }

  onRouteActivated(): void {
    this.lucideService.refresh();
    this.viewport?.applyDeviceStyles(this.currentDeviceKey, this.isLandscape);
    this.viewport?.updateCentering();
  }

  private loadPreferences(): void {
    try {
      const raw = localStorage.getItem(EmuladorComponent.PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.currentDeviceKey === 'string') {
        this.currentDeviceKey = parsed.currentDeviceKey;
      }
      if (typeof parsed.lastDeviceKey === 'string') {
        this.lastDeviceKey = parsed.lastDeviceKey;
      }
      if (typeof parsed.isLandscape === 'boolean') {
        this.isLandscape = parsed.isLandscape;
      }
      if (typeof parsed.currentZoom === 'number' && !isNaN(parsed.currentZoom)) {
        this.currentZoom = Math.max(0.25, Math.min(2.0, parsed.currentZoom));
      }
      if (typeof parsed.appZoom === 'number' && !isNaN(parsed.appZoom)) {
        this.appZoom = Math.max(0.5, Math.min(2.0, parsed.appZoom));
      }
      if (typeof parsed.isTouchEnabled === 'boolean') {
        this.isTouchEnabled = parsed.isTouchEnabled;
      }
      if (typeof parsed.isMenuVisible === 'boolean') {
        this.isMenuVisible = parsed.isMenuVisible;
      }
    } catch {
      // Ignorar errores de lectura de localStorage
    }
  }

  private savePreferences(): void {
    try {
      localStorage.setItem(
        EmuladorComponent.PREFS_KEY,
        JSON.stringify({
          currentDeviceKey: this.currentDeviceKey,
          lastDeviceKey: this.lastDeviceKey,
          isLandscape: this.isLandscape,
          currentZoom: Number(this.currentZoom.toFixed(2)),
          appZoom: Number(this.appZoom.toFixed(2)),
          isTouchEnabled: this.isTouchEnabled,
          isMenuVisible: this.isMenuVisible
        })
      );
    } catch {
      // Ignorar errores de escritura en localStorage
    }
  }

  async loadHistory(): Promise<void> {
    this.history = await this.historyService.getHistory();
    this.lucideService.refresh();
  }

  async onToggleHistory(show: boolean): Promise<void> {
    if (show) {
      await this.loadHistory();
      this.isHistoryOpen = true;
    } else {
      this.isHistoryOpen = false;
    }
    this.lucideService.refresh();
  }

  async onClearHistory(): Promise<void> {
    await this.historyService.clearHistory();
    this.history = [];
    this.isHistoryOpen = true;
    this.lucideService.refresh();
  }

  async onDeleteHistoryItem(itemUrl: string): Promise<void> {
    const fullData = await this.historyService.getFullData();
    const updated = (fullData.history || []).filter((u: string) => u !== itemUrl);
    await this.historyService.clearHistory();
    for (let i = updated.length - 1; i >= 0; i--) {
      await this.historyService.saveUrl(updated[i]);
    }
    this.history = updated;
    this.lucideService.refresh();
  }

  async onNavigateToUrl(targetUrl?: string): Promise<void> {
    let cleanUrl = (targetUrl !== undefined ? targetUrl : this.url).trim();
    if (!cleanUrl) return;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'http://' + cleanUrl;
    }
    this.url = cleanUrl;
    this.history = await this.historyService.saveUrl(cleanUrl);
    this.isHistoryOpen = false;
    this.viewport?.loadUrl(cleanUrl);
    this.lucideService.refresh();
  }

  onRefreshFrame(): void {
    this.viewport?.reloadFrame();
  }

  onToggleMenu(): void {
    this.isMenuVisible = !this.isMenuVisible;
    this.savePreferences();
    setTimeout(() => {
      this.viewport?.updateCentering();
    }, 350);
  }

  onUpdateZoom(delta: number): void {
    if (this.currentDeviceKey === 'responsive') return;
    this.currentZoom = Number(Math.max(0.3, Math.min(1.5, this.currentZoom + delta)).toFixed(2));
    this.viewport?.applyZoom(this.currentZoom);
    this.savePreferences();
  }

  onSetZoom(zoomValue: number): void {
    if (this.currentDeviceKey === 'responsive') return;
    this.currentZoom = Number(Math.max(0.3, Math.min(1.5, zoomValue)).toFixed(2));
    this.viewport?.applyZoom(this.currentZoom);
    this.savePreferences();
  }

  onViewportZoomChange(zoomValue: number): void {
    this.currentZoom = Number(zoomValue.toFixed(2));
    this.savePreferences();
  }

  onAutoFit(): void {
    this.viewport?.autoFit();
  }

  onResetZoom(): void {
    this.currentZoom = 1.0;
    this.viewport?.applyZoom(this.currentZoom);
    this.savePreferences();
  }

  onUpdateAppZoom(delta: number): void {
    this.appZoom = Number(Math.max(0.5, Math.min(1.5, this.appZoom + delta)).toFixed(2));
    this.viewport?.applyAppZoom(this.appZoom);
    this.savePreferences();
  }

  onSetAppZoom(zoomValue: number): void {
    this.appZoom = Number(Math.max(0.5, Math.min(1.5, zoomValue)).toFixed(2));
    this.viewport?.applyAppZoom(this.appZoom);
    this.savePreferences();
  }

  onResetAppZoom(): void {
    this.appZoom = 1.0;
    this.viewport?.applyAppZoom(this.appZoom);
    this.savePreferences();
  }

  onChangeDevice(deviceKey: string): void {
    this.currentDeviceKey = deviceKey;
    if (this.currentDeviceKey !== 'responsive') {
      this.lastDeviceKey = this.currentDeviceKey;
    }
    this.viewport?.applyDeviceAndAutoFit(this.currentDeviceKey, this.isLandscape, false);
    this.savePreferences();
    this.lucideService.refresh();
  }

  onToggleDeviceMode(): void {
    this.currentDeviceKey =
      this.currentDeviceKey === 'responsive' ? this.lastDeviceKey : 'responsive';
    this.viewport?.applyDeviceAndAutoFit(this.currentDeviceKey, this.isLandscape, false);
    this.savePreferences();
    this.lucideService.refresh();
  }

  onToggleRotation(): void {
    if (this.currentDeviceKey === 'responsive') return;
    this.isLandscape = !this.isLandscape;
    this.viewport?.applyDeviceAndAutoFit(this.currentDeviceKey, this.isLandscape, false);
    this.savePreferences();
  }

  onToggleTouch(): void {
    this.isTouchEnabled = !this.isTouchEnabled;
    this.viewport?.updateTouchMode(this.isTouchEnabled);
    this.savePreferences();
    this.lucideService.refresh();
  }

  onToggleConsole(): void {
    if (!this.viewport) return;
    this.isConsoleOpen = this.viewport.toggleDevTools(this.isConsoleOpen);
  }

  onElectronMissing(message: string): void {
    this.electronToastMessage = message;
    this.showElectronToast = true;
    this.lucideService.refresh();
  }

  showToast(msg: string): void {
    this.toastMessage = msg;
    this.isToastVisible = true;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastTimeout = setTimeout(() => {
      this.isToastVisible = false;
    }, 3000);
  }
}

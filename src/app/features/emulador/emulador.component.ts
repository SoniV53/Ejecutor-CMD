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
  @ViewChild(EmuladorViewportComponent) viewport!: EmuladorViewportComponent;

  url = '';
  history: string[] = [];
  isHistoryOpen = false;
  isMenuVisible = true;
  currentDeviceKey = 'iphone14';
  lastDeviceKey = 'iphone14';
  isLandscape = false;
  currentZoom = 1.0;
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
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  ngAfterViewInit(): void {
    this.lucideService.refresh();
  }

  onRouteActivated(): void {
    this.lucideService.refresh();
    this.viewport?.updateCentering();
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
    setTimeout(() => {
      this.viewport?.updateCentering();
    }, 350);
  }

  onUpdateZoom(delta: number): void {
    if (this.currentDeviceKey === 'responsive') return;
    this.currentZoom = Math.max(0.1, Math.min(2, this.currentZoom + delta));
    this.viewport?.applyZoom(this.currentZoom);
  }

  onAutoFit(): void {
    this.viewport?.autoFit();
  }

  onResetZoom(): void {
    this.currentZoom = 1.0;
    this.viewport?.applyZoom(this.currentZoom);
  }

  onChangeDevice(deviceKey: string): void {
    this.currentDeviceKey = deviceKey;
    if (this.currentDeviceKey !== 'responsive') {
      this.lastDeviceKey = this.currentDeviceKey;
    }
    this.currentZoom = 1.0;
    this.viewport?.applyDeviceAndAutoFit(this.currentDeviceKey, this.isLandscape);
    this.lucideService.refresh();
  }

  onToggleDeviceMode(): void {
    this.currentDeviceKey =
      this.currentDeviceKey === 'responsive' ? this.lastDeviceKey : 'responsive';
    this.currentZoom = 1.0;
    this.viewport?.applyDeviceAndAutoFit(this.currentDeviceKey, this.isLandscape);
    this.lucideService.refresh();
  }

  onToggleRotation(): void {
    if (this.currentDeviceKey === 'responsive') return;
    this.isLandscape = !this.isLandscape;
    this.currentZoom = 1.0;
    this.viewport?.applyDeviceAndAutoFit(this.currentDeviceKey, this.isLandscape);
  }

  onToggleTouch(): void {
    this.isTouchEnabled = !this.isTouchEnabled;
    this.viewport?.updateTouchMode(this.isTouchEnabled);
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

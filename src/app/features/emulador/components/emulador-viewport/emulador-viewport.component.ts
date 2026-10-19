import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ElectronService } from '../../../../core/services/electron.service';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

export interface DeviceConfig {
  width: number;
  height: number;
  borderRadius: string;
  borderWidth: string;
  hasNotch: boolean;
}

@Component({
  selector: 'app-emulador-viewport',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './emulador-viewport.component.html',
  styleUrls: ['./emulador-viewport.component.css']
})
export class EmuladorViewportComponent implements AfterViewInit, OnDestroy {
  @ViewChild('workspaceRef') workspaceRef!: ElementRef<HTMLElement>;
  @ViewChild('deviceWrapperRef') deviceWrapperRef!: ElementRef<HTMLElement>;
  @ViewChild('deviceContainerRef') deviceContainerRef!: ElementRef<HTMLElement>;
  @ViewChild('frameContainerRef') frameContainerRef!: ElementRef<HTMLElement>;

  @Input() currentDeviceKey = 'iphone14';
  @Input() isLandscape = false;
  @Input() currentZoom = 1.0;
  @Input() isTouchEnabled = true;

  @Output() zoomChange = new EventEmitter<number>();
  @Output() urlUpdated = new EventEmitter<string>();
  @Output() toastError = new EventEmitter<string>();
  @Output() electronMissing = new EventEmitter<string>();

  isLoading = false;
  clockTime = '9:41';

  private appFrame: any = null;
  private clockInterval: any = null;

  readonly devices: Record<string, DeviceConfig> = {
    iphone14: {
      width: 393,
      height: 852,
      borderRadius: '3.2rem',
      borderWidth: '12px',
      hasNotch: true
    },
    pixel7: {
      width: 412,
      height: 915,
      borderRadius: '2.5rem',
      borderWidth: '10px',
      hasNotch: false
    },
    ipad: {
      width: 768,
      height: 1024,
      borderRadius: '1.5rem',
      borderWidth: '18px',
      hasNotch: false
    }
  };

  private readonly invisibleScrollCSS = `
    ::-webkit-scrollbar, *::-webkit-scrollbar {
      display: none !important;
      width: 0px !important;
      height: 0px !important;
      background: transparent !important;
      -webkit-appearance: none !important;
    }
    html, body, * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }
    ion-content::part(scroll)::-webkit-scrollbar,
    .scroll-y::-webkit-scrollbar,
    .inner-scroll::-webkit-scrollbar,
    [part="scroll"]::-webkit-scrollbar {
      display: none !important;
      width: 0px !important;
      height: 0px !important;
    }
    ion-content::part(scroll),
    .scroll-y,
    .inner-scroll,
    [part="scroll"] {
      scrollbar-width: none !important;
    }
  `;

  constructor(
    private electronService: ElectronService,
    private lucideService: LucideIconService,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    this.lucideService.refresh();
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);

    setTimeout(() => {
      this.initAppFrame();
      this.applyDeviceStyles(this.currentDeviceKey, this.isLandscape);
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
    if (this.appFrame && this.appFrame.parentNode) {
      this.appFrame.parentNode.removeChild(this.appFrame);
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    setTimeout(() => {
      this.updateCentering();
    }, 100);
  }

  get showNotch(): boolean {
    if (this.currentDeviceKey === 'responsive') return false;
    const config = this.devices[this.currentDeviceKey];
    return !!(config && config.hasNotch && !this.isLandscape);
  }

  private updateClock(): void {
    const now = new Date();
    this.clockTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  initAppFrame(): void {
    if (this.appFrame && this.appFrame.parentNode) {
      this.appFrame.parentNode.removeChild(this.appFrame);
    }

    if (!this.electronService.isElectron) {
      this.electronMissing.emit(
        'Este emulador está configurado exclusivamente para correr en Electron usando el motor WebView.'
      );
      return;
    }

    const frameContainer = this.frameContainerRef?.nativeElement;
    if (!frameContainer) return;

    this.appFrame = document.createElement('webview');
    this.appFrame.setAttribute('allowpopups', 'true');
    this.appFrame.id = 'appFrame';
    this.appFrame.className = 'absolute inset-0 w-full h-full border-0 bg-white z-10';
    frameContainer.appendChild(this.appFrame);

    this.appFrame.addEventListener('did-start-loading', () => {
      this.ngZone.run(() => {
        this.isLoading = true;
      });
    });

    this.appFrame.addEventListener('dom-ready', () => {
      this.ngZone.run(() => {
        try {
          this.appFrame.insertCSS(this.invisibleScrollCSS);
          const touchSimScript = `
            (function() {
              if (window.__touchSimActive) return;
              window.__touchSimActive = true;

              window.__enableAdvancedTouch = ${this.isTouchEnabled};

              const createTouchEvt = (type, originalEvent) => {
                let touchObj;
                try {
                  touchObj = new Touch({
                    identifier: Date.now(),
                    target: originalEvent.target,
                    clientX: originalEvent.clientX,
                    clientY: originalEvent.clientY
                  });
                } catch(err) {
                  touchObj = { ...originalEvent, identifier: Date.now(), target: originalEvent.target };
                }

                try {
                  return new TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    touches: type === 'touchend' ? [] : [touchObj],
                    targetTouches: type === 'touchend' ? [] : [touchObj],
                    changedTouches: [touchObj]
                  });
                } catch(err) {
                  const evt = document.createEvent('Event');
                  evt.initEvent(type, true, true);
                  return evt;
                }
              };

              const touchStyle = document.createElement('style');
              touchStyle.textContent = \`
                body {
                  -webkit-user-select: none !important;
                  -ms-user-select: none !important;
                  user-select: none !important;
                }
                input, textarea, [contenteditable="true"] {
                  -webkit-user-select: auto !important;
                  -ms-user-select: auto !important;
                  user-select: auto !important;
                }
              \`;
              document.head.appendChild(touchStyle);

              let isSimulatingDrag = false;

              document.addEventListener('mousedown', (e) => {
                isSimulatingDrag = true;
                e.target.dispatchEvent(createTouchEvt('touchstart', e));
              }, true);

              document.addEventListener('mousemove', (e) => {
                if (isSimulatingDrag && window.__enableAdvancedTouch) {
                  e.target.dispatchEvent(createTouchEvt('touchmove', e));
                }
              }, true);

              document.addEventListener('mouseup', (e) => {
                if (isSimulatingDrag) {
                  isSimulatingDrag = false;
                  if (window.__enableAdvancedTouch) {
                    e.target.dispatchEvent(createTouchEvt('touchend', e));
                  }
                }
              }, true);

              document.addEventListener('mouseleave', (e) => {
                if (isSimulatingDrag) {
                  isSimulatingDrag = false;
                  if (window.__enableAdvancedTouch) {
                    e.target.dispatchEvent(createTouchEvt('touchend', e));
                  }
                }
              });
            })();
          `;
          this.appFrame.executeJavaScript(touchSimScript);
        } catch (err) {
          console.error(err);
        }
        this.applyZoom(this.currentZoom);
      });
    });

    this.appFrame.addEventListener('did-stop-loading', () => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (this.appFrame && typeof this.appFrame.getURL === 'function') {
          this.urlUpdated.emit(this.appFrame.getURL());
        }
      });
    });

    this.appFrame.addEventListener('did-fail-load', () => {
      this.ngZone.run(() => {
        this.isLoading = false;
        this.toastError.emit('No se pudo cargar la URL.');
      });
    });
  }

  loadUrl(url: string): void {
    this.isLoading = true;
    if (this.appFrame) {
      this.appFrame.src = url;
    } else if (!this.electronService.isElectron) {
      this.isLoading = false;
      this.electronMissing.emit(
        'Este emulador está configurado exclusivamente para correr en Electron usando el motor WebView.'
      );
    }
  }

  reloadFrame(): void {
    if (this.appFrame && this.appFrame.src) {
      this.isLoading = true;
      this.appFrame.reload();
    }
  }

  updateTouchMode(enabled: boolean): void {
    this.isTouchEnabled = enabled;
    if (this.appFrame && typeof this.appFrame.executeJavaScript === 'function') {
      try {
        this.appFrame.executeJavaScript(`window.__enableAdvancedTouch = ${this.isTouchEnabled};`);
      } catch {
        // WebView aún no ha cargado un documento
      }
    }
  }

  toggleDevTools(currentlyOpen: boolean): boolean {
    if (!this.appFrame) return false;
    try {
      if (currentlyOpen) {
        this.appFrame.closeDevTools();
        return false;
      } else {
        this.appFrame.openDevTools();
        return true;
      }
    } catch {
      return currentlyOpen;
    }
  }

  updateCentering(): void {
    const wrapper = this.deviceWrapperRef?.nativeElement;
    const workspace = this.workspaceRef?.nativeElement;
    if (!wrapper || !workspace) return;

    if (this.currentDeviceKey === 'responsive') {
      wrapper.style.margin = '0';
      return;
    }

    const availableW = workspace.clientWidth;
    const availableH = workspace.clientHeight;

    const wWrap = parseFloat(wrapper.style.width) || 0;
    const hWrap = parseFloat(wrapper.style.height) || 0;

    const mTop = hWrap <= availableH ? 'auto' : '0px';
    const mBottom = hWrap <= availableH ? 'auto' : '0px';
    const mLeft = wWrap <= availableW ? 'auto' : '0px';
    const mRight = wWrap <= availableW ? 'auto' : '0px';

    wrapper.style.margin = `${mTop} ${mRight} ${mBottom} ${mLeft}`;
  }

  autoFit(): void {
    const workspace = this.workspaceRef?.nativeElement;
    if (!workspace) return;

    if (this.currentDeviceKey === 'responsive') {
      this.currentZoom = 1.0;
      this.zoomChange.emit(this.currentZoom);
      this.applyZoom(this.currentZoom);
      return;
    }

    const config = this.devices[this.currentDeviceKey];
    if (!config) return;

    const scaleW =
      (workspace.clientWidth - 40) / (this.isLandscape ? config.height : config.width);
    const scaleH =
      (workspace.clientHeight - 40) / (this.isLandscape ? config.width : config.height);
    this.currentZoom = Math.max(0.1, Math.min(scaleW, scaleH, 1.0));
    this.zoomChange.emit(this.currentZoom);
    this.applyZoom(this.currentZoom);
  }

  applyZoom(zoom: number): void {
    this.currentZoom = zoom;
    setTimeout(() => {
      const container = this.deviceContainerRef?.nativeElement;
      const wrapper = this.deviceWrapperRef?.nativeElement;
      if (!container || !wrapper) return;

      if (this.currentDeviceKey === 'responsive') {
        container.style.transform = 'none';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        if (this.appFrame && typeof this.appFrame.setZoomFactor === 'function') {
          try {
            this.appFrame.setZoomFactor(1);
          } catch {}
        }
      } else {
        const config = this.devices[this.currentDeviceKey];
        if (config) {
          const w = this.isLandscape ? config.height : config.width;
          const h = this.isLandscape ? config.width : config.height;

          container.style.transform = `scale(${this.currentZoom})`;
          wrapper.style.width = `${w * this.currentZoom}px`;
          wrapper.style.height = `${h * this.currentZoom}px`;

          if (this.appFrame && typeof this.appFrame.setZoomFactor === 'function') {
            try {
              this.appFrame.setZoomFactor(this.currentZoom);
            } catch {}
          }
        }
      }
      this.updateCentering();
    }, 50);
  }

  applyDeviceStyles(deviceKey: string, isLandscape: boolean): void {
    this.currentDeviceKey = deviceKey;
    this.isLandscape = isLandscape;

    const container = this.deviceContainerRef?.nativeElement;
    const wrapper = this.deviceWrapperRef?.nativeElement;
    if (!container || !wrapper) return;

    if (this.currentDeviceKey === 'responsive') {
      container.classList.add('mode-responsive');
      container.style.width = '100%';
      container.style.height = '100%';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      container.style.transform = 'none';
    } else {
      container.classList.remove('mode-responsive');
      const config = this.devices[this.currentDeviceKey];
      if (config) {
        const w = config.width;
        const h = config.height;
        container.style.width = this.isLandscape ? `${h}px` : `${w}px`;
        container.style.height = this.isLandscape ? `${w}px` : `${h}px`;
        container.style.borderRadius = config.borderRadius;
        container.style.borderWidth = config.borderWidth;
      }
    }

    requestAnimationFrame(() => {
      this.updateCentering();
    });
  }

  applyDeviceAndAutoFit(deviceKey: string, isLandscape: boolean): void {
    this.applyDeviceStyles(deviceKey, isLandscape);
    if (deviceKey !== 'responsive') {
      this.autoFit();
    } else {
      this.currentZoom = 1.0;
      this.zoomChange.emit(1.0);
    }
  }
}

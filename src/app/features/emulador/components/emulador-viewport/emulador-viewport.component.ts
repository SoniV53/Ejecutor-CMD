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
  borderRadiusPx: number;
  borderWidthPx: number;
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
  readonly Math = Math;

  @ViewChild('workspaceRef') workspaceRef!: ElementRef<HTMLElement>;
  @ViewChild('deviceWrapperRef') deviceWrapperRef!: ElementRef<HTMLElement>;
  @ViewChild('deviceContainerRef') deviceContainerRef!: ElementRef<HTMLElement>;
  @ViewChild('frameContainerRef') frameContainerRef!: ElementRef<HTMLElement>;

  @Input() currentDeviceKey = 'iphone14';
  @Input() isLandscape = false;
  @Input() currentZoom = 1.0;
  @Input() appZoom = 1.0;
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
      borderRadiusPx: 51,
      borderWidthPx: 12,
      hasNotch: true
    },
    pixel7: {
      width: 412,
      height: 915,
      borderRadius: '2.5rem',
      borderWidth: '10px',
      borderRadiusPx: 40,
      borderWidthPx: 10,
      hasNotch: false
    },
    ipad: {
      width: 768,
      height: 1024,
      borderRadius: '1.5rem',
      borderWidth: '18px',
      borderRadiusPx: 24,
      borderWidthPx: 18,
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
    if (this.appFrame) {
      return;
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
    this.appFrame.setAttribute('partition', 'persist:consoleflow-emulador');
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

          const shouldEnableTouch = this.isTouchEnabled && this.currentDeviceKey !== 'responsive';

          const touchSimScript = `
            (function() {
              const applyTouchClass = (enabled) => {
                window.__enableAdvancedTouch = !!enabled;
                if (enabled) {
                  document.documentElement.classList.add('cf-touch-mode');
                } else {
                  document.documentElement.classList.remove('cf-touch-mode', 'cf-touch-active');
                }
              };

              window.__setTouchMode = applyTouchClass;

              if (!window.__touchSimActive) {
                window.__touchSimActive = true;

                const normalCursorSvg = encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
                  '<circle cx="14" cy="14" r="11" fill="rgba(100, 116, 139, 0.42)" stroke="rgba(255, 255, 255, 0.85)" stroke-width="2"/>' +
                  '<circle cx="14" cy="14" r="12" fill="none" stroke="rgba(15, 23, 42, 0.45)" stroke-width="1"/>' +
                  '</svg>'
                );

                const activeCursorSvg = encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
                  '<circle cx="14" cy="14" r="9.5" fill="rgba(99, 102, 241, 0.55)" stroke="rgba(255, 255, 255, 0.95)" stroke-width="2.2"/>' +
                  '<circle cx="14" cy="14" r="11" fill="none" stroke="rgba(79, 70, 229, 0.6)" stroke-width="1"/>' +
                  '</svg>'
                );

                const touchStyle = document.createElement('style');
                touchStyle.id = 'cf-devtools-touch-style';
                touchStyle.textContent = \`
                  html.cf-touch-mode,
                  html.cf-touch-mode *,
                  html.cf-touch-mode a,
                  html.cf-touch-mode button,
                  html.cf-touch-mode input,
                  html.cf-touch-mode select,
                  html.cf-touch-mode textarea,
                  html.cf-touch-mode [role="button"] {
                    cursor: url("data:image/svg+xml;utf8,\${normalCursorSvg}") 14 14, pointer !important;
                    -webkit-user-select: none !important;
                    user-select: none !important;
                  }
                  html.cf-touch-mode.cf-touch-active,
                  html.cf-touch-mode.cf-touch-active * {
                    cursor: url("data:image/svg+xml;utf8,\${activeCursorSvg}") 14 14, pointer !important;
                  }
                  html.cf-touch-mode input,
                  html.cf-touch-mode textarea,
                  html.cf-touch-mode [contenteditable="true"] {
                    -webkit-user-select: auto !important;
                    user-select: auto !important;
                  }
                \`;
                document.head.appendChild(touchStyle);

                const createTouchEvt = (type, originalEvent, id) => {
                  let touchObj;
                  try {
                    touchObj = new Touch({
                      identifier: id,
                      target: originalEvent.target,
                      clientX: originalEvent.clientX,
                      clientY: originalEvent.clientY,
                      pageX: originalEvent.pageX,
                      pageY: originalEvent.pageY,
                      screenX: originalEvent.screenX,
                      screenY: originalEvent.screenY,
                      radiusX: 11.5,
                      radiusY: 11.5,
                      force: type === 'touchend' ? 0 : 1
                    });
                  } catch (err) {
                    touchObj = { ...originalEvent, identifier: id, target: originalEvent.target };
                  }
                  try {
                    return new TouchEvent(type, {
                      bubbles: true,
                      cancelable: true,
                      composed: true,
                      touches: type === 'touchend' ? [] : [touchObj],
                      targetTouches: type === 'touchend' ? [] : [touchObj],
                      changedTouches: [touchObj]
                    });
                  } catch (err) {
                    const evt = document.createEvent('Event');
                    evt.initEvent(type, true, true);
                    return evt;
                  }
                };

                const findScrollable = (el) => {
                  let node = el;
                  while (node && node !== document && node !== window) {
                    if (node.shadowRoot) {
                      const inner = node.shadowRoot.querySelector('.inner-scroll, [part="scroll"]');
                      if (inner && (inner.scrollHeight > inner.clientHeight || inner.scrollWidth > inner.clientWidth)) {
                        return inner;
                      }
                    }
                    if (node instanceof Element) {
                      const style = window.getComputedStyle(node);
                      const canScrollY =
                        (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') &&
                        node.scrollHeight > node.clientHeight;
                      const canScrollX =
                        (style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowX === 'overlay') &&
                        node.scrollWidth > node.clientWidth;
                      if (canScrollY || canScrollX) {
                        return node;
                      }
                    }
                    node = node.parentNode || node.host;
                  }
                  return document.scrollingElement || document.documentElement || document.body;
                };

                let isDragging = false;
                let hasMoved = false;
                let touchId = 1;
                let startX = 0;
                let startY = 0;
                let lastX = 0;
                let lastY = 0;
                let vx = 0;
                let vy = 0;
                let lastTime = 0;
                let momentumRaf = null;
                let scrollTarget = null;
                let initialTarget = null;

                const stopMomentum = () => {
                  if (momentumRaf) {
                    cancelAnimationFrame(momentumRaf);
                    momentumRaf = null;
                  }
                };

                window.addEventListener('mousedown', (e) => {
                  if (!window.__enableAdvancedTouch || e.button !== 0) return;
                  stopMomentum();
                  document.documentElement.classList.add('cf-touch-active');

                  isDragging = true;
                  hasMoved = false;
                  touchId = Date.now();
                  startX = lastX = e.clientX;
                  startY = lastY = e.clientY;
                  vx = 0;
                  vy = 0;
                  lastTime = performance.now();
                  initialTarget = e.target;
                  scrollTarget = findScrollable(e.target);

                  if (e.target && e.target.tagName !== 'SELECT' && e.target.type !== 'range') {
                    e.target.dispatchEvent(createTouchEvt('touchstart', e, touchId));
                  }
                }, true);

                window.addEventListener('mousemove', (e) => {
                  if (!isDragging || !window.__enableAdvancedTouch) return;

                  const now = performance.now();
                  const dt = Math.max(1, now - lastTime);
                  const dx = e.clientX - lastX;
                  const dy = e.clientY - lastY;

                  if (!hasMoved && Math.hypot(e.clientX - startX, e.clientY - startY) > 6) {
                    hasMoved = true;
                  }

                  if (hasMoved && scrollTarget) {
                    scrollTarget.scrollTop -= dy;
                    scrollTarget.scrollLeft -= dx;
                    vx = (dx / dt) * 16;
                    vy = (dy / dt) * 16;
                  }

                  lastX = e.clientX;
                  lastY = e.clientY;
                  lastTime = now;

                  if (initialTarget) {
                    initialTarget.dispatchEvent(createTouchEvt('touchmove', e, touchId));
                  }
                }, true);

                const finishDrag = (e) => {
                  if (!isDragging) return;
                  isDragging = false;
                  document.documentElement.classList.remove('cf-touch-active');

                  if (window.__enableAdvancedTouch && initialTarget) {
                    initialTarget.dispatchEvent(createTouchEvt('touchend', e, touchId));
                  }

                  if (window.__enableAdvancedTouch && hasMoved && scrollTarget && (Math.abs(vx) > 0.8 || Math.abs(vy) > 0.8)) {
                    const target = scrollTarget;
                    const step = () => {
                      vx *= 0.93;
                      vy *= 0.93;
                      target.scrollLeft -= vx;
                      target.scrollTop -= vy;
                      if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
                        momentumRaf = requestAnimationFrame(step);
                      } else {
                        momentumRaf = null;
                      }
                    };
                    momentumRaf = requestAnimationFrame(step);
                  }
                };

                window.addEventListener('mouseup', finishDrag, true);
                window.addEventListener('mouseleave', finishDrag, true);

                // Evitar clic accidental en botones/enlaces tras arrastrar para hacer scroll
                window.addEventListener('click', (e) => {
                  if (window.__enableAdvancedTouch && hasMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                    hasMoved = false;
                  }
                }, true);

                // Prevenir arrastre nativo de imágenes o enlaces en modo touch
                window.addEventListener('dragstart', (e) => {
                  if (window.__enableAdvancedTouch) {
                    e.preventDefault();
                  }
                }, true);
              }

              applyTouchClass(${shouldEnableTouch});
            })();
          `;
          this.appFrame.executeJavaScript(touchSimScript);
        } catch (err) {
          console.error(err);
        }
        this.syncWebviewZoom();
      });
    });

    this.appFrame.addEventListener('did-navigate', () => {
      this.ngZone.run(() => {
        this.syncWebviewZoom();
      });
    });

    this.appFrame.addEventListener('did-navigate-in-page', () => {
      this.ngZone.run(() => {
        this.syncWebviewZoom();
      });
    });

    this.appFrame.addEventListener('did-stop-loading', () => {
      this.ngZone.run(() => {
        this.isLoading = false;
        this.syncWebviewZoom();
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
    const effective = this.isTouchEnabled && this.currentDeviceKey !== 'responsive';
    if (this.appFrame && typeof this.appFrame.executeJavaScript === 'function') {
      try {
        this.appFrame.executeJavaScript(
          `if (window.__setTouchMode) { window.__setTouchMode(${effective}); }`
        );
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

    const wWrap = parseFloat(wrapper.style.width) || wrapper.offsetWidth || 0;
    const hWrap = parseFloat(wrapper.style.height) || wrapper.offsetHeight || 0;

    const mTop = hWrap <= availableH ? 'auto' : '24px';
    const mBottom = hWrap <= availableH ? 'auto' : '24px';
    const mLeft = wWrap <= availableW ? 'auto' : '24px';
    const mRight = wWrap <= availableW ? 'auto' : '24px';

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
      (workspace.clientWidth - 48) / (this.isLandscape ? config.height : config.width);
    const scaleH =
      (workspace.clientHeight - 48) / (this.isLandscape ? config.width : config.height);
    this.currentZoom = Math.max(0.25, Math.min(scaleW, scaleH, 1.0));
    this.zoomChange.emit(this.currentZoom);
    this.applyZoom(this.currentZoom);
  }

  syncWebviewZoom(): void {
    if (!this.appFrame || typeof this.appFrame.setZoomFactor !== 'function') {
      return;
    }
    try {
      const effectiveZoom =
        this.currentDeviceKey === 'responsive'
          ? Math.max(0.25, Math.min(3.0, this.appZoom))
          : Math.max(0.25, Math.min(3.0, this.currentZoom * this.appZoom));
      this.appFrame.setZoomFactor(effectiveZoom);
    } catch {
      // El WebView aún no está listo para recibir setZoomFactor
    }
  }

  applyAppZoom(appZoom: number): void {
    this.appZoom = appZoom;
    this.syncWebviewZoom();
  }

  applyZoom(zoom: number): void {
    this.currentZoom = zoom;
    const container = this.deviceContainerRef?.nativeElement;
    const wrapper = this.deviceWrapperRef?.nativeElement;
    if (!container || !wrapper) return;

    if (this.currentDeviceKey === 'responsive') {
      container.style.transform = 'none';
      container.style.width = '100%';
      container.style.height = '100%';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
    } else {
      const config = this.devices[this.currentDeviceKey];
      if (config) {
        const w = this.isLandscape ? config.height : config.width;
        const h = this.isLandscape ? config.width : config.height;
        const scaledW = Math.round(w * this.currentZoom);
        const scaledH = Math.round(h * this.currentZoom);
        const scaledBorder = Math.max(2, Math.round(config.borderWidthPx * this.currentZoom));
        const scaledRadius = Math.round(config.borderRadiusPx * this.currentZoom);

        // Escalar dimensiones reales del DOM sin transform: scale() para evitar recorte en Electron WebView
        container.style.transform = 'none';
        container.style.width = `${scaledW}px`;
        container.style.height = `${scaledH}px`;
        container.style.borderWidth = `${scaledBorder}px`;
        container.style.borderRadius = `${scaledRadius}px`;
        wrapper.style.width = `${scaledW}px`;
        wrapper.style.height = `${scaledH}px`;
      }
    }

    this.syncWebviewZoom();
    this.updateCentering();
  }

  applyDeviceStyles(deviceKey: string, isLandscape: boolean): void {
    this.currentDeviceKey = deviceKey;
    this.isLandscape = isLandscape;

    const container = this.deviceContainerRef?.nativeElement;
    const wrapper = this.deviceWrapperRef?.nativeElement;
    if (!container || !wrapper) return;

    if (this.currentDeviceKey === 'responsive') {
      container.classList.add('mode-responsive');
    } else {
      container.classList.remove('mode-responsive');
    }

    this.applyZoom(this.currentZoom);
    this.updateTouchMode(this.isTouchEnabled);

    requestAnimationFrame(() => {
      this.updateCentering();
    });
  }

  applyDeviceAndAutoFit(deviceKey: string, isLandscape: boolean, shouldAutoFit = false): void {
    this.applyDeviceStyles(deviceKey, isLandscape);
    if (shouldAutoFit && deviceKey !== 'responsive') {
      this.autoFit();
    } else if (deviceKey === 'responsive') {
      this.currentZoom = 1.0;
      this.zoomChange.emit(1.0);
    }
  }
}

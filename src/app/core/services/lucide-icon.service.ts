import { Injectable, NgZone } from '@angular/core';

declare const lucide: any;

@Injectable({ providedIn: 'root' })
export class LucideIconService {
  private timer: any = null;

  constructor(private ngZone: NgZone) {}

  refresh(): void {
    this.ngZone.runOutsideAngular(() => {
      if (this.timer) {
        clearTimeout(this.timer);
      }
      this.timer = setTimeout(() => {
        try {
          if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
            const elements = document.querySelectorAll('i[data-lucide]');
            elements.forEach((el: Element) => {
              const iconName = el.getAttribute('data-lucide');
              if (!iconName) return;
              const rendered = el.getAttribute('data-lucide-rendered');
              if (rendered === iconName && el.querySelector('svg')) {
                return;
              }
              el.setAttribute('data-lucide-rendered', iconName);
              const htmlEl = el as HTMLElement;
              htmlEl.style.display = 'inline-flex';
              htmlEl.style.alignItems = 'center';
              htmlEl.style.justifyContent = 'center';
              const hasSizeClass = /\b(w-|h-|size-)/.test(el.className || '');
              htmlEl.innerHTML = `<i data-lucide-inner="${iconName}"${hasSizeClass ? ' class="w-full h-full"' : ''}></i>`;
            });
            lucide.createIcons({ nameAttr: 'data-lucide-inner' });
          }
        } catch (e) {
          console.warn('No se pudo inicializar lucide icons:', e);
        }
      }, 16);
    });
  }
}

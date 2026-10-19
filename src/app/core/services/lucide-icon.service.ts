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
            lucide.createIcons();
          }
        } catch (e) {
          console.warn('No se pudo inicializar lucide icons:', e);
        }
      }, 16);
    });
  }
}

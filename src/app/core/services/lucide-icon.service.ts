import { Injectable } from '@angular/core';

declare const lucide: any;

@Injectable({ providedIn: 'root' })
export class LucideIconService {
  refresh(): void {
    setTimeout(() => {
      try {
        if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
          lucide.createIcons();
        }
      } catch (e) {
        console.warn('No se pudo inicializar lucide icons:', e);
      }
    }, 10);
  }
}


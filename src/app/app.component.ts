import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SidebarNavComponent } from './core/layout/sidebar-nav/sidebar-nav.component';
import { ElectronService } from './core/services/electron.service';
import { EmuladorComponent } from './features/emulador/emulador.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarNavComponent, EmuladorComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  @ViewChild(EmuladorComponent) emuladorComponent?: EmuladorComponent;

  isEmuladorRoute = false;

  constructor(
    private router: Router,
    private electronService: ElectronService
  ) {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const wasActive = this.isEmuladorRoute;
        this.isEmuladorRoute = e.urlAfterRedirects.startsWith('/emulador');
        if (this.isEmuladorRoute && !wasActive) {
          setTimeout(() => {
            this.emuladorComponent?.onRouteActivated();
          }, 50);
        }
      });
  }
}

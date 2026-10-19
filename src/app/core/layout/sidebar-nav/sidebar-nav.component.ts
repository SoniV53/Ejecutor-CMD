import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LucideIconService } from '../../services/lucide-icon.service';
import { WorkspaceSettingsService } from '../../services/workspace-settings.service';

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

  constructor(
    private router: Router,
    private lucide: LucideIconService,
    private settingsService: WorkspaceSettingsService
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
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  trackByRoute(_index: number, item: NavItem): string {
    return item.route;
  }
}

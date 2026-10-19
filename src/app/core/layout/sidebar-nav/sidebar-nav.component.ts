import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { LucideIconService } from '../../services/lucide-icon.service';

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
export class SidebarNavComponent implements AfterViewInit {
  navItems: NavItem[] = [
    { route: '/hub', title: 'Inicio (Hub)', icon: 'grid' },
    { route: '/dashboard-cmd', title: 'Dashboard CMD', icon: 'terminal' },
    { route: '/doc-generator', title: 'Doc Generator', icon: 'file-text' },
    { route: '/redes', title: 'Redes', icon: 'network' },
    { route: '/api-doc', title: 'API Docs', icon: 'file-json' },
    { route: '/repo-doc', title: 'Repo Docs', icon: 'git-branch' },
    { route: '/emulador', title: 'Emulador', icon: 'smartphone' }
  ];

  constructor(private router: Router, private lucide: LucideIconService) {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.lucide.refresh();
      });
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }
}


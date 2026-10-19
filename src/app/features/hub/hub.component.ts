import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToolCardComponent, HubToolCard } from './components/tool-card/tool-card.component';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { WorkspaceSettingsService } from '../../core/services/workspace-settings.service';

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [CommonModule, RouterModule, ToolCardComponent],
  templateUrl: './hub.component.html',
  styleUrls: ['./hub.component.css']
})
export class HubComponent implements OnInit, OnDestroy, AfterViewInit {
  tools: HubToolCard[] = [];
  totalModules = 6;
  private sub?: Subscription;

  constructor(
    private lucide: LucideIconService,
    private settingsService: WorkspaceSettingsService
  ) {}

  ngOnInit(): void {
    this.sub = this.settingsService.modules$.subscribe((modules) => {
      this.totalModules = modules.length;
      this.tools = modules
        .filter((m) => m.enabled)
        .map((m) => ({
          route: m.route,
          title: m.title,
          description: m.description,
          icon: m.icon,
          color: m.color
        }));
      this.lucide.refresh();
    });
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  trackByRoute(_index: number, tool: HubToolCard): string {
    return tool.route;
  }
}

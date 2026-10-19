import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  WorkspaceSettingsService,
  WorkspaceModuleItem
} from '../../core/services/workspace-settings.service';
import { LucideIconService } from '../../core/services/lucide-icon.service';

@Component({
  selector: 'app-configuraciones',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './configuraciones.component.html',
  styleUrls: ['./configuraciones.component.css']
})
export class ConfiguracionesComponent implements OnInit, OnDestroy, AfterViewInit {
  modules: WorkspaceModuleItem[] = [];
  enabledCount = 0;
  runInBackground = true;

  private subs = new Subscription();

  constructor(
    private settingsService: WorkspaceSettingsService,
    private lucide: LucideIconService
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.settingsService.modules$.subscribe(mods => {
        this.modules = mods;
        this.enabledCount = mods.filter(m => m.enabled).length;
        this.lucide.refresh();
      })
    );

    this.subs.add(
      this.settingsService.runInBackground$.subscribe(val => {
        this.runInBackground = val;
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

  trackByModuleId(_index: number, mod: WorkspaceModuleItem): string {
    return mod.id;
  }

  onToggleModule(id: string): void {
    this.settingsService.toggleModule(id);
  }

  onToggleRunInBackground(): void {
    this.settingsService.toggleRunInBackground();
  }

  onEnableAll(): void {
    this.settingsService.enableAllModules();
  }

  getIconBgClass(color: string, enabled: boolean): string {
    if (!enabled) {
      return 'bg-slate-800/60 text-slate-500 border-slate-700/60';
    }
    const map: Record<string, string> = {
      indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
      purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
      orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
      sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
      emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
    };
    return map[color] || map['indigo'];
  }
}

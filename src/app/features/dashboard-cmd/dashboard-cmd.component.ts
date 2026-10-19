import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CmdProject, CmdCommandItem, CmdConsoleLog, CmdCategoryItem } from './models/cmd.models';
import { ConsoleFlowApiService } from '../../core/services/console-flow-api.service';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { CmdSidebarComponent } from './components/cmd-sidebar/cmd-sidebar.component';
import { CmdHeaderComponent } from './components/cmd-header/cmd-header.component';
import { CmdGridComponent } from './components/cmd-grid/cmd-grid.component';
import { CmdConsoleDrawerComponent } from './components/cmd-console-drawer/cmd-console-drawer.component';
import { CmdModalsComponent } from './components/cmd-modals/cmd-modals.component';

@Component({
  selector: 'app-dashboard-cmd',
  standalone: true,
  imports: [
    CommonModule,
    CmdSidebarComponent,
    CmdHeaderComponent,
    CmdGridComponent,
    CmdConsoleDrawerComponent,
    CmdModalsComponent
  ],
  templateUrl: './dashboard-cmd.component.html',
  styleUrls: ['./dashboard-cmd.component.css']
})
export class DashboardCmdComponent implements OnInit, OnDestroy, AfterViewInit {
  projects: CmdProject[] = [];
  commands: CmdCommandItem[] = [];
  explicitCategories: string[] = [];
  collapsedCategories: Record<string, boolean> = {};
  selectedProjId: string | null = null;
  serverOnline = false;

  viewMode: 'list' | 'card' = 'card';
  searchTerm = '';

  sidebarOpenMobile = false;
  sidebarOpenDesktop = true;

  consoleMin = false;
  logs: CmdConsoleLog[] = [];
  logsCleared = false;

  // Modals state
  showProjModal = false;
  editingProjId: string | null = null;

  showCatModal = false;
  editingCatName: string | null = null;

  showCmdModal = false;
  editingCmdId: string | null = null;

  private pollInterval: any;

  constructor(
    private api: ConsoleFlowApiService,
    private lucide: LucideIconService
  ) {}

  ngOnInit(): void {
    this.fetchLocalData();
    this.pollInterval = setInterval(() => this.fetchLocalData(), 3000);
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  get activeProject(): CmdProject | null {
    if (!this.selectedProjId) return null;
    return this.projects.find(p => p.id === this.selectedProjId) || null;
  }

  get editingProject(): CmdProject | null {
    if (!this.editingProjId) return null;
    return this.projects.find(p => p.id === this.editingProjId) || null;
  }

  get editingCommand(): CmdCommandItem | null {
    if (!this.editingCmdId) return null;
    return this.commands.find(c => c.id === this.editingCmdId) || null;
  }

  get allCategories(): string[] {
    const cats = new Set<string>([
      ...this.commands.map(c => c.category || 'General'),
      ...this.explicitCategories
    ]);
    return Array.from(cats);
  }

  async fetchLocalData(): Promise<void> {
    try {
      const data = await this.api.getData();
      const newProjects = data.projects || [];
      const newCommands = data.commands || [];
      const newCategories = (data.categories || []).map(c =>
        typeof c === 'string' ? c : (c as CmdCategoryItem).name
      );

      const dataChanged =
        JSON.stringify({ p: newProjects, c: newCommands, cat: newCategories }) !==
        JSON.stringify({ p: this.projects, c: this.commands, cat: this.explicitCategories });

      if (dataChanged) {
        this.projects = newProjects;
        this.commands = newCommands;
        this.explicitCategories = newCategories;
        this.lucide.refresh();
      }
      this.serverOnline = true;
    } catch {
      this.serverOnline = false;
    }
  }

  async syncData(): Promise<boolean> {
    if (!this.serverOnline) {
      alert('Debes iniciar server.js para guardar cambios en tu JSON.');
      return false;
    }
    try {
      await this.api.saveData({
        projects: this.projects,
        commands: this.commands,
        categories: this.explicitCategories
      });
      this.lucide.refresh();
      return true;
    } catch {
      alert('Error al guardar en el archivo JSON local.');
      return false;
    }
  }

  toggleSidebar(): void {
    if (window.innerWidth < 768) {
      this.sidebarOpenMobile = !this.sidebarOpenMobile;
    } else {
      this.sidebarOpenDesktop = !this.sidebarOpenDesktop;
    }
  }

  toggleConsole(): void {
    this.consoleMin = !this.consoleMin;
    this.lucide.refresh();
  }

  clearLogs(): void {
    this.logs = [];
    this.logsCleared = true;
  }

  selectProj(id: string): void {
    this.selectedProjId = id;
    this.lucide.refresh();
  }

  deselectProject(): void {
    this.selectedProjId = null;
    this.lucide.refresh();
  }

  toggleCategory(cat: string): void {
    this.collapsedCategories = {
      ...this.collapsedCategories,
      [cat]: !this.collapsedCategories[cat]
    };
    this.lucide.refresh();
  }

  // Project Modal Actions
  openNewProjectModal(): void {
    this.editingProjId = null;
    this.showProjModal = true;
  }

  editProject(id: string): void {
    this.editingProjId = id;
    this.showProjModal = true;
  }

  async onSaveProject(data: { name: string; path: string }): Promise<void> {
    if (this.editingProjId) {
      this.projects = this.projects.map(p =>
        p.id === this.editingProjId ? { ...p, name: data.name, path: data.path } : p
      );
    } else {
      this.projects = [
        ...this.projects,
        { id: Date.now().toString(), name: data.name, path: data.path }
      ];
    }
    const ok = await this.syncData();
    if (ok) {
      this.showProjModal = false;
      this.editingProjId = null;
    }
  }

  async deleteProject(id: string): Promise<void> {
    if (confirm('¿Borrar permanentemente?')) {
      this.projects = this.projects.filter(p => p.id !== id);
      if (this.selectedProjId === id) {
        this.selectedProjId = null;
      }
      await this.syncData();
    }
  }

  // Category Modal Actions
  openNewCategoryModal(): void {
    this.editingCatName = null;
    this.showCatModal = true;
  }

  editCategory(oldName: string): void {
    this.editingCatName = oldName;
    this.showCatModal = true;
  }

  async onSaveCategory(newName: string): Promise<void> {
    if (this.editingCatName) {
      if (this.explicitCategories.includes(this.editingCatName)) {
        this.explicitCategories = this.explicitCategories.map(c =>
          c === this.editingCatName ? newName : c
        );
      } else {
        this.explicitCategories = [...this.explicitCategories, newName];
      }
      this.commands = this.commands.map(c =>
        (c.category || 'General') === this.editingCatName ? { ...c, category: newName } : c
      );
      if (this.collapsedCategories[this.editingCatName]) {
        const copy = { ...this.collapsedCategories, [newName]: this.collapsedCategories[this.editingCatName] };
        delete copy[this.editingCatName];
        this.collapsedCategories = copy;
      }
    } else {
      if (!this.explicitCategories.includes(newName)) {
        this.explicitCategories = [...this.explicitCategories, newName];
      }
    }
    const ok = await this.syncData();
    if (ok) {
      this.showCatModal = false;
      this.editingCatName = null;
    }
  }

  async deleteCategory(catName: string): Promise<void> {
    if (confirm(`¿Eliminar la categoría "${catName}"? Sus comandos pasarán a "General".`)) {
      this.explicitCategories = this.explicitCategories.filter(c => c !== catName);
      this.commands = this.commands.map(c =>
        (c.category || 'General') === catName ? { ...c, category: 'General' } : c
      );
      const copy = { ...this.collapsedCategories };
      delete copy[catName];
      this.collapsedCategories = copy;
      await this.syncData();
    }
  }

  // Command Modal Actions
  openNewCommandModal(): void {
    this.editingCmdId = null;
    this.showCmdModal = true;
  }

  editCommand(id: string): void {
    this.editingCmdId = id;
    this.showCmdModal = true;
  }

  async onSaveCommand(payload: {
    label: string;
    category: string;
    scripts: string[];
    multiSelect: boolean;
    color: string;
    background: boolean;
  }): Promise<void> {
    if (!this.explicitCategories.includes(payload.category)) {
      this.explicitCategories = [...this.explicitCategories, payload.category];
    }

    const mainScript = payload.scripts[0];

    if (this.editingCmdId) {
      this.commands = this.commands.map(c =>
        c.id === this.editingCmdId
          ? {
              ...c,
              label: payload.label,
              script: mainScript,
              scripts: payload.scripts,
              multiSelect: payload.multiSelect,
              category: payload.category,
              color: payload.color,
              background: payload.background
            }
          : c
      );
    } else {
      this.commands = [
        ...this.commands,
        {
          id: Date.now().toString(),
          label: payload.label,
          script: mainScript,
          scripts: payload.scripts,
          multiSelect: payload.multiSelect,
          category: payload.category,
          color: payload.color,
          background: payload.background
        }
      ];
    }

    const ok = await this.syncData();
    if (ok) {
      this.showCmdModal = false;
      this.editingCmdId = null;
    }
  }

  async deleteCommand(id: string): Promise<void> {
    if (confirm('¿Borrar permanentemente?')) {
      this.commands = this.commands.filter(c => c.id !== id);
      await this.syncData();
    }
  }

  async runCommand(event: { id: string; selectedScripts: string[] }): Promise<void> {
    const cmd = this.commands.find(c => c.id === event.id);
    if (!cmd) return;

    const p = this.activeProject;
    const path = p ? p.path : 'C:\\';

    if (event.selectedScripts.length === 0) {
      alert('Selecciona al menos un script para ejecutar.');
      return;
    }

    const scriptToRun = event.selectedScripts.join(' && ');
    this.addLog(scriptToRun, path);

    if (this.serverOnline) {
      try {
        await this.api.executeCommand(scriptToRun, path, !!cmd.background);
      } catch (e) {
        console.error('Fallo', e);
      }
    } else {
      const finalScript = scriptToRun.replace(/%CURRENT_DIR%/gi, path);
      const full = `cd /d "${path}" && ${finalScript}`;

      const el = document.createElement('textarea');
      el.value = full;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert('Servidor apagado. Comando copiado al portapapeles.');
    }
  }

  private addLog(script: string, path: string): void {
    this.logsCleared = false;
    this.logs = [
      {
        time: new Date().toLocaleTimeString(),
        script,
        path
      },
      ...this.logs
    ];
  }
}

import { Component, OnInit, OnDestroy, AfterViewInit, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CmdProject, CmdCommandItem, CmdConsoleLog, CmdCategoryItem } from './models/cmd.models';
import { ConsoleFlowApiService } from '../../core/services/console-flow-api.service';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { WorkspaceSettingsService } from '../../core/services/workspace-settings.service';
import { CmdSidebarComponent } from './components/cmd-sidebar/cmd-sidebar.component';
import { CmdHeaderComponent } from './components/cmd-header/cmd-header.component';
import { CmdGridComponent } from './components/cmd-grid/cmd-grid.component';
import { CmdConsoleDrawerComponent } from './components/cmd-console-drawer/cmd-console-drawer.component';
import { CmdModalsComponent } from './components/cmd-modals/cmd-modals.component';
import { CmdBatModalComponent, SaveBatPayload } from './components/cmd-bat-modal/cmd-bat-modal.component';

@Component({
  selector: 'app-dashboard-cmd',
  standalone: true,
  imports: [
    CommonModule,
    CmdSidebarComponent,
    CmdHeaderComponent,
    CmdGridComponent,
    CmdConsoleDrawerComponent,
    CmdModalsComponent,
    CmdBatModalComponent
  ],
  templateUrl: './dashboard-cmd.component.html',
  styleUrls: ['./dashboard-cmd.component.css']
})
export class DashboardCmdComponent implements OnInit, OnDestroy, AfterViewInit {
  projects: CmdProject[] = [];
  commands: CmdCommandItem[] = [];
  explicitCategories: string[] = [];
  allCategories: string[] = [];
  collapsedCategories: Record<string, boolean> = {};
  selectedProjId: string | null = null;
  serverOnline = false;

  profiles: string[] = ['Perfil 1', 'Perfil 2'];
  activeProfile = 'ALL';

  viewMode: 'list' | 'card' = 'card';
  searchTerm = '';

  sidebarOpenMobile = false;
  sidebarOpenDesktop = true;

  consoleMin = false;
  consoleMax = false;
  logs: CmdConsoleLog[] = [];
  activeLogId: string | null = null;
  logsCleared = false;

  // Modals state
  showProjModal = false;
  editingProjId: string | null = null;

  showCatModal = false;
  editingCatName: string | null = null;

  showCmdModal = false;
  editingCmdId: string | null = null;

  showProfilesModal = false;

  // Bat Modal state
  showBatModal = false;
  editingBatCmd: CmdCommandItem | null = null;

  private pollInterval: any;

  constructor(
    private api: ConsoleFlowApiService,
    private lucide: LucideIconService,
    private settingsService: WorkspaceSettingsService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    try {
      const savedProfile = localStorage.getItem('cmd_active_profile');
      if (savedProfile) {
        this.activeProfile = savedProfile;
      }
    } catch {}

    this.fetchLocalData();
    this.ngZone.runOutsideAngular(() => {
      this.pollInterval = setInterval(() => this.fetchLocalData(), 3000);
    });
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  @HostListener('window:beforeunload')
  onWindowBeforeUnload(): void {
    if (!this.settingsService.getRunInBackground()) {
      this.api.killAllProcessesBeacon();
    }
  }

  ngOnDestroy(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.api.killAllProcessesBeacon();
  }

  get activeProject(): CmdProject | null {
    if (!this.selectedProjId) return null;
    return this.projects.find(p => p.id === this.selectedProjId) || null;
  }

  get displayedProjects(): CmdProject[] {
    if (this.activeProfile === 'ALL') {
      return this.projects;
    }
    return this.projects.filter(p => p.profiles && p.profiles.includes(this.activeProfile));
  }

  get editingProject(): CmdProject | null {
    if (!this.editingProjId) return null;
    return this.projects.find(p => p.id === this.editingProjId) || null;
  }

  get editingCommand(): CmdCommandItem | null {
    if (!this.editingCmdId) return null;
    return this.commands.find(c => c.id === this.editingCmdId) || null;
  }

  get allAvailableTags(): string[] {
    const set = new Set<string>();
    this.projects.forEach(p => (p.tags || []).forEach(t => t && set.add(t.trim())));
    this.commands.forEach(c => (c.tags || []).forEach(t => t && set.add(t.trim())));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  get displayedCommands(): CmdCommandItem[] {
    // 1. Filtrar primero por el Perfil Activo (si no es 'ALL')
    let pool = this.commands;
    if (this.activeProfile !== 'ALL') {
      pool = pool.filter(cmd => cmd.profiles && cmd.profiles.includes(this.activeProfile));
    }

    const project = this.activeProject;
    if (!project) {
      return pool;
    }

    const folderTags = (project.tags || [])
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    if (folderTags.length > 0) {
      return pool.filter(cmd => {
        if (cmd.projectId && cmd.projectId === project.id) {
          return true;
        }

        const cmdTags = (cmd.tags || [])
          .map(t => t.trim().toLowerCase())
          .filter(Boolean);

        // "si no existe tag en los comandos siempre van a aparecer"
        if (cmdTags.length === 0) {
          return true;
        }

        // "deberan aparecer los que tengan ese tag ... pero si tiene angular y mi carpeta solo tiene spring esa de angular no debera aparecer"
        return cmdTags.some(t => folderTags.includes(t));
      });
    }

    // Si la carpeta activa no tiene tags configurados:
    // Aparecen los comandos sin tags y los asignados a esta carpeta
    return pool.filter(cmd => {
      if (cmd.projectId && cmd.projectId === project.id) {
        return true;
      }
      const cmdTags = (cmd.tags || [])
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      return cmdTags.length === 0;
    });
  }

  private updateAllCategories(): void {
    const cats = new Set<string>([
      ...this.commands.map(c => c.category || 'General'),
      ...this.explicitCategories
    ]);
    this.allCategories = Array.from(cats);
  }

  async fetchLocalData(): Promise<void> {
    try {
      const data = await this.api.getData();
      const newProjects = data.projects || [];
      const newCommands = data.commands || [];
      const newCategories = (data.categories || []).map(c =>
        typeof c === 'string' ? c : (c as CmdCategoryItem).name
      );
      const newProfiles = data.profiles && Array.isArray(data.profiles) && data.profiles.length > 0
        ? data.profiles
        : ['Perfil 1', 'Perfil 2'];

      const dataChanged =
        JSON.stringify({ p: newProjects, c: newCommands, cat: newCategories, prof: newProfiles }) !==
        JSON.stringify({ p: this.projects, c: this.commands, cat: this.explicitCategories, prof: this.profiles });

      if (dataChanged || !this.serverOnline) {
        this.ngZone.run(() => {
          if (dataChanged) {
            this.projects = newProjects;
            this.commands = newCommands;
            this.explicitCategories = newCategories;
            this.profiles = newProfiles;
            this.updateAllCategories();
            this.lucide.refresh();
          }
          this.serverOnline = true;
        });
      }
    } catch {
      if (this.serverOnline) {
        this.ngZone.run(() => {
          this.serverOnline = false;
        });
      }
    }
  }

  async syncData(): Promise<boolean> {
    if (!this.serverOnline) {
      alert('Debes iniciar server.js para guardar cambios en tu JSON.');
      return false;
    }
    try {
      this.updateAllCategories();
      await this.api.saveData({
        projects: this.projects,
        commands: this.commands,
        categories: this.explicitCategories,
        profiles: this.profiles
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

  toggleConsoleMax(): void {
    this.consoleMax = !this.consoleMax;
    if (this.consoleMax) {
      this.consoleMin = false;
    }
    this.lucide.refresh();
  }

  async clearLogs(): Promise<void> {
    this.api.killAllProcesses().catch(() => {});
    this.logs = [];
    this.activeLogId = null;
    this.logsCleared = true;
  }

  selectTab(logId: string): void {
    this.activeLogId = logId;
  }

  async closeTab(logId: string): Promise<void> {
    const idx = this.logs.findIndex(l => l.id === logId);
    if (idx === -1) return;

    const target = this.logs[idx];
    if (target.running && target.processId) {
      this.api.killProcess(target.processId).catch(() => {});
    }

    const updated = this.logs.filter(l => l.id !== logId);
    this.logs = updated;

    if (this.activeLogId === logId) {
      if (updated.length > 0) {
        const nextIdx = Math.min(idx, updated.length - 1);
        this.activeLogId = updated[nextIdx].id;
      } else {
        this.activeLogId = null;
      }
    }
    this.lucide.refresh();
  }

  clearTabOutput(logId: string): void {
    this.logs = this.logs.map(l => (l.id === logId ? { ...l, output: '' } : l));
  }

  createNewTerminalTab(): void {
    this.consoleMin = false;
    this.logsCleared = false;
    const p = this.activeProject;
    const path = p ? p.path : 'C:\\';
    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tabNumber = this.logs.length + 1;

    const newLog: CmdConsoleLog = {
      id: logId,
      label: p ? `${p.name} #${tabNumber}` : `CMD #${tabNumber}`,
      time: new Date().toLocaleTimeString(),
      script: 'Consola interactiva lista',
      path,
      output: `Microsoft Windows [Consola Interna de ConsoleFlow]\nDirectorio activo: ${path}\nEscribe un comando abajo y presiona Enter.\n`,
      running: false,
      exitCode: 0
    };

    this.logs = [...this.logs, newLog];
    this.activeLogId = logId;
    this.lucide.refresh();
  }

  async rerunTab(logId: string): Promise<void> {
    const target = this.logs.find(l => l.id === logId);
    if (!target || target.running || target.script === 'Consola interactiva lista') return;
    await this.executeInInternalCmd(target.script, target.path, true, target.label, logId);
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

  async onSaveProject(data: { name: string; path: string; tags: string[]; profiles: string[] }): Promise<void> {
    if (this.editingProjId) {
      this.projects = this.projects.map(p =>
        p.id === this.editingProjId
          ? { ...p, name: data.name, path: data.path, tags: data.tags || [], profiles: data.profiles || [] }
          : p
      );
    } else {
      this.projects = [
        ...this.projects,
        {
          id: Date.now().toString(),
          name: data.name,
          path: data.path,
          tags: data.tags || [],
          profiles: data.profiles && data.profiles.length > 0
            ? data.profiles
            : (this.activeProfile !== 'ALL' ? [this.activeProfile] : [])
        }
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
    tags: string[];
    profiles: string[];
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
              background: payload.background,
              tags: payload.tags || [],
              profiles: payload.profiles || []
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
          background: payload.background,
          projectId: null,
          tags: payload.tags || [],
          profiles: payload.profiles || []
        }
      ];
    }

    const ok = await this.syncData();
    if (ok) {
      this.showCmdModal = false;
      this.editingCmdId = null;
    }
  }

  // Bat Modal Actions
  openNewBatModal(): void {
    this.editingBatCmd = null;
    this.showBatModal = true;
  }

  async editBatCommand(cmd: CmdCommandItem): Promise<void> {
    // Si el comando tiene batPath y batFileName, intentar cargar el contenido más reciente desde disco
    if (cmd.batPath && cmd.batFileName) {
      try {
        const full = `${cmd.batPath}\\${cmd.batFileName}`.replace(/\\\\/g, '\\');
        const res = await this.api.readBatFile(full);
        if (res && res.content !== undefined) {
          cmd = { ...cmd, batContent: res.content };
        }
      } catch {
        // Usar batContent guardado en el modelo
      }
    }
    this.editingBatCmd = cmd;
    this.showBatModal = true;
  }

  async onSaveBat(payload: SaveBatPayload): Promise<void> {
    try {
      // 1. Guardar físicamente el archivo .bat en la carpeta "bat" de la app
      const batRes = await this.api.saveBatFile(payload.dirPath, payload.fileName, payload.content);

      if (!this.explicitCategories.includes(payload.category)) {
        this.explicitCategories = [...this.explicitCategories, payload.category];
      }

      const scriptCommand = batRes.scriptCommand || `call "${batRes.fullPath}"`;
      const cmdId = payload.id || Date.now().toString();

      if (payload.id) {
        this.commands = this.commands.map(c =>
          c.id === payload.id
            ? {
                ...c,
                label: payload.label,
                category: payload.category,
                color: payload.color,
                background: payload.background,
                projectId: payload.projectId,
                isBat: true,
                batFileName: batRes.fileName,
                batPath: batRes.dirPath,
                batContent: payload.content,
                script: scriptCommand,
                scripts: [scriptCommand],
                tags: payload.tags || [],
                profiles: payload.profiles || []
              }
            : c
        );
      } else {
        const newCmd: CmdCommandItem = {
          id: cmdId,
          label: payload.label,
          category: payload.category,
          color: payload.color,
          background: payload.background,
          projectId: payload.projectId,
          isBat: true,
          batFileName: batRes.fileName,
          batPath: batRes.dirPath,
          batContent: payload.content,
          script: scriptCommand,
          scripts: [scriptCommand],
          multiSelect: false,
          tags: payload.tags || [],
          profiles: payload.profiles || []
        };
        this.commands = [...this.commands, newCmd];
      }

      const ok = await this.syncData();
      if (ok) {
        this.showBatModal = false;
        this.editingBatCmd = null;
      }

      // Si se seleccionó "Guardar y Ejecutar", iniciar ejecución inmediatamente en la consola
      if (payload.runImmediately) {
        const execCwd = this.activeProject
          ? this.activeProject.path
          : (payload.projectId ? this.projects.find(p => p.id === payload.projectId)?.path || 'C:\\' : 'C:\\');

        await this.executeInInternalCmd(
          scriptCommand,
          execCwd,
          payload.background,
          payload.label
        );
      }
    } catch (err: any) {
      alert('Error al guardar archivo .bat: ' + (err.message || err));
    }
  }

  async handleImportBatFiles(files: FileList): Promise<void> {
    if (!files || files.length === 0) return;

    let importedCount = 0;
    const activeProj = this.activeProject;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const content = await file.text();
        const res = await this.api.saveBatFile('', file.name, content);

        const cleanLabel = file.name.replace(/\.(bat|cmd)$/i, '');
        const scriptCommand = res.scriptCommand || `call "${res.fullPath}"`;
        const cmdId = `bat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        const newCmd: CmdCommandItem = {
          id: cmdId,
          label: cleanLabel,
          category: 'General',
          color: 'emerald',
          background: false,
          projectId: activeProj ? activeProj.id : null,
          isBat: true,
          batFileName: res.fileName,
          batPath: res.dirPath,
          batContent: content,
          script: scriptCommand,
          scripts: [scriptCommand],
          multiSelect: false
        };

        this.commands = [...this.commands, newCmd];
        importedCount++;
      } catch (err: any) {
        console.error('Error importando archivo .bat:', file.name, err);
      }
    }

    if (importedCount > 0) {
      if (!this.explicitCategories.includes('General')) {
        this.explicitCategories = [...this.explicitCategories, 'General'];
      }
      await this.syncData();
      alert(`Se importó con éxito ${importedCount} archivo(s) .bat a la carpeta "bat" de la app.`);
    }
  }

  async exportSingleBat(cmd: CmdCommandItem): Promise<void> {
    if (!cmd.isBat) return;
    let content = cmd.batContent || '';
    if (!content && cmd.batPath && cmd.batFileName) {
      try {
        const full = `${cmd.batPath}\\${cmd.batFileName}`.replace(/\\\\/g, '\\');
        const res = await this.api.readBatFile(full);
        content = res.content || '';
      } catch {}
    }
    this.api.downloadBatFile(cmd.batFileName || cmd.label, content);
  }

  exportAllBats(): void {
    const bats = this.commands.filter(c => c.isBat);
    if (bats.length === 0) {
      alert('No hay comandos .bat registrados para exportar.');
      return;
    }
    bats.forEach(b => {
      this.exportSingleBat(b);
    });
  }

  // Profile Management Actions
  onActiveProfileChange(profile: string): void {
    this.activeProfile = profile;
    try {
      localStorage.setItem('cmd_active_profile', profile);
    } catch {}

    // Si el proyecto/carpeta seleccionado no pertenece al nuevo perfil, deseleccionar
    if (this.selectedProjId && this.activeProfile !== 'ALL') {
      const p = this.projects.find(proj => proj.id === this.selectedProjId);
      if (p && (!p.profiles || !p.profiles.includes(this.activeProfile))) {
        this.selectedProjId = null;
      }
    }

    this.lucide.refresh();
  }

  openManageProfiles(): void {
    this.showProfilesModal = true;
  }

  async onSaveProfiles(event: { profiles: string[]; renames?: Record<string, string> } | string[]): Promise<void> {
    const newProfiles = Array.isArray(event) ? event : event.profiles;
    const renames = !Array.isArray(event) && event.renames ? event.renames : {};

    // 1. Si hubo perfiles renombrados, actualizar comandos y proyectos existentes
    const renameEntries = Object.entries(renames);
    if (renameEntries.length > 0) {
      for (const [oldName, newName] of renameEntries) {
        if (!oldName || !newName || oldName === newName) continue;

        // Renombrar en comandos
        this.commands = this.commands.map(c => {
          if (c.profiles && c.profiles.includes(oldName)) {
            const updated = c.profiles.map(p => (p === oldName ? newName : p));
            return { ...c, profiles: Array.from(new Set(updated)) };
          }
          return c;
        });

        // Renombrar en proyectos / carpetas
        this.projects = this.projects.map(p => {
          if (p.profiles && p.profiles.includes(oldName)) {
            const updated = p.profiles.map(prof => (prof === oldName ? newName : prof));
            return { ...p, profiles: Array.from(new Set(updated)) };
          }
          return p;
        });

        // Si el perfil activo es el renombrado, actualizarlo
        if (this.activeProfile === oldName) {
          this.activeProfile = newName;
          try {
            localStorage.setItem('cmd_active_profile', newName);
          } catch {}
        }
      }
    }

    // 2. Limpiar referencias a perfiles que hayan sido eliminados completamente
    const validProfilesSet = new Set(newProfiles);
    this.commands = this.commands.map(c => {
      if (c.profiles && c.profiles.length > 0) {
        const filtered = c.profiles.filter(p => validProfilesSet.has(p));
        return { ...c, profiles: filtered };
      }
      return c;
    });

    this.projects = this.projects.map(p => {
      if (p.profiles && p.profiles.length > 0) {
        const filtered = p.profiles.filter(prof => validProfilesSet.has(prof));
        return { ...p, profiles: filtered };
      }
      return p;
    });

    this.profiles = newProfiles;
    if (this.activeProfile !== 'ALL' && !this.profiles.includes(this.activeProfile)) {
      this.onActiveProfileChange('ALL');
    }

    await this.syncData();
    this.showProfilesModal = false;
  }

  exportProfileCommands(): void {
    const targetProfile = this.activeProfile;
    const cmdsToExport = targetProfile === 'ALL'
      ? this.commands
      : this.commands.filter(c => c.profiles && c.profiles.includes(targetProfile));

    if (cmdsToExport.length === 0) {
      alert(
        targetProfile === 'ALL'
          ? 'No hay comandos registrados para exportar.'
          : `No hay comandos asignados al perfil "${targetProfile}" para exportar.`
      );
      return;
    }

    const exportData = {
      source: 'ConsoleFlow',
      exportedAt: new Date().toISOString(),
      profile: targetProfile,
      commandsCount: cmdsToExport.length,
      commands: cmdsToExport.map(c => ({
        id: c.id,
        label: c.label,
        script: c.script,
        scripts: c.scripts,
        multiSelect: c.multiSelect,
        category: c.category,
        color: c.color,
        background: c.background,
        tags: c.tags || [],
        profiles: c.profiles || (targetProfile !== 'ALL' ? [targetProfile] : [])
      }))
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanProfName = targetProfile === 'ALL'
      ? 'todos'
      : targetProfile.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    a.download = `comandos_perfil_${cleanProfName}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importProfileCommands(files: FileList): Promise<void> {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const cmds = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.commands) ? parsed.commands : null);

      if (!cmds || cmds.length === 0) {
        alert('El archivo JSON no contiene comandos válidos para importar.');
        return;
      }

      let addedCount = 0;
      const currentIds = new Set(this.commands.map(c => c.id));
      const targetProfile = this.activeProfile !== 'ALL'
        ? this.activeProfile
        : (parsed.profile && parsed.profile !== 'ALL' ? parsed.profile : null);

      for (const item of cmds) {
        if (!item.label) continue;
        let newId = item.id;
        if (!newId || currentIds.has(newId)) {
          newId = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        }
        currentIds.add(newId);

        const itemProfiles: string[] = Array.isArray(item.profiles) ? [...item.profiles] : [];
        if (targetProfile && !itemProfiles.includes(targetProfile)) {
          itemProfiles.push(targetProfile);
        }

        const newCmd: CmdCommandItem = {
          id: newId,
          label: item.label,
          category: item.category || 'General',
          color: item.color || 'indigo',
          background: !!item.background,
          multiSelect: !!item.multiSelect,
          script: item.script || (item.scripts && item.scripts[0]) || '',
          scripts: item.scripts || [item.script || ''],
          tags: Array.isArray(item.tags) ? item.tags : [],
          profiles: itemProfiles
        };

        this.commands = [...this.commands, newCmd];
        addedCount++;

        if (item.category && !this.explicitCategories.includes(item.category)) {
          this.explicitCategories = [...this.explicitCategories, item.category];
        }
      }

      if (targetProfile && !this.profiles.includes(targetProfile)) {
        this.profiles = [...this.profiles, targetProfile];
      }

      await this.syncData();
      alert(`Se importaron ${addedCount} comando(s) con éxito${targetProfile ? ` bajo el perfil "${targetProfile}"` : ''}.`);
    } catch (err: any) {
      alert('Error al importar comandos desde JSON: ' + (err.message || err));
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

    // El directorio de trabajo para la ejecución es el proyecto activo o el asignado
    let path = 'C:\\';
    if (this.activeProject) {
      path = this.activeProject.path;
    } else if (cmd.projectId) {
      const p = this.projects.find(proj => proj.id === cmd.projectId);
      if (p) path = p.path;
    } else if (cmd.batPath && cmd.batPath.trim()) {
      path = cmd.batPath.trim();
    }

    if (event.selectedScripts.length === 0) {
      alert('Selecciona al menos un script para ejecutar.');
      return;
    }

    const scriptToRun = event.selectedScripts.join(' && ');
    await this.executeInInternalCmd(scriptToRun, path, !!cmd.background, cmd.label);
  }

  async runManualCommand(scriptText: string): Promise<void> {
    const trimmed = (scriptText || '').trim();
    if (!trimmed) return;
    const p = this.activeProject;
    const path = p ? p.path : 'C:\\';

    // Si hay una pestaña activa que no está ejecutando un proceso, reutilizarla como sesión interactiva
    const activeTab = this.logs.find(l => l.id === this.activeLogId);
    if (activeTab && !activeTab.running) {
      await this.executeInInternalCmd(
        trimmed,
        activeTab.path || path,
        true,
        activeTab.label || trimmed,
        activeTab.id,
        true
      );
    } else {
      await this.executeInInternalCmd(trimmed, path, true, trimmed);
    }
  }

  private async executeInInternalCmd(
    scriptToRun: string,
    path: string,
    background: boolean,
    label?: string,
    reuseLogId?: string,
    appendOutput = false
  ): Promise<void> {
    this.consoleMin = false;
    this.logsCleared = false;

    const logId = reuseLogId || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowTime = new Date().toLocaleTimeString();

    if (reuseLogId && this.logs.some(l => l.id === reuseLogId)) {
      this.logs = this.logs.map(l =>
        l.id === reuseLogId
          ? {
              ...l,
              time: nowTime,
              script: scriptToRun,
              running: true,
              exitCode: null,
              output: appendOutput && l.output ? `${l.output}\n${l.path}> ${scriptToRun}\n` : ''
            }
          : l
      );
    } else {
      const newLog: CmdConsoleLog = {
        id: logId,
        label: label || scriptToRun,
        time: nowTime,
        script: scriptToRun,
        path,
        output: '',
        running: true,
        exitCode: null
      };
      this.logs = [...this.logs, newLog];
    }

    this.activeLogId = logId;
    this.lucide.refresh();

    if (this.serverOnline) {
      try {
        await this.api.executeCommandStream(scriptToRun, path, background, (ev) => {
          this.ngZone.run(() => {
            this.logs = this.logs.map(log => {
              if (log.id !== logId) return log;
              if (ev.type === 'start') {
                return {
                  ...log,
                  processId: ev.processId,
                  pid: ev.pid,
                  path: ev.cwd || log.path
                };
              }
              if (ev.type === 'stdout' || ev.type === 'stderr') {
                return {
                  ...log,
                  output: log.output + (ev.text || '')
                };
              }
              if (ev.type === 'exit') {
                return {
                  ...log,
                  running: false,
                  exitCode: ev.code ?? 0
                };
              }
              return log;
            });
          });
        });
      } catch (e: any) {
        this.ngZone.run(() => {
          this.logs = this.logs.map(log =>
            log.id === logId
              ? {
                  ...log,
                  running: false,
                  exitCode: 1,
                  output: log.output + `\n[Error de conexión con servidor local]: ${e?.message || e}\n`
                }
              : log
          );
        });
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

      this.logs = this.logs.map(log =>
        log.id === logId
          ? {
              ...log,
              running: false,
              exitCode: 1,
              output: '[Servidor desconectado] El comando fue copiado al portapapeles.'
            }
          : log
      );
    }
  }

  async stopProcess(processId: string): Promise<void> {
    if (!processId) return;
    try {
      await this.api.killProcess(processId);
      this.logs = this.logs.map(log =>
        log.processId === processId
          ? {
              ...log,
              running: false,
              output: log.output + '\n^C [Proceso detenido por el usuario]\n'
            }
          : log
      );
    } catch (e) {
      console.error('Error al detener proceso:', e);
    }
  }

  async sendInputToProcess(payload: { processId: string; input: string }): Promise<void> {
    if (!payload.processId) return;
    try {
      this.logs = this.logs.map(log =>
        log.processId === payload.processId
          ? { ...log, output: log.output + `> ${payload.input}\n` }
          : log
      );
      await this.api.sendProcessInput(payload.processId, payload.input);
    } catch (e) {
      console.error('Error enviando entrada:', e);
    }
  }
}

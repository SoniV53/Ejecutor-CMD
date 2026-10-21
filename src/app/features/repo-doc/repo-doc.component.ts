import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RepoDocState,
  RepoFolder,
  RepoBranch,
  RepoCommit,
  RepoNote,
  RepoNoteColor
} from './models/repo-doc.models';
import {
  DocApiService,
  DocExplorerItem,
  GitScannedBranch,
  GitScannedCommit
} from '../../core/services/doc-api.service';
import { ConsoleFlowApiService } from '../../core/services/console-flow-api.service';
import { CmdProject } from '../dashboard-cmd/models/cmd.models';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { RepoSidebarTreeComponent } from './components/repo-sidebar-tree/repo-sidebar-tree.component';
import { RepoBranchDetailComponent } from './components/repo-branch-detail/repo-branch-detail.component';
import { RepoModalsComponent } from './components/repo-modals/repo-modals.component';

@Component({
  selector: 'app-repo-doc',
  standalone: true,
  imports: [
    CommonModule,
    RepoSidebarTreeComponent,
    RepoBranchDetailComponent,
    RepoModalsComponent
  ],
  templateUrl: './repo-doc.component.html',
  styleUrls: ['./repo-doc.component.css']
})
export class RepoDocComponent implements OnInit, AfterViewInit {
  readonly BASE_FOLDER = 'json/rama';

  state: RepoDocState = { folders: [], branches: [], commits: [], notes: [] };
  currentBranchId: string | null = null;
  currentFolderId: string | null = null;
  expandedFolders = new Set<string>();

  // Apartado de Análisis Git
  showAnalysisView = false;
  cmdProjects: CmdProject[] = [];
  isAnalyzingGit = false;
  analysisError: string | null = null;
  scannedBranches: GitScannedBranch[] | null = null;
  gitCurrentBranch = '';

  activeFileName = localStorage.getItem('gitDocsActiveFile') || 'proyecto_default.json';
  fileStatusText = 'Cargando...';
  fileSynced = false;

  // Modals state
  showBranchModal = false;
  editingBranch: RepoBranch | null = null;
  defaultBranchFolderId: string | null = null;
  defaultBranchParentId: string | null = null;
  defaultBranchIsMain = false;

  showFolderModal = false;
  editingFolder: RepoFolder | null = null;
  defaultFolderParentId: string | null = null;

  showCommitModal = false;

  showNoteModal = false;
  editingNote: RepoNote | null = null;
  noteTargetType: 'branch' | 'folder' = 'branch';
  noteTargetId = '';

  showFilenameModal = false;
  filenameModalTitle = 'Nombre del Proyecto';
  filenamePlaceholder = 'ej. modulo_login';
  private filenameCallback: ((name: string) => void) | null = null;

  showOpenModal = false;
  jsonFiles: DocExplorerItem[] = [];

  constructor(
    private docApi: DocApiService,
    private consoleFlowApi: ConsoleFlowApiService,
    private lucide: LucideIconService
  ) {}

  ngOnInit(): void {
    this.loadCmdProjects();
    this.initBackendSystem();
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  async loadCmdProjects(): Promise<void> {
    try {
      const workspace = await this.consoleFlowApi.getData();
      this.cmdProjects = workspace.projects || [];
    } catch {
      this.cmdProjects = [];
    }
  }

  get currentFolder(): RepoFolder | null {
    if (!this.currentFolderId) return null;
    return this.state.folders.find(f => f.id === this.currentFolderId) || null;
  }

  get currentBranch(): RepoBranch | null {
    if (!this.currentBranchId) return null;
    return this.state.branches.find(b => b.id === this.currentBranchId) || null;
  }

  get parentBranchName(): string | null {
    const branch = this.currentBranch;
    if (!branch || !branch.parentId) return null;
    const parent = this.state.branches.find(b => b.id === branch.parentId);
    return parent ? parent.name : 'Desconocida';
  }

  get noteTargetLabel(): string {
    if (this.noteTargetType === 'branch') {
      const b = this.state.branches.find(item => item.id === this.noteTargetId);
      return b ? `Rama: ${b.name}` : 'Rama';
    } else {
      const f = this.state.folders.find(item => item.id === this.noteTargetId);
      return f ? `Carpeta: ${f.name}` : 'Carpeta';
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  private updateFileStatusUI(name: string, isSynced = true): void {
    this.fileStatusText = name;
    this.fileSynced = isSynced;
  }

  async initBackendSystem(): Promise<void> {
    try {
      const items = await this.docApi.listDocs(this.BASE_FOLDER);
      if (!items || items.length === 0) {
        await this.ensureDefaultFile();
        return;
      }

      const exists = items.some(i => !i.isFolder && i.name === this.activeFileName);
      if (!exists) {
        const jsonList = items.filter(i => !i.isFolder && i.name.endsWith('.json'));
        if (jsonList.length > 0) {
          this.activeFileName = jsonList[0].name;
        } else {
          await this.ensureDefaultFile();
          return;
        }
      }

      await this.loadActiveFile();
    } catch (e) {
      console.error(e);
      await this.ensureDefaultFile();
    }
  }

  async ensureDefaultFile(): Promise<void> {
    this.activeFileName = 'proyecto_default.json';
    const defaultFolder: RepoFolder = {
      id: this.generateId(),
      name: 'Por Defecto',
      parentId: null,
      desc: 'Carpeta por defecto para ramas recolectadas del análisis Git.',
      isDefault: true
    };
    const defaultState: RepoDocState = {
      folders: [defaultFolder],
      branches: [],
      commits: [],
      notes: []
    };
    try {
      await this.docApi.saveJsonDoc(
        this.activeFileName,
        this.BASE_FOLDER,
        JSON.stringify(defaultState, null, 2)
      );
      this.state = defaultState;
      this.expandedFolders = new Set([defaultFolder.id]);
      localStorage.setItem('gitDocsActiveFile', this.activeFileName);
      this.updateFileStatusUI(this.activeFileName, true);
      this.lucide.refresh();
    } catch {
      this.updateFileStatusUI(this.activeFileName + ' (Off)', false);
    }
  }

  async loadActiveFile(): Promise<void> {
    try {
      this.updateFileStatusUI('Cargando...', false);
      const data = await this.docApi.readFile(`${this.BASE_FOLDER}/${this.activeFileName}`);
      const parsed = JSON.parse(data.content);
      const rawState = parsed.state || parsed;
      const folders: RepoFolder[] = (rawState.folders || []).map((f: RepoFolder) => ({
        ...f,
        isDefault: f.isDefault || f.name.toLowerCase() === 'por defecto'
      }));
      this.state = {
        repoPath: rawState.repoPath || '',
        linkedProjectId: rawState.linkedProjectId || null,
        folders,
        branches: rawState.branches || [],
        commits: rawState.commits || [],
        notes: rawState.notes || []
      };
      // Expandir por defecto las carpetas raíz para facilitar navegación
      this.expandedFolders = new Set(folders.filter(f => !f.parentId).map(f => f.id));
      this.scannedBranches = null;
      this.analysisError = null;
      localStorage.setItem('gitDocsActiveFile', this.activeFileName);
      this.updateFileStatusUI(this.activeFileName, true);
      this.lucide.refresh();
    } catch {
      this.updateFileStatusUI(this.activeFileName + ' (Error lectura)', false);
    }
  }

  saveStateLocally(): void {
    if (!this.activeFileName) return;
    this.updateFileStatusUI(this.activeFileName, false);
    const dataToSave = JSON.stringify(this.state, null, 2);

    this.docApi
      .saveJsonDoc(this.activeFileName, this.BASE_FOLDER, dataToSave)
      .then(data => {
        if (data.status === 'success') {
          this.updateFileStatusUI(this.activeFileName, true);
        } else {
          this.updateFileStatusUI(this.activeFileName + ' (Error)', false);
        }
      })
      .catch(() => {
        this.updateFileStatusUI(this.activeFileName + ' (Off)', false);
      });
  }

  guardarArchivoForzado(): void {
    this.saveStateLocally();
  }

  // Asegura que exista la carpeta "Por Defecto" y devuelve su referencia
  private ensureDefaultFolderInState(): RepoFolder {
    let defFolder = this.state.folders.find(
      f => f.isDefault || f.name.trim().toLowerCase() === 'por defecto'
    );
    if (!defFolder) {
      defFolder = {
        id: this.generateId(),
        name: 'Por Defecto',
        parentId: null,
        desc: 'Carpeta por defecto donde se agrupan las ramas recolectadas del análisis Git.',
        isDefault: true
      };
      this.state = {
        ...this.state,
        folders: [defFolder, ...this.state.folders]
      };
    } else if (!defFolder.isDefault) {
      defFolder.isDefault = true;
    }
    const nextExpanded = new Set(this.expandedFolders);
    nextExpanded.add(defFolder.id);
    this.expandedFolders = nextExpanded;
    return defFolder;
  }

  // File Modals
  openFilenameModal(title: string, placeholder: string, callback: (val: string) => void): void {
    this.filenameModalTitle = title;
    this.filenamePlaceholder = placeholder;
    this.filenameCallback = callback;
    this.showFilenameModal = true;
  }

  onConfirmFilename(val: string): void {
    if (this.filenameCallback) {
      this.filenameCallback(val);
    }
    this.showFilenameModal = false;
    this.filenameCallback = null;
  }

  crearNuevoArchivo(): void {
    this.openFilenameModal('Nuevo Proyecto', 'ej. mi_proyecto', rawName => {
      const cleanName = (rawName || '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
      if (!cleanName) return;

      const defaultFolder: RepoFolder = {
        id: this.generateId(),
        name: 'Por Defecto',
        parentId: null,
        desc: 'Carpeta por defecto donde se agrupan las ramas recolectadas del análisis Git.',
        isDefault: true
      };

      this.state = {
        folders: [defaultFolder],
        branches: [],
        commits: [],
        notes: []
      };
      this.currentBranchId = null;
      this.currentFolderId = null;
      this.showAnalysisView = false;
      this.scannedBranches = null;
      this.expandedFolders = new Set([defaultFolder.id]);

      this.activeFileName = cleanName + '.json';
      localStorage.setItem('gitDocsActiveFile', this.activeFileName);
      this.saveStateLocally();
      this.lucide.refresh();
    });
  }

  guardarArchivoComo(): void {
    this.openFilenameModal('Guardar Como', 'Nombre del archivo copia', rawName => {
      const cleanName = (rawName || '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
      if (!cleanName) return;
      this.activeFileName = cleanName + '.json';
      localStorage.setItem('gitDocsActiveFile', this.activeFileName);
      this.saveStateLocally();
    });
  }

  async abrirArchivo(): Promise<void> {
    try {
      const items = await this.docApi.listDocs(this.BASE_FOLDER);
      this.jsonFiles = items.filter(i => !i.isFolder && i.name.endsWith('.json'));
      this.showOpenModal = true;
      this.lucide.refresh();
    } catch {
      alert('Error al conectar con la carpeta');
    }
  }

  async selectFileToOpen(fileName: string): Promise<void> {
    this.activeFileName = fileName;
    this.showOpenModal = false;
    this.currentBranchId = null;
    this.currentFolderId = null;
    this.showAnalysisView = false;
    await this.loadActiveFile();
  }

  // =========================================================
  // APARTADO DE ANÁLISIS GIT
  // =========================================================
  openAnalysisPanel(): void {
    this.showAnalysisView = true;
    this.lucide.refresh();
  }

  async onRunGitAnalysis(payload: {
    repoPath: string;
    linkedProjectId: string | null;
    includeRemote: boolean;
  }): Promise<void> {
    this.isAnalyzingGit = true;
    this.analysisError = null;

    this.state = {
      ...this.state,
      repoPath: payload.repoPath,
      linkedProjectId: payload.linkedProjectId
    };
    this.saveStateLocally();

    try {
      const res = await this.docApi.analyzeGitRepository(payload.repoPath, payload.includeRemote);
      this.scannedBranches = res.branches || [];
      this.gitCurrentBranch = res.currentBranch || '';
    } catch (err: any) {
      this.analysisError = err?.message || 'Error al analizar el repositorio Git.';
      this.scannedBranches = null;
    } finally {
      this.isAnalyzingGit = false;
      this.lucide.refresh();
    }
  }

  onImportMissingBranches(payload: {
    branches: GitScannedBranch[];
    targetFolderId: string | 'DEFAULT';
    parentBranchId: string | null;
    mainBranchNames: string[];
    includeLastCommit: boolean;
  }): void {
    let resolvedFolderId: string | null = null;
    if (payload.targetFolderId === 'DEFAULT') {
      const defFolder = this.ensureDefaultFolderInState();
      resolvedFolderId = defFolder.id;
    } else {
      resolvedFolderId = payload.targetFolderId || null;
    }

    if (resolvedFolderId) {
      this.expandFolderAncestors(resolvedFolderId);
    }

    const existingNames = new Set(
      this.state.branches.map(b => b.name.trim().toLowerCase())
    );
    const mainNamesSet = new Set(payload.mainBranchNames.map(n => n.trim().toLowerCase()));

    const newBranches: RepoBranch[] = [];
    const newCommits: RepoCommit[] = [];

    for (const sb of payload.branches) {
      const normName = sb.name.trim().toLowerCase();
      if (existingNames.has(normName)) continue;
      existingNames.add(normName);

      const branchId = this.generateId();
      const isMain = mainNamesSet.has(normName);

      newBranches.push({
        id: branchId,
        name: sb.name.trim(),
        desc: sb.lastCommitMsg
          ? `Rama recolectada desde Git. Último commit (${sb.lastCommitHash}): ${sb.lastCommitMsg}`
          : 'Rama recolectada desde el análisis del repositorio Git.',
        folderId: resolvedFolderId,
        parentId: payload.parentBranchId || null,
        isMain,
        isRemote: sb.isRemote,
        createdAt: sb.lastCommitDate || new Date().toISOString(),
        lastCommitHash: sb.lastCommitHash,
        lastCommitMsg: sb.lastCommitMsg
      });

      if (payload.includeLastCommit && sb.lastCommitHash && sb.lastCommitMsg) {
        newCommits.push({
          id: this.generateId(),
          branchId,
          hash: sb.lastCommitHash,
          message: sb.lastCommitMsg,
          date: sb.lastCommitDate || new Date().toISOString()
        });
      }
    }

    if (newBranches.length === 0) return;

    this.state = {
      ...this.state,
      branches: [...this.state.branches, ...newBranches],
      commits: [...this.state.commits, ...newCommits]
    };

    // Forzar refresco de la lista en el panel de análisis
    if (this.scannedBranches) {
      this.scannedBranches = [...this.scannedBranches];
    }

    this.saveStateLocally();
    this.lucide.refresh();
  }

  private expandFolderAncestors(folderId: string): void {
    const next = new Set(this.expandedFolders);
    let currId: string | null = folderId;
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      visited.add(currId);
      next.add(currId);
      const f = this.state.folders.find(item => item.id === currId);
      currId = f ? f.parentId : null;
    }
    this.expandedFolders = next;
  }

  // =========================================================
  // TREE NAVIGATION & CRUD (CARPETAS, SUBCARPETAS, RAMAS)
  // =========================================================
  toggleFolder(event: { folderId: string; event: Event }): void {
    const next = new Set(this.expandedFolders);
    if (next.has(event.folderId)) {
      next.delete(event.folderId);
    } else {
      next.add(event.folderId);
    }
    this.expandedFolders = next;
    this.lucide.refresh();
  }

  showFolderDetails(id: string): void {
    this.currentFolderId = id;
    this.currentBranchId = null;
    this.showAnalysisView = false;
    this.expandFolderAncestors(id);
    this.lucide.refresh();
  }

  showBranchDetails(id: string): void {
    this.currentBranchId = id;
    this.currentFolderId = null;
    this.showAnalysisView = false;
    const branch = this.state.branches.find(b => b.id === id);
    if (branch && branch.folderId) {
      this.expandFolderAncestors(branch.folderId);
    }
    this.lucide.refresh();
  }

  openNewFolderModal(parentId: string | null = null): void {
    this.editingFolder = null;
    this.defaultFolderParentId = parentId;
    this.showFolderModal = true;
  }

  editCurrentFolder(): void {
    if (!this.currentFolder) return;
    this.editingFolder = this.currentFolder;
    this.defaultFolderParentId = this.currentFolder.parentId;
    this.showFolderModal = true;
  }

  onSaveFolder(payload: {
    id?: string;
    name: string;
    desc: string;
    parentId: string | null;
  }): void {
    if (payload.id) {
      this.state = {
        ...this.state,
        folders: this.state.folders.map(f =>
          f.id === payload.id
            ? { ...f, name: payload.name, desc: payload.desc, parentId: payload.parentId }
            : f
        )
      };
      if (payload.parentId) {
        this.expandFolderAncestors(payload.parentId);
      }
    } else {
      const newFolder: RepoFolder = {
        id: this.generateId(),
        name: payload.name,
        desc: payload.desc,
        parentId: payload.parentId
      };
      this.state = {
        ...this.state,
        folders: [...this.state.folders, newFolder]
      };
      this.expandFolderAncestors(newFolder.id);
    }
    this.saveStateLocally();
    this.showFolderModal = false;
    this.editingFolder = null;
    this.lucide.refresh();
  }

  onMoveFolderParent(payload: { folderId: string; parentId: string | null }): void {
    if (payload.folderId === payload.parentId) return;
    this.state = {
      ...this.state,
      folders: this.state.folders.map(f =>
        f.id === payload.folderId ? { ...f, parentId: payload.parentId } : f
      )
    };
    if (payload.parentId) {
      this.expandFolderAncestors(payload.parentId);
    }
    this.saveStateLocally();
    this.lucide.refresh();
  }

  deleteCurrentFolder(): void {
    if (!this.currentFolderId) return;
    const targetFolder = this.currentFolder;
    if (!targetFolder) return;

    if (
      confirm(
        `¿Eliminar la carpeta "${targetFolder.name}"? Sus subcarpetas y ramas pasarán al nivel superior.`
      )
    ) {
      const targetId = targetFolder.id;
      const fallbackParentId = targetFolder.parentId || null;

      this.state = {
        ...this.state,
        folders: this.state.folders
          .filter(f => f.id !== targetId)
          .map(f => (f.parentId === targetId ? { ...f, parentId: fallbackParentId } : f)),
        branches: this.state.branches.map(b =>
          b.folderId === targetId ? { ...b, folderId: fallbackParentId } : b
        ),
        notes: (this.state.notes || []).filter(
          n => !(n.targetType === 'folder' && n.targetId === targetId)
        )
      };
      this.currentFolderId = fallbackParentId;
      this.saveStateLocally();
      this.lucide.refresh();
    }
  }

  openNewBranchModal(defaults?: {
    folderId?: string | null;
    parentId?: string | null;
    isMain?: boolean;
  }): void {
    this.editingBranch = null;
    this.defaultBranchFolderId =
      defaults?.folderId !== undefined ? defaults.folderId : this.currentFolderId;
    this.defaultBranchParentId = defaults?.parentId || null;
    this.defaultBranchIsMain = !!defaults?.isMain;
    this.showBranchModal = true;
  }

  openNewChildBranchModal(parentBranch: RepoBranch): void {
    this.openNewBranchModal({
      folderId: parentBranch.folderId,
      parentId: parentBranch.id,
      isMain: false
    });
  }

  editCurrentBranch(): void {
    if (!this.currentBranch) return;
    this.editingBranch = this.currentBranch;
    this.showBranchModal = true;
  }

  onSaveBranch(payload: {
    id?: string;
    name: string;
    desc: string;
    folderId: string | null;
    parentId: string | null;
    isMain: boolean;
  }): void {
    if (payload.id) {
      this.state = {
        ...this.state,
        branches: this.state.branches.map(b =>
          b.id === payload.id
            ? {
                ...b,
                name: payload.name,
                desc: payload.desc,
                folderId: payload.folderId,
                parentId: payload.parentId,
                isMain: payload.isMain
              }
            : b
        )
      };
      if (payload.folderId) {
        this.expandFolderAncestors(payload.folderId);
      }
    } else {
      const newBranch: RepoBranch = {
        id: this.generateId(),
        name: payload.name,
        desc: payload.desc,
        folderId: payload.folderId,
        parentId: payload.parentId,
        isMain: payload.isMain,
        createdAt: new Date().toISOString()
      };
      this.state = {
        ...this.state,
        branches: [...this.state.branches, newBranch]
      };
      if (payload.folderId) {
        this.expandFolderAncestors(payload.folderId);
      }
      this.currentBranchId = newBranch.id;
      this.currentFolderId = null;
      this.showAnalysisView = false;
    }
    this.saveStateLocally();
    this.showBranchModal = false;
    this.editingBranch = null;
    this.lucide.refresh();
  }

  onToggleMainBranch(branchId: string): void {
    this.state = {
      ...this.state,
      branches: this.state.branches.map(b =>
        b.id === branchId ? { ...b, isMain: !b.isMain } : b
      )
    };
    this.saveStateLocally();
    this.lucide.refresh();
  }

  onMoveBranchFolder(payload: { branchId: string; folderId: string | null }): void {
    this.state = {
      ...this.state,
      branches: this.state.branches.map(b =>
        b.id === payload.branchId ? { ...b, folderId: payload.folderId } : b
      )
    };
    if (payload.folderId) {
      this.expandFolderAncestors(payload.folderId);
    }
    this.saveStateLocally();
    this.lucide.refresh();
  }

  onChangeBranchParent(payload: { branchId: string; parentId: string | null }): void {
    if (payload.branchId === payload.parentId) return;
    this.state = {
      ...this.state,
      branches: this.state.branches.map(b =>
        b.id === payload.branchId ? { ...b, parentId: payload.parentId } : b
      )
    };
    this.saveStateLocally();
    this.lucide.refresh();
  }

  deleteCurrentBranch(): void {
    if (!this.currentBranchId) return;
    if (confirm('¿Eliminar esta rama, sus notas y su historial de commits?')) {
      const targetId = this.currentBranchId;
      this.state = {
        ...this.state,
        branches: this.state.branches
          .filter(b => b.id !== targetId)
          .map(b => (b.parentId === targetId ? { ...b, parentId: null } : b)),
        commits: this.state.commits.filter(c => c.branchId !== targetId),
        notes: (this.state.notes || []).filter(
          n => !(n.targetType === 'branch' && n.targetId === targetId)
        )
      };
      this.currentBranchId = null;
      this.saveStateLocally();
      this.lucide.refresh();
    }
  }

  // =========================================================
  // COMMITS CRUD & GIT COMMITS IMPORT
  // =========================================================
  onUpdateRepoPath(newPath: string): void {
    this.state = {
      ...this.state,
      repoPath: newPath
    };
    this.saveStateLocally();
  }

  onImportBranchCommits(payload: { branchId: string; commits: GitScannedCommit[] }): void {
    const existingHashes = new Set(
      this.state.commits
        .filter(c => c.branchId === payload.branchId)
        .map(c => (c.hash || '').trim().toLowerCase())
    );

    const addedCommits: RepoCommit[] = [];
    for (const gc of payload.commits) {
      const normHash = (gc.hash || '').trim().toLowerCase();
      if (!normHash || existingHashes.has(normHash)) continue;
      existingHashes.add(normHash);

      addedCommits.push({
        id: this.generateId(),
        branchId: payload.branchId,
        hash: gc.hash.trim(),
        message: gc.message,
        date: gc.date || new Date().toISOString()
      });
    }

    if (addedCommits.length === 0) return;

    this.state = {
      ...this.state,
      commits: [...this.state.commits, ...addedCommits]
    };
    this.saveStateLocally();
    this.lucide.refresh();
  }

  onSaveCommit(payload: { hash: string; message: string }): void {
    if (!this.currentBranchId) return;
    const hash = payload.hash || this.generateId().substring(0, 7);
    this.state = {
      ...this.state,
      commits: [
        ...this.state.commits,
        {
          id: this.generateId(),
          branchId: this.currentBranchId,
          hash,
          message: payload.message,
          date: new Date().toISOString()
        }
      ]
    };
    this.saveStateLocally();
    this.showCommitModal = false;
    this.lucide.refresh();
  }

  deleteCommit(commitId: string): void {
    if (confirm('¿Eliminar este commit?')) {
      this.state = {
        ...this.state,
        commits: this.state.commits.filter(c => c.id !== commitId)
      };
      this.saveStateLocally();
      this.lucide.refresh();
    }
  }

  // =========================================================
  // NOTAS POR RAMA Y POR CARPETA CRUD
  // =========================================================
  openNewNoteModal(payload: { targetType: 'branch' | 'folder'; targetId: string }): void {
    this.editingNote = null;
    this.noteTargetType = payload.targetType;
    this.noteTargetId = payload.targetId;
    this.showNoteModal = true;
  }

  openEditNoteModal(note: RepoNote): void {
    this.editingNote = note;
    this.noteTargetType = note.targetType;
    this.noteTargetId = note.targetId;
    this.showNoteModal = true;
  }

  onSaveNote(payload: {
    id?: string;
    title: string;
    content: string;
    color: RepoNoteColor;
    pinned: boolean;
  }): void {
    const currentNotes = this.state.notes || [];
    if (payload.id) {
      this.state = {
        ...this.state,
        notes: currentNotes.map(n =>
          n.id === payload.id
            ? {
                ...n,
                title: payload.title,
                content: payload.content,
                color: payload.color,
                pinned: payload.pinned,
                updatedAt: new Date().toISOString()
              }
            : n
        )
      };
    } else {
      const newNote: RepoNote = {
        id: this.generateId(),
        targetType: this.noteTargetType,
        targetId: this.noteTargetId,
        title: payload.title,
        content: payload.content,
        color: payload.color,
        pinned: payload.pinned,
        createdAt: new Date().toISOString()
      };
      this.state = {
        ...this.state,
        notes: [newNote, ...currentNotes]
      };
    }

    this.saveStateLocally();
    this.showNoteModal = false;
    this.editingNote = null;
    this.lucide.refresh();
  }

  onTogglePinNote(noteId: string): void {
    this.state = {
      ...this.state,
      notes: (this.state.notes || []).map(n =>
        n.id === noteId ? { ...n, pinned: !n.pinned } : n
      )
    };
    this.saveStateLocally();
    this.lucide.refresh();
  }

  onDeleteNote(noteId: string): void {
    if (confirm('¿Eliminar esta nota?')) {
      this.state = {
        ...this.state,
        notes: (this.state.notes || []).filter(n => n.id !== noteId)
      };
      this.saveStateLocally();
      this.lucide.refresh();
    }
  }
}


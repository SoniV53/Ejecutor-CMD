import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepoDocState, RepoFolder, RepoBranch } from './models/repo-doc.models';
import { DocApiService, DocExplorerItem } from '../../core/services/doc-api.service';
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

  state: RepoDocState = { folders: [], branches: [], commits: [] };
  currentBranchId: string | null = null;
  currentFolderId: string | null = null;
  expandedFolders = new Set<string>();

  activeFileName = localStorage.getItem('gitDocsActiveFile') || 'proyecto_default.json';
  fileStatusText = 'Cargando...';
  fileSynced = false;

  // Modals state
  showBranchModal = false;
  editingBranch: RepoBranch | null = null;

  showFolderModal = false;
  editingFolder: RepoFolder | null = null;

  showCommitModal = false;

  showFilenameModal = false;
  filenameModalTitle = 'Nombre del Proyecto';
  filenamePlaceholder = 'ej. modulo_login';
  private filenameCallback: ((name: string) => void) | null = null;

  showOpenModal = false;
  jsonFiles: DocExplorerItem[] = [];

  constructor(
    private docApi: DocApiService,
    private lucide: LucideIconService
  ) {}

  ngOnInit(): void {
    this.initBackendSystem();
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
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
    const defaultState: RepoDocState = { folders: [], branches: [], commits: [] };
    try {
      await this.docApi.saveJsonDoc(
        this.activeFileName,
        this.BASE_FOLDER,
        JSON.stringify(defaultState, null, 2)
      );
      this.state = defaultState;
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
      this.state = {
        folders: rawState.folders || [],
        branches: rawState.branches || [],
        commits: rawState.commits || []
      };
      this.expandedFolders = new Set();
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

      this.state = { folders: [], branches: [], commits: [] };
      this.currentBranchId = null;
      this.currentFolderId = null;
      this.expandedFolders = new Set();

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
    await this.loadActiveFile();
  }

  // Tree navigation & CRUD
  toggleFolder(event: { folderId: string; event: Event }): void {
    const next = new Set(this.expandedFolders);
    if (next.has(event.folderId)) {
      next.delete(event.folderId);
    } else {
      next.add(event.folderId);
    }
    this.expandedFolders = next;
    this.saveStateLocally();
    this.lucide.refresh();
  }

  showFolderDetails(id: string): void {
    this.currentFolderId = id;
    this.currentBranchId = null;
    this.lucide.refresh();
  }

  showBranchDetails(id: string): void {
    this.currentBranchId = id;
    this.currentFolderId = null;
    this.lucide.refresh();
  }

  openNewFolderModal(): void {
    this.editingFolder = null;
    this.showFolderModal = true;
  }

  editCurrentFolder(): void {
    if (!this.currentFolder) return;
    this.editingFolder = this.currentFolder;
    this.showFolderModal = true;
  }

  onSaveFolder(payload: { id?: string; name: string; parentId: string | null }): void {
    if (payload.id) {
      this.state = {
        ...this.state,
        folders: this.state.folders.map(f =>
          f.id === payload.id ? { ...f, name: payload.name, parentId: payload.parentId } : f
        )
      };
    } else {
      this.state = {
        ...this.state,
        folders: [
          ...this.state.folders,
          { id: this.generateId(), name: payload.name, parentId: payload.parentId }
        ]
      };
    }
    this.saveStateLocally();
    this.showFolderModal = false;
    this.editingFolder = null;
    this.lucide.refresh();
  }

  deleteCurrentFolder(): void {
    if (!this.currentFolderId) return;
    if (confirm('¿Eliminar carpeta? Ramas internas perderán esta agrupación.')) {
      const targetId = this.currentFolderId;
      this.state = {
        ...this.state,
        folders: this.state.folders.filter(f => f.id !== targetId),
        branches: this.state.branches.map(b => (b.folderId === targetId ? { ...b, folderId: null } : b))
      };
      this.currentFolderId = null;
      this.saveStateLocally();
      this.lucide.refresh();
    }
  }

  openNewBranchModal(): void {
    this.editingBranch = null;
    this.showBranchModal = true;
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
                parentId: payload.parentId
              }
            : b
        )
      };
    } else {
      this.state = {
        ...this.state,
        branches: [
          ...this.state.branches,
          {
            id: this.generateId(),
            name: payload.name,
            desc: payload.desc,
            folderId: payload.folderId,
            parentId: payload.parentId,
            createdAt: new Date().toISOString()
          }
        ]
      };
    }
    this.saveStateLocally();
    this.showBranchModal = false;
    this.editingBranch = null;
    this.lucide.refresh();
  }

  deleteCurrentBranch(): void {
    if (!this.currentBranchId) return;
    if (confirm('¿Eliminar esta rama y TODOS sus commits?')) {
      const targetId = this.currentBranchId;
      this.state = {
        ...this.state,
        branches: this.state.branches.filter(b => b.id !== targetId),
        commits: this.state.commits.filter(c => c.branchId !== targetId)
      };
      this.currentBranchId = null;
      this.saveStateLocally();
      this.lucide.refresh();
    }
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
}

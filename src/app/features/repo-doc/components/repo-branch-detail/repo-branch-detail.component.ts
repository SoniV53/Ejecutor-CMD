import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RepoFolder,
  RepoBranch,
  RepoCommit,
  RepoNote,
  RepoDocState
} from '../../models/repo-doc.models';
import {
  DocApiService,
  GitScannedBranch,
  BrowseDirectoriesResponse,
  DirectoryEntry
} from '../../../../core/services/doc-api.service';
import { CmdProject } from '../../../dashboard-cmd/models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

declare const html2pdf: any;

@Component({
  selector: 'app-repo-branch-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repo-branch-detail.component.html',
  styleUrls: ['./repo-branch-detail.component.css']
})
export class RepoBranchDetailComponent implements OnChanges, AfterViewInit {
  @Input() state: RepoDocState = { folders: [], branches: [], commits: [], notes: [] };
  @Input() currentFolder: RepoFolder | null = null;
  @Input() currentBranch: RepoBranch | null = null;
  @Input() parentBranchName: string | null = null;
  @Input() commits: RepoCommit[] = [];

  // Analysis inputs
  @Input() showAnalysisView = false;
  @Input() cmdProjects: CmdProject[] = [];
  @Input() isAnalyzingGit = false;
  @Input() analysisError: string | null = null;
  @Input() scannedBranches: GitScannedBranch[] | null = null;
  @Input() gitCurrentBranch = '';

  // Analysis outputs
  @Output() closeAnalysisView = new EventEmitter<void>();
  @Output() runGitAnalysis = new EventEmitter<{
    repoPath: string;
    linkedProjectId: string | null;
    includeRemote: boolean;
  }>();
  @Output() importMissingBranches = new EventEmitter<{
    branches: GitScannedBranch[];
    targetFolderId: string | 'DEFAULT';
    parentBranchId: string | null;
    mainBranchNames: string[];
    includeLastCommit: boolean;
  }>();

  // Folder outputs
  @Output() editFolder = new EventEmitter<void>();
  @Output() deleteFolder = new EventEmitter<void>();
  @Output() selectFolder = new EventEmitter<string>();
  @Output() openNewSubfolder = new EventEmitter<string>();
  @Output() openNewBranchInFolder = new EventEmitter<string>();
  @Output() moveFolderParent = new EventEmitter<{ folderId: string; parentId: string | null }>();

  // Branch outputs
  @Output() editBranch = new EventEmitter<void>();
  @Output() deleteBranch = new EventEmitter<void>();
  @Output() selectBranch = new EventEmitter<string>();
  @Output() toggleMainBranch = new EventEmitter<string>();
  @Output() moveBranchFolder = new EventEmitter<{ branchId: string; folderId: string | null }>();
  @Output() changeBranchParent = new EventEmitter<{ branchId: string; parentId: string | null }>();
  @Output() openNewChildBranch = new EventEmitter<RepoBranch>();
  @Output() openCommitModal = new EventEmitter<void>();
  @Output() deleteCommit = new EventEmitter<string>();

  // Note outputs
  @Output() openNewNoteModal = new EventEmitter<{ targetType: 'branch' | 'folder'; targetId: string }>();
  @Output() editNote = new EventEmitter<RepoNote>();
  @Output() togglePinNote = new EventEmitter<string>();
  @Output() deleteNote = new EventEmitter<string>();

  @ViewChild('branchContentRef') branchContentRef!: ElementRef<HTMLElement>;

  sortedCommits: RepoCommit[] = [];

  // Analysis form state
  selectedProjectId = '';
  analysisRepoPath = '';
  includeRemoteBranches = false;
  importTargetFolderId = 'DEFAULT';
  importParentBranchId = '';
  importIncludeLastCommit = true;

  selectedMissingNames = new Set<string>();
  markedAsMainNames = new Set<string>();

  // Modal Explorador de Directorios
  showDirPickerModal = false;
  isLoadingDirs = false;
  dirBrowserData: BrowseDirectoriesResponse | null = null;
  dirSearchFilter = '';

  constructor(
    private docApi: DocApiService,
    private lucide: LucideIconService
  ) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.currentBranch) {
      this.sortedCommits = [];
    } else {
      this.sortedCommits = (this.commits || [])
        .filter(c => c.branchId === this.currentBranch!.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    if (changes['state'] || changes['cmdProjects'] || changes['showAnalysisView']) {
      if (this.state.repoPath && !this.analysisRepoPath) {
        this.analysisRepoPath = this.state.repoPath;
      }
      if (this.state.linkedProjectId && !this.selectedProjectId) {
        this.selectedProjectId = this.state.linkedProjectId;
      }
      if (!this.analysisRepoPath && this.cmdProjects.length > 0) {
        const matched =
          this.cmdProjects.find(p => p.id === this.state.linkedProjectId) || this.cmdProjects[0];
        if (matched) {
          this.selectedProjectId = matched.id;
          this.analysisRepoPath = matched.path;
        }
      }
    }

    if (changes['scannedBranches'] && this.scannedBranches) {
      const missing = this.missingScannedBranches;
      this.selectedMissingNames = new Set(missing.map(b => b.name));
      this.markedAsMainNames = new Set(
        missing
          .filter(b =>
            ['main', 'master', 'develop', 'dev', 'trunk'].includes(b.name.toLowerCase())
          )
          .map(b => b.name)
      );
    }

    this.lucide.refresh();
  }

  onSelectCmdProject(projectId: string): void {
    this.selectedProjectId = projectId;
    const found = this.cmdProjects.find(p => p.id === projectId);
    if (found) {
      this.analysisRepoPath = found.path;
    }
  }

  async openDirPickerModal(): Promise<void> {
    this.showDirPickerModal = true;
    this.dirSearchFilter = '';
    await this.loadDirectoryLevel(this.analysisRepoPath || '');
  }

  closeDirPickerModal(): void {
    this.showDirPickerModal = false;
  }

  async loadDirectoryLevel(targetPath: string): Promise<void> {
    this.isLoadingDirs = true;
    this.dirSearchFilter = '';
    try {
      this.dirBrowserData = await this.docApi.browseDirectories(targetPath);
    } catch {
      // Fallback to root if path was invalid
      try {
        this.dirBrowserData = await this.docApi.browseDirectories('');
      } catch {
        this.dirBrowserData = null;
      }
    } finally {
      this.isLoadingDirs = false;
      this.lucide.refresh();
    }
  }

  get filteredDirectories(): DirectoryEntry[] {
    if (!this.dirBrowserData) return [];
    const q = this.dirSearchFilter.trim().toLowerCase();
    if (!q) return this.dirBrowserData.directories;
    return this.dirBrowserData.directories.filter(d => d.name.toLowerCase().includes(q));
  }

  selectDirectoryFromModal(chosenPath: string): void {
    if (!chosenPath) return;
    this.analysisRepoPath = chosenPath;
    // Verificar si coincide con algún proyecto de Ejecutor CMD
    const matchedProj = this.cmdProjects.find(
      p => p.path.trim().toLowerCase() === chosenPath.trim().toLowerCase()
    );
    this.selectedProjectId = matchedProj ? matchedProj.id : '';
    this.showDirPickerModal = false;
    this.lucide.refresh();
  }

  triggerAnalysis(): void {
    if (!this.analysisRepoPath.trim()) return;
    this.runGitAnalysis.emit({
      repoPath: this.analysisRepoPath.trim(),
      linkedProjectId: this.selectedProjectId || null,
      includeRemote: this.includeRemoteBranches
    });
  }

  private normalizeBranchName(name: string): string {
    return (name || '').trim().toLowerCase();
  }

  get existingScannedBranches(): GitScannedBranch[] {
    if (!this.scannedBranches) return [];
    const existingSet = new Set(
      (this.state.branches || []).map(b => this.normalizeBranchName(b.name))
    );
    return this.scannedBranches.filter(sb => existingSet.has(this.normalizeBranchName(sb.name)));
  }

  get missingScannedBranches(): GitScannedBranch[] {
    if (!this.scannedBranches) return [];
    const existingSet = new Set(
      (this.state.branches || []).map(b => this.normalizeBranchName(b.name))
    );
    return this.scannedBranches.filter(sb => !existingSet.has(this.normalizeBranchName(sb.name)));
  }

  isMissingBranchSelected(name: string): boolean {
    return this.selectedMissingNames.has(name);
  }

  toggleMissingBranchSelection(name: string): void {
    const next = new Set(this.selectedMissingNames);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    this.selectedMissingNames = next;
  }

  selectAllMissing(): void {
    this.selectedMissingNames = new Set(this.missingScannedBranches.map(b => b.name));
  }

  deselectAllMissing(): void {
    this.selectedMissingNames = new Set();
  }

  isMarkedAsMain(name: string): boolean {
    return this.markedAsMainNames.has(name);
  }

  toggleMarkAsMain(name: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.markedAsMainNames);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    this.markedAsMainNames = next;
  }

  importSelectedBranches(): void {
    const toImport = this.missingScannedBranches.filter(b =>
      this.selectedMissingNames.has(b.name)
    );
    if (toImport.length === 0) return;

    this.importMissingBranches.emit({
      branches: toImport,
      targetFolderId: this.importTargetFolderId || 'DEFAULT',
      parentBranchId: this.importParentBranchId || null,
      mainBranchNames: Array.from(this.markedAsMainNames),
      includeLastCommit: this.importIncludeLastCommit
    });
  }

  importSingleBranch(branch: GitScannedBranch, event: Event): void {
    event.stopPropagation();
    this.importMissingBranches.emit({
      branches: [branch],
      targetFolderId: this.importTargetFolderId || 'DEFAULT',
      parentBranchId: this.importParentBranchId || null,
      mainBranchNames: Array.from(this.markedAsMainNames),
      includeLastCommit: this.importIncludeLastCommit
    });
  }

  findExistingBranchByName(name: string): RepoBranch | undefined {
    const norm = this.normalizeBranchName(name);
    return (this.state.branches || []).find(b => this.normalizeBranchName(b.name) === norm);
  }

  // Helpers para Carpetas y Subcarpetas
  getFolderPathLabel(folder: RepoFolder): string {
    const parts: string[] = [folder.name];
    let currentParentId = folder.parentId;
    const visited = new Set<string>([folder.id]);

    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      const parent = (this.state.folders || []).find(f => f.id === currentParentId);
      if (parent) {
        parts.unshift(parent.name);
        currentParentId = parent.parentId;
      } else {
        break;
      }
    }
    return parts.join(' / ');
  }

  getFolderBreadcrumbs(folder: RepoFolder): RepoFolder[] {
    const trail: RepoFolder[] = [];
    let curr: RepoFolder | undefined = folder;
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      trail.unshift(curr);
      curr = curr.parentId
        ? (this.state.folders || []).find(f => f.id === curr!.parentId)
        : undefined;
    }
    return trail;
  }

  getAvailableParentFoldersFor(folder: RepoFolder): RepoFolder[] {
    return (this.state.folders || []).filter(f => !this.isDescendantFolder(f.id, folder.id));
  }

  private isDescendantFolder(candidateId: string, targetFolderId: string): boolean {
    let currId: string | null = candidateId;
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      if (currId === targetFolderId) return true;
      visited.add(currId);
      const folder = (this.state.folders || []).find(f => f.id === currId);
      currId = folder ? folder.parentId : null;
    }
    return false;
  }

  get currentSubfolders(): RepoFolder[] {
    if (!this.currentFolder) return [];
    return (this.state.folders || []).filter(f => f.parentId === this.currentFolder!.id);
  }

  get currentFolderBranches(): RepoBranch[] {
    if (!this.currentFolder) return [];
    return (this.state.branches || [])
      .filter(b => b.folderId === this.currentFolder!.id)
      .sort((a, b) => (a.isMain === b.isMain ? 0 : a.isMain ? -1 : 1));
  }

  // Helpers para Ramas y Ramas Principales
  get currentBranchChildren(): RepoBranch[] {
    if (!this.currentBranch) return [];
    return (this.state.branches || []).filter(b => b.parentId === this.currentBranch!.id);
  }

  get availableParentBranchesForCurrent(): RepoBranch[] {
    if (!this.currentBranch) return [];
    return (this.state.branches || []).filter(b => b.id !== this.currentBranch!.id);
  }

  get parentBranchObj(): RepoBranch | null {
    if (!this.currentBranch || !this.currentBranch.parentId) return null;
    return (this.state.branches || []).find(b => b.id === this.currentBranch!.parentId) || null;
  }

  getBranchFolderName(folderId: string | null): string {
    if (!folderId) return 'Raíz (Sin carpeta)';
    const f = (this.state.folders || []).find(item => item.id === folderId);
    return f ? this.getFolderPathLabel(f) : 'Raíz';
  }

  // Helpers para Notas (por Rama y por Carpeta)
  get currentFolderNotes(): RepoNote[] {
    if (!this.currentFolder) return [];
    return this.getNotesForTarget('folder', this.currentFolder.id);
  }

  get currentBranchNotes(): RepoNote[] {
    if (!this.currentBranch) return [];
    return this.getNotesForTarget('branch', this.currentBranch.id);
  }

  private getNotesForTarget(targetType: 'branch' | 'folder', targetId: string): RepoNote[] {
    return (this.state.notes || [])
      .filter(n => n.targetType === targetType && n.targetId === targetId)
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }

  getNoteCardClasses(color: string): string {
    switch (color) {
      case 'amber':
        return 'bg-amber-50/90 border-amber-200 text-amber-950';
      case 'indigo':
        return 'bg-indigo-50/90 border-indigo-200 text-indigo-950';
      case 'emerald':
        return 'bg-emerald-50/90 border-emerald-200 text-emerald-950';
      case 'rose':
        return 'bg-rose-50/90 border-rose-200 text-rose-950';
      default:
        return 'bg-white border-slate-200 text-slate-800';
    }
  }

  getNoteBadgeClasses(color: string): string {
    switch (color) {
      case 'amber':
        return 'bg-amber-200/70 text-amber-900';
      case 'indigo':
        return 'bg-indigo-200/70 text-indigo-900';
      case 'emerald':
        return 'bg-emerald-200/70 text-emerald-900';
      case 'rose':
        return 'bg-rose-200/70 text-rose-900';
      default:
        return 'bg-slate-200 text-slate-700';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      return new Intl.DateTimeFormat('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }

  exportBranchPDF(): void {
    if (!this.currentBranch || !this.branchContentRef) return;
    const element = this.branchContentRef.nativeElement.cloneNode(true) as HTMLElement;
    const noPrintElements = element.querySelectorAll('.no-print');
    noPrintElements.forEach(el => el.remove());

    const opt = {
      margin: 10,
      filename: `Rama_${this.currentBranch.name.replace(/\//g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(opt).from(element).save();
    } else {
      window.print();
    }
  }
}


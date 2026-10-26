import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RepoFolder,
  RepoBranch,
  RepoNote,
  RepoNoteColor,
  RepoTag,
  DEFAULT_REPO_TAGS,
  getTagColorClasses,
  TAG_COLOR_OPTIONS,
  getTagDotClass,
  getTagLabel
} from '../../models/repo-doc.models';
import { DocExplorerItem } from '../../../../core/services/doc-api.service';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';
import { CmdProject } from '../../../dashboard-cmd/models/cmd.models';

@Component({
  selector: 'app-repo-modals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './repo-modals.component.html',
  styleUrls: ['./repo-modals.component.css']
})
export class RepoModalsComponent implements OnChanges, AfterViewInit {
  @Input() showBranchModal = false;
  @Input() editingBranch: RepoBranch | null = null;
  @Input() defaultBranchFolderId: string | null = null;
  @Input() defaultBranchParentId: string | null = null;
  @Input() defaultBranchIsMain = false;

  @Input() showFolderModal = false;
  @Input() editingFolder: RepoFolder | null = null;
  @Input() defaultFolderParentId: string | null = null;

  @Input() showCommitModal = false;

  @Input() showNoteModal = false;
  @Input() editingNote: RepoNote | null = null;
  @Input() noteTargetLabel = '';

  @Input() showNewDocModal = false;
  @Input() cmdProjects: CmdProject[] = [];

  @Input() showFilenameModal = false;
  @Input() filenameModalTitle = 'Nombre del Proyecto';
  @Input() filenamePlaceholder = 'ej. modulo_login';

  @Input() showOpenModal = false;
  @Input() jsonFiles: DocExplorerItem[] = [];
  @Input() activeFileName = '';

  @Input() folders: RepoFolder[] = [];
  @Input() branches: RepoBranch[] = [];
  @Input() availableTags: RepoTag[] = [];

  @Output() closeBranchModal = new EventEmitter<void>();
  @Output() saveBranch = new EventEmitter<{
    id?: string;
    name: string;
    desc: string;
    folderId: string | null;
    parentId: string | null;
    isMain: boolean;
    tags?: string[];
  }>();
  @Output() createNewTag = new EventEmitter<{ name: string; color: string }>();

  @Output() closeFolderModal = new EventEmitter<void>();
  @Output() saveFolder = new EventEmitter<{
    id?: string;
    name: string;
    desc: string;
    parentId: string | null;
  }>();

  @Output() closeCommitModal = new EventEmitter<void>();
  @Output() saveCommit = new EventEmitter<{ hash: string; message: string }>();

  @Output() closeNoteModal = new EventEmitter<void>();
  @Output() saveNote = new EventEmitter<{
    id?: string;
    title: string;
    content: string;
    color: RepoNoteColor;
    pinned: boolean;
  }>();

  @Output() closeNewDocModal = new EventEmitter<void>();
  @Output() createNewDoc = new EventEmitter<{
    name: string;
    repoPath?: string;
    linkedProjectId?: string | null;
    autoScanGit?: boolean;
  }>();

  @Output() closeFilenameModal = new EventEmitter<void>();
  @Output() confirmFilename = new EventEmitter<string>();

  @Output() closeOpenModal = new EventEmitter<void>();
  @Output() selectFileToOpen = new EventEmitter<string>();
  @Output() openNewDocFromOpenModal = new EventEmitter<void>();
  @Output() deleteDocFile = new EventEmitter<string>();

  // New Doc Form
  newDocName = '';
  newDocType: 'blank' | 'git' = 'blank';
  newDocLinkedProjectId = '';
  newDocRepoPath = '';
  newDocAutoScan = true;

  // Branch form
  branchName = '';
  branchDesc = '';
  branchFolderId = '';
  branchParentId = '';
  branchIsMain = false;
  branchTags: string[] = [];
  newTagInput = '';
  newTagColor = 'indigo';

  readonly modalTagColorOptions = TAG_COLOR_OPTIONS;

  getSelectedTagDotClass(color: string): string {
    return getTagDotClass(color);
  }

  getSelectedTagLabel(color: string): string {
    return getTagLabel(color);
  }

  get allAvailableTags(): RepoTag[] {
    return this.availableTags || [];
  }

  isModalTagSelected(tagName: string): boolean {
    return this.branchTags.some(t => t.toLowerCase() === tagName.toLowerCase());
  }

  onToggleModalTag(tagName: string): void {
    const lower = tagName.toLowerCase();
    const idx = this.branchTags.findIndex(t => t.toLowerCase() === lower);
    if (idx > -1) {
      this.branchTags.splice(idx, 1);
    } else {
      this.branchTags.push(tagName);
    }
  }

  onCreateModalTag(): void {
    const trimmed = this.newTagInput.trim();
    if (!trimmed) return;
    this.createNewTag.emit({ name: trimmed, color: this.newTagColor });
    if (!this.isModalTagSelected(trimmed)) {
      this.branchTags.push(trimmed);
    }
    this.newTagInput = '';
  }

  getTagBadgeClasses(color: string): string {
    return getTagColorClasses(color).badge;
  }

  // Folder form
  folderName = '';
  folderDesc = '';
  folderParentId = '';

  // Commit form
  commitHash = '';
  commitMsg = '';

  // Note form
  noteTitle = '';
  noteContent = '';
  noteColor: RepoNoteColor = 'amber';
  notePinned = false;

  readonly noteColors: { value: RepoNoteColor; label: string; dotClass: string; ringClass: string }[] = [
    { value: 'amber', label: 'Ámbar', dotClass: 'bg-amber-400', ringClass: 'ring-amber-400 bg-amber-50 text-amber-800' },
    { value: 'indigo', label: 'Índigo', dotClass: 'bg-indigo-500', ringClass: 'ring-indigo-500 bg-indigo-50 text-indigo-800' },
    { value: 'emerald', label: 'Esmeralda', dotClass: 'bg-emerald-500', ringClass: 'ring-emerald-500 bg-emerald-50 text-emerald-800' },
    { value: 'rose', label: 'Rosa / Alerta', dotClass: 'bg-rose-500', ringClass: 'ring-rose-500 bg-rose-50 text-rose-800' },
    { value: 'slate', label: 'Neutro', dotClass: 'bg-slate-500', ringClass: 'ring-slate-500 bg-slate-100 text-slate-800' }
  ];

  // Filename form
  inputFilename = '';

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showBranchModal'] && this.showBranchModal) {
      if (this.editingBranch) {
        this.branchName = this.editingBranch.name;
        this.branchDesc = this.editingBranch.desc || '';
        this.branchFolderId = this.editingBranch.folderId || '';
        this.branchParentId = this.editingBranch.parentId || '';
        this.branchIsMain = !!this.editingBranch.isMain;
        this.branchTags = Array.isArray(this.editingBranch.tags) ? [...this.editingBranch.tags] : [];
      } else {
        this.branchName = '';
        this.branchDesc = '';
        this.branchFolderId = this.defaultBranchFolderId || '';
        this.branchParentId = this.defaultBranchParentId || '';
        this.branchIsMain = this.defaultBranchIsMain;
        this.branchTags = [];
      }
      this.newTagInput = '';
    }

    if (changes['showFolderModal'] && this.showFolderModal) {
      if (this.editingFolder) {
        this.folderName = this.editingFolder.name;
        this.folderDesc = this.editingFolder.desc || '';
        this.folderParentId = this.editingFolder.parentId || '';
      } else {
        this.folderName = '';
        this.folderDesc = '';
        this.folderParentId = this.defaultFolderParentId || '';
      }
    }

    if (changes['showCommitModal'] && this.showCommitModal) {
      this.commitHash = '';
      this.commitMsg = '';
    }

    if (changes['showNoteModal'] && this.showNoteModal) {
      if (this.editingNote) {
        this.noteTitle = this.editingNote.title || '';
        this.noteContent = this.editingNote.content || '';
        this.noteColor = this.editingNote.color || 'amber';
        this.notePinned = !!this.editingNote.pinned;
      } else {
        this.noteTitle = '';
        this.noteContent = '';
        this.noteColor = 'amber';
        this.notePinned = false;
      }
    }

    if (changes['showFilenameModal'] && this.showFilenameModal) {
      this.inputFilename = '';
    }

    if (changes['showNewDocModal'] && this.showNewDocModal) {
      this.newDocName = '';
      this.newDocType = 'blank';
      this.newDocLinkedProjectId = '';
      this.newDocRepoPath = '';
      this.newDocAutoScan = true;
    }

    this.lucide.refresh();
  }

  getFolderPathLabel(folder: RepoFolder): string {
    const parts: string[] = [folder.name];
    let currentParentId = folder.parentId;
    const visited = new Set<string>([folder.id]);

    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      const parent = this.folders.find(f => f.id === currentParentId);
      if (parent) {
        parts.unshift(parent.name);
        currentParentId = parent.parentId;
      } else {
        break;
      }
    }
    return parts.join(' / ');
  }

  private isDescendantFolder(candidateId: string, targetFolderId: string): boolean {
    let currId: string | null = candidateId;
    const visited = new Set<string>();
    while (currId && !visited.has(currId)) {
      if (currId === targetFolderId) return true;
      visited.add(currId);
      const folder = this.folders.find(f => f.id === currId);
      currId = folder ? folder.parentId : null;
    }
    return false;
  }

  get availableParentFolders(): RepoFolder[] {
    if (!this.editingFolder) return this.folders;
    return this.folders.filter(f => !this.isDescendantFolder(f.id, this.editingFolder!.id));
  }

  get availableParentBranches(): RepoBranch[] {
    if (!this.editingBranch) return this.branches;
    return this.branches.filter(b => b.id !== this.editingBranch!.id);
  }

  onSubmitBranch(event: Event): void {
    event.preventDefault();
    if (!this.branchName.trim()) return;
    this.saveBranch.emit({
      id: this.editingBranch?.id,
      name: this.branchName.trim(),
      desc: this.branchDesc,
      folderId: this.branchFolderId || null,
      parentId: this.branchParentId || null,
      isMain: this.branchIsMain,
      tags: [...this.branchTags]
    });
  }

  onSubmitFolder(event: Event): void {
    event.preventDefault();
    if (!this.folderName.trim()) return;
    this.saveFolder.emit({
      id: this.editingFolder?.id,
      name: this.folderName.trim(),
      desc: this.folderDesc.trim(),
      parentId: this.folderParentId || null
    });
  }

  onSubmitCommit(event: Event): void {
    event.preventDefault();
    if (!this.commitMsg.trim()) return;
    this.saveCommit.emit({
      hash: this.commitHash.trim(),
      message: this.commitMsg
    });
  }

  onSubmitNote(event: Event): void {
    event.preventDefault();
    if (!this.noteTitle.trim() && !this.noteContent.trim()) return;
    this.saveNote.emit({
      id: this.editingNote?.id,
      title: this.noteTitle.trim() || 'Nota sin título',
      content: this.noteContent.trim(),
      color: this.noteColor,
      pinned: this.notePinned
    });
  }

  onConfirmFilename(): void {
    this.confirmFilename.emit(this.inputFilename);
  }

  onSelectNewDocProject(projectId: string): void {
    this.newDocLinkedProjectId = projectId;
    const found = this.cmdProjects.find(p => p.id === projectId);
    if (found) {
      this.newDocRepoPath = found.path;
      if (!this.newDocName.trim()) {
        this.newDocName = found.name;
      }
    }
  }

  onSubmitNewDoc(event?: Event): void {
    if (event) event.preventDefault();
    const trimmedName = this.newDocName.trim();
    if (!trimmedName) return;

    this.createNewDoc.emit({
      name: trimmedName,
      repoPath: this.newDocType === 'git' ? this.newDocRepoPath.trim() : '',
      linkedProjectId: this.newDocType === 'git' && this.newDocLinkedProjectId ? this.newDocLinkedProjectId : null,
      autoScanGit: this.newDocType === 'git' && this.newDocAutoScan
    });
  }
}


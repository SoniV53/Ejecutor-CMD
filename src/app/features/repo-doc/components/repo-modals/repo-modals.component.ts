import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RepoFolder, RepoBranch, RepoNote, RepoNoteColor } from '../../models/repo-doc.models';
import { DocExplorerItem } from '../../../../core/services/doc-api.service';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

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

  @Input() showFilenameModal = false;
  @Input() filenameModalTitle = 'Nombre del Proyecto';
  @Input() filenamePlaceholder = 'ej. modulo_login';

  @Input() showOpenModal = false;
  @Input() jsonFiles: DocExplorerItem[] = [];
  @Input() activeFileName = '';

  @Input() folders: RepoFolder[] = [];
  @Input() branches: RepoBranch[] = [];

  @Output() closeBranchModal = new EventEmitter<void>();
  @Output() saveBranch = new EventEmitter<{
    id?: string;
    name: string;
    desc: string;
    folderId: string | null;
    parentId: string | null;
    isMain: boolean;
  }>();

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

  @Output() closeFilenameModal = new EventEmitter<void>();
  @Output() confirmFilename = new EventEmitter<string>();

  @Output() closeOpenModal = new EventEmitter<void>();
  @Output() selectFileToOpen = new EventEmitter<string>();

  // Branch form
  branchName = '';
  branchDesc = '';
  branchFolderId = '';
  branchParentId = '';
  branchIsMain = false;

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
      } else {
        this.branchName = '';
        this.branchDesc = '';
        this.branchFolderId = this.defaultBranchFolderId || '';
        this.branchParentId = this.defaultBranchParentId || '';
        this.branchIsMain = this.defaultBranchIsMain;
      }
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
      isMain: this.branchIsMain
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
}


import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RepoFolder, RepoBranch } from '../../models/repo-doc.models';
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

  @Input() showFolderModal = false;
  @Input() editingFolder: RepoFolder | null = null;

  @Input() showCommitModal = false;

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
  }>();

  @Output() closeFolderModal = new EventEmitter<void>();
  @Output() saveFolder = new EventEmitter<{
    id?: string;
    name: string;
    parentId: string | null;
  }>();

  @Output() closeCommitModal = new EventEmitter<void>();
  @Output() saveCommit = new EventEmitter<{ hash: string; message: string }>();

  @Output() closeFilenameModal = new EventEmitter<void>();
  @Output() confirmFilename = new EventEmitter<string>();

  @Output() closeOpenModal = new EventEmitter<void>();
  @Output() selectFileToOpen = new EventEmitter<string>();

  // Branch form
  branchName = '';
  branchDesc = '';
  branchFolderId = '';
  branchParentId = '';

  // Folder form
  folderName = '';
  folderParentId = '';

  // Commit form
  commitHash = '';
  commitMsg = '';

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
      } else {
        this.branchName = '';
        this.branchDesc = '';
        this.branchFolderId = '';
        this.branchParentId = '';
      }
    }

    if (changes['showFolderModal'] && this.showFolderModal) {
      if (this.editingFolder) {
        this.folderName = this.editingFolder.name;
        this.folderParentId = this.editingFolder.parentId || '';
      } else {
        this.folderName = '';
        this.folderParentId = '';
      }
    }

    if (changes['showCommitModal'] && this.showCommitModal) {
      this.commitHash = '';
      this.commitMsg = '';
    }

    if (changes['showFilenameModal'] && this.showFilenameModal) {
      this.inputFilename = '';
    }

    this.lucide.refresh();
  }

  get availableParentFolders(): RepoFolder[] {
    if (!this.editingFolder) return this.folders;
    return this.folders.filter(f => f.id !== this.editingFolder!.id);
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
      parentId: this.branchParentId || null
    });
  }

  onSubmitFolder(event: Event): void {
    event.preventDefault();
    if (!this.folderName.trim()) return;
    this.saveFolder.emit({
      id: this.editingFolder?.id,
      name: this.folderName.trim(),
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

  onConfirmFilename(): void {
    this.confirmFilename.emit(this.inputFilename);
  }
}

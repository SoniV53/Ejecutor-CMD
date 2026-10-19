import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RepoFolder, RepoBranch, RepoDocState } from '../../models/repo-doc.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-repo-sidebar-tree',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './repo-sidebar-tree.component.html',
  styleUrls: ['./repo-sidebar-tree.component.css']
})
export class RepoSidebarTreeComponent implements OnChanges, AfterViewInit {
  @Input() state: RepoDocState = { folders: [], branches: [], commits: [] };
  @Input() currentBranchId: string | null = null;
  @Input() currentFolderId: string | null = null;
  @Input() expandedFolders: Set<string> = new Set();
  @Input() fileStatusText = 'Cargando...';
  @Input() fileSynced = false;

  @Output() openNewFolderModal = new EventEmitter<void>();
  @Output() openNewBranchModal = new EventEmitter<void>();
  @Output() toggleFolder = new EventEmitter<{ folderId: string; event: Event }>();
  @Output() selectFolder = new EventEmitter<string>();
  @Output() selectBranch = new EventEmitter<string>();

  @Output() createNewFile = new EventEmitter<void>();
  @Output() openFileModal = new EventEmitter<void>();
  @Output() saveFileForced = new EventEmitter<void>();
  @Output() saveFileAs = new EventEmitter<void>();

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.lucide.refresh();
  }

  get rootFolders(): RepoFolder[] {
    return (this.state.folders || []).filter(f => !f.parentId);
  }

  get rootBranches(): RepoBranch[] {
    return (this.state.branches || []).filter(b => !b.folderId && !b.parentId);
  }

  getSubFolders(parentId: string): RepoFolder[] {
    return (this.state.folders || []).filter(f => f.parentId === parentId);
  }

  getFolderBranches(folderId: string): RepoBranch[] {
    return (this.state.branches || []).filter(b => b.folderId === folderId && !b.parentId);
  }

  getChildBranches(parentId: string): RepoBranch[] {
    return (this.state.branches || []).filter(b => b.parentId === parentId);
  }

  isExpanded(folderId: string): boolean {
    return this.expandedFolders.has(folderId);
  }

  onToggleFolder(folderId: string, event: Event): void {
    event.stopPropagation();
    this.toggleFolder.emit({ folderId, event });
  }
}

import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  RepoFolder,
  RepoBranch,
  RepoDocState,
  RepoTag,
  getTagColorClasses
} from '../../models/repo-doc.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-repo-sidebar-tree',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './repo-sidebar-tree.component.html',
  styleUrls: ['./repo-sidebar-tree.component.css']
})
export class RepoSidebarTreeComponent implements OnChanges, AfterViewInit {
  @Input() state: RepoDocState = { folders: [], branches: [], commits: [], notes: [] };
  @Input() currentBranchId: string | null = null;
  @Input() currentFolderId: string | null = null;
  @Input() showAnalysisView = false;
  @Input() expandedFolders: Set<string> = new Set();
  @Input() fileStatusText = 'Cargando...';
  @Input() fileSynced = false;
  @Input() sidebarOpenMobile = false;

  @Output() openAnalysisView = new EventEmitter<void>();
  @Output() closeSidebarMobile = new EventEmitter<void>();
  @Output() openNewFolderModal = new EventEmitter<string | null>();
  @Output() openNewBranchModal = new EventEmitter<{
    folderId?: string | null;
    parentId?: string | null;
    isMain?: boolean;
  }>();
  @Output() toggleFolder = new EventEmitter<{ folderId: string; event: Event }>();
  @Output() selectFolder = new EventEmitter<string>();
  @Output() selectBranch = new EventEmitter<string>();
  @Output() moveBranchToFolder = new EventEmitter<{ branchId: string; folderId: string | null }>();

  @Output() createNewFile = new EventEmitter<void>();
  @Output() openFileModal = new EventEmitter<void>();
  @Output() saveFileForced = new EventEmitter<void>();
  @Output() saveFileAs = new EventEmitter<void>();

  searchQuery = '';
  searchFilterTab: 'all' | 'folders' | 'branches' = 'all';
  draggingBranchId: string | null = null;
  dragOverFolderId: string | 'ROOT' | null = null;
  copiedBranchId: string | null = null;
  private copiedTimer: any;

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.lucide.refresh();
  }

  get mainBranchesCount(): number {
    return (this.state.branches || []).filter(b => b.isMain).length;
  }

  get filteredFolders(): RepoFolder[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return [];
    return (this.state.folders || []).filter(
      f => f.name.toLowerCase().includes(q) || (f.desc || '').toLowerCase().includes(q)
    );
  }

  get filteredBranches(): RepoBranch[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return [];
    return (this.state.branches || []).filter(b => {
      const nameMatch = b.name.toLowerCase().includes(q) || (b.desc || '').toLowerCase().includes(q);
      const folderName = this.getBranchFolderName(b)?.toLowerCase() || '';
      const folderMatch = folderName.includes(q);
      const tagMatch = (b.tags || []).some(t => t.toLowerCase().includes(q));
      return nameMatch || folderMatch || tagMatch;
    });
  }

  getBranchTags(branch: RepoBranch): RepoTag[] {
    if (!branch.tags || branch.tags.length === 0) return [];
    const available = this.state.availableTags || [];
    return branch.tags.map(tagNameOrId => {
      const found = available.find(
        t => t.id === tagNameOrId || t.name.toLowerCase() === tagNameOrId.toLowerCase()
      );
      return found || { id: tagNameOrId, name: tagNameOrId, color: 'indigo' };
    });
  }

  getTagBadgeClasses(color: string): string {
    return getTagColorClasses(color).badge;
  }

  getFolderBranchCount(folderId: string): number {
    return (this.state.branches || []).filter(b => b.folderId === folderId).length;
  }

  getBranchFolderName(branch: RepoBranch): string | null {
    if (!branch.folderId) return null;
    const f = (this.state.folders || []).find(folder => folder.id === branch.folderId);
    return f ? f.name : null;
  }

  onOpenAnalysis(): void {
    this.openAnalysisView.emit();
    if (window.innerWidth < 768) {
      this.closeSidebarMobile.emit();
    }
  }

  onSelectFolderItem(folderId: string): void {
    this.selectFolder.emit(folderId);
    if (window.innerWidth < 768) {
      this.closeSidebarMobile.emit();
    }
  }

  onSelectBranchItem(branchId: string): void {
    this.selectBranch.emit(branchId);
    if (window.innerWidth < 768) {
      this.closeSidebarMobile.emit();
    }
  }

  onSelectFoundFolder(folderId: string): void {
    this.expandedFolders.add(folderId);
    this.selectFolder.emit(folderId);
    if (window.innerWidth < 768) {
      this.closeSidebarMobile.emit();
    }
    this.lucide.refresh();
  }

  onSelectFoundBranch(branchId: string): void {
    const branch = (this.state.branches || []).find(b => b.id === branchId);
    if (branch && branch.folderId) {
      this.expandedFolders.add(branch.folderId);
    }
    this.selectBranch.emit(branchId);
    if (window.innerWidth < 768) {
      this.closeSidebarMobile.emit();
    }
    this.lucide.refresh();
  }

  get rootFolders(): RepoFolder[] {
    const roots = (this.state.folders || []).filter(f => !f.parentId);
    // Mostrar primero la carpeta por defecto si existe
    return [...roots].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });
  }

  private getParentBranch(branch: RepoBranch): RepoBranch | undefined {
    if (!branch.parentId) return undefined;
    return (this.state.branches || []).find(b => b.id === branch.parentId);
  }

  isNestedUnderParentInSameLocation(branch: RepoBranch): boolean {
    const parent = this.getParentBranch(branch);
    if (!parent || parent.id === branch.id) return false;
    return (branch.folderId || null) === (parent.folderId || null);
  }

  get rootBranches(): RepoBranch[] {
    const list = (this.state.branches || []).filter(
      b => !b.folderId && !this.isNestedUnderParentInSameLocation(b)
    );
    return this.sortBranchesMainFirst(list);
  }

  getSubFolders(parentId: string): RepoFolder[] {
    return (this.state.folders || []).filter(f => f.parentId === parentId);
  }

  getFolderBranches(folderId: string): RepoBranch[] {
    const list = (this.state.branches || []).filter(
      b => b.folderId === folderId && !this.isNestedUnderParentInSameLocation(b)
    );
    return this.sortBranchesMainFirst(list);
  }

  getChildBranches(parentId: string): RepoBranch[] {
    const parent = (this.state.branches || []).find(b => b.id === parentId);
    if (!parent) return [];
    return (this.state.branches || []).filter(
      b => b.parentId === parentId && (b.folderId || null) === (parent.folderId || null)
    );
  }

  getTotalChildBranchesCount(parentId: string): number {
    return (this.state.branches || []).filter(b => b.parentId === parentId).length;
  }

  getParentBranchName(branch: RepoBranch): string | null {
    const parent = this.getParentBranch(branch);
    return parent ? parent.name : null;
  }

  getFolderNotesCount(folderId: string): number {
    return (this.state.notes || []).filter(n => n.targetType === 'folder' && n.targetId === folderId).length;
  }

  getBranchNotesCount(branchId: string): number {
    return (this.state.notes || []).filter(n => n.targetType === 'branch' && n.targetId === branchId).length;
  }

  getFolderDirectItemsCount(folderId: string): number {
    const subCount = this.getSubFolders(folderId).length;
    const branchCount = (this.state.branches || []).filter(b => b.folderId === folderId).length;
    return subCount + branchCount;
  }

  private sortBranchesMainFirst(branches: RepoBranch[]): RepoBranch[] {
    return [...branches].sort((a, b) => {
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return 0;
    });
  }

  isExpanded(folderId: string): boolean {
    return this.expandedFolders.has(folderId);
  }

  onToggleFolder(folderId: string, event: Event): void {
    event.stopPropagation();
    this.toggleFolder.emit({ folderId, event });
  }

  onAddSubfolder(parentId: string, event: Event): void {
    event.stopPropagation();
    this.openNewFolderModal.emit(parentId);
  }

  onAddBranchInFolder(folderId: string, event: Event): void {
    event.stopPropagation();
    this.openNewBranchModal.emit({ folderId, parentId: null, isMain: false });
  }

  onAddChildBranch(parentBranch: RepoBranch, event: Event): void {
    event.stopPropagation();
    this.openNewBranchModal.emit({
      folderId: parentBranch.folderId,
      parentId: parentBranch.id,
      isMain: false
    });
  }

  async onCopyBranchName(branch: RepoBranch, event: Event): Promise<void> {
    event.stopPropagation();
    const clean = (branch?.name || '').trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
      this.copiedBranchId = branch.id;
      this.lucide.refresh();
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => {
        this.copiedBranchId = null;
        this.lucide.refresh();
      }, 1500);
    } catch {}
  }

  // Drag & Drop para mover ramas entre carpetas y subcarpetas
  onBranchDragStart(branchId: string, event: DragEvent): void {
    event.stopPropagation();
    this.draggingBranchId = branchId;
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', branchId);
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onBranchDragEnd(): void {
    this.draggingBranchId = null;
    this.dragOverFolderId = null;
  }

  onFolderDragOver(folderId: string | 'ROOT', event: DragEvent): void {
    if (!this.draggingBranchId) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragOverFolderId = folderId;
  }

  onFolderDragLeave(folderId: string | 'ROOT', event: DragEvent): void {
    event.stopPropagation();
    if (this.dragOverFolderId === folderId) {
      this.dragOverFolderId = null;
    }
  }

  onFolderDrop(folderId: string | null, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const branchId = this.draggingBranchId || event.dataTransfer?.getData('text/plain');
    this.draggingBranchId = null;
    this.dragOverFolderId = null;
    if (branchId) {
      this.moveBranchToFolder.emit({ branchId, folderId });
    }
  }
}


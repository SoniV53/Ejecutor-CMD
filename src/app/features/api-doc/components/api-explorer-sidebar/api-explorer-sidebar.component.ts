import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocExplorerItem } from '../../../../core/services/doc-api.service';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-api-explorer-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-explorer-sidebar.component.html',
  styleUrls: ['./api-explorer-sidebar.component.css']
})
export class ApiExplorerSidebarComponent implements OnChanges, AfterViewInit, AfterViewChecked {
  @Input() isOpen = true;
  @Input() items: DocExplorerItem[] = [];
  @Input() currentFolder = '';
  @Input() currentRoot = '';
  @Input() defaultDocsDir = '';
  @Input() activeFile = '';

  @Output() closeSidebar = new EventEmitter<void>();
  @Output() createFolder = new EventEmitter<string>();
  @Output() createFile = new EventEmitter<string>();
  @Output() selectRootDirectory = new EventEmitter<void>();
  @Output() openInWindowsExplorer = new EventEmitter<void>();
  @Output() resetRootDirectory = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
  @Output() loadFile = new EventEmitter<string>();
  @Output() renameItem = new EventEmitter<DocExplorerItem>();
  @Output() deleteItem = new EventEmitter<string>();

  // Conjunto de rutas de carpetas expandidas en el árbol
  expandedFolders = new Set<string>();

  // Filtro de búsqueda rápida
  searchQuery = '';

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngAfterViewChecked(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeFile'] && this.activeFile) {
      this.autoExpandParents(this.activeFile);
    }
    this.lucide.refresh();
  }

  get displayRootPath(): string {
    if (this.currentRoot) return this.currentRoot;
    return this.defaultDocsDir || 'api_docs (app)';
  }

  get isCustomRoot(): boolean {
    return !!this.currentRoot && this.currentRoot !== this.defaultDocsDir;
  }

  // Filtrado recursivo según búsqueda o listado completo
  get filteredItems(): DocExplorerItem[] {
    const filterRec = (list: DocExplorerItem[]): DocExplorerItem[] => {
      const q = this.searchQuery.trim().toLowerCase();
      if (!q) {
        return (list || []).filter(
          item => item.name !== '.keep.txt' && item.name !== '.keep' && item.name !== '_init.txt'
        );
      }
      const result: DocExplorerItem[] = [];
      for (const item of list || []) {
        if (item.name === '.keep.txt' || item.name === '.keep' || item.name === '_init.txt') continue;
        const matchesSelf = item.name.toLowerCase().includes(q);
        const filteredChildren = item.isFolder && item.children ? filterRec(item.children) : [];
        if (matchesSelf || filteredChildren.length > 0) {
          if (item.isFolder) {
            this.expandedFolders.add(item.path);
          }
          result.push({
            ...item,
            children: filteredChildren
          });
        }
      }
      return result;
    };

    return filterRec(this.items || []);
  }

  trackByPath(_index: number, item: DocExplorerItem): string {
    return item.path;
  }

  isExpanded(folderPath: string): boolean {
    return this.expandedFolders.has(folderPath);
  }

  toggleFolder(folderPath: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.expandedFolders.has(folderPath)) {
      this.expandedFolders.delete(folderPath);
    } else {
      this.expandedFolders.add(folderPath);
    }
    setTimeout(() => this.lucide.refresh(), 10);
  }

  expandAll(): void {
    const walk = (list: DocExplorerItem[]) => {
      for (const item of list) {
        if (item.isFolder) {
          this.expandedFolders.add(item.path);
          if (item.children) walk(item.children);
        }
      }
    };
    walk(this.items || []);
    setTimeout(() => this.lucide.refresh(), 10);
  }

  collapseAll(): void {
    this.expandedFolders.clear();
    setTimeout(() => this.lucide.refresh(), 10);
  }

  autoExpandParents(filePath: string): void {
    if (!filePath) return;
    const parts = filePath.replace(/\\/g, '/').split('/');
    parts.pop(); // quitar nombre de archivo
    let current = '';
    for (const p of parts) {
      current = current ? `${current}/${p}` : p;
      this.expandedFolders.add(current);
    }
  }

  getFileIcon(item: DocExplorerItem): string {
    if (item.isFolder) return this.isExpanded(item.path) ? 'folder-open' : 'folder';
    const ext = (item.extension || '').toLowerCase();
    if (ext === '.json') return 'file-json';
    if (ext === '.md') return 'file-code';
    if (ext === '.sql') return 'database';
    return 'file-text';
  }

  getFileIconColor(item: DocExplorerItem): string {
    if (item.isFolder) return 'text-amber-400';
    const ext = (item.extension || '').toLowerCase();
    if (ext === '.json') return 'text-amber-400';
    if (ext === '.md') return 'text-emerald-400';
    if (ext === '.sql') return 'text-purple-400';
    return 'text-sky-400';
  }

  onCreateFileIn(event: Event, folderPath: string): void {
    event.stopPropagation();
    this.expandedFolders.add(folderPath);
    this.createFile.emit(folderPath);
  }

  onCreateFolderIn(event: Event, folderPath: string): void {
    event.stopPropagation();
    this.expandedFolders.add(folderPath);
    this.createFolder.emit(folderPath);
  }

  onRename(event: Event, item: DocExplorerItem): void {
    event.stopPropagation();
    this.renameItem.emit(item);
  }

  onDeleteItem(event: Event, path: string): void {
    event.stopPropagation();
    this.deleteItem.emit(path);
  }
}

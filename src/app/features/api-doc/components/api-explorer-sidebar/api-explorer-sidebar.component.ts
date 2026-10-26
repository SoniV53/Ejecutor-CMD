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
  filteredItems: DocExplorerItem[] = [];

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngAfterViewChecked(): void {
    // Evitar refrescar en cada ciclo de detección para no recrear SVGs durante clics
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items']) {
      this.updateFilteredItems();
    }
    if (changes['activeFile'] && this.activeFile) {
      this.autoExpandParents(this.activeFile);
    }
    this.lucide.refresh();
  }

  onSearchChange(): void {
    this.updateFilteredItems();
    this.lucide.refresh();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.updateFilteredItems();
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
  updateFilteredItems(): void {
    const q = this.searchQuery.trim().toLowerCase();
    const filterRec = (list: DocExplorerItem[]): DocExplorerItem[] => {
      const result: DocExplorerItem[] = [];
      for (const item of list || []) {
        if (item.name === '.keep.txt' || item.name === '.keep' || item.name === '_init.txt') continue;
        const filteredChildren = item.isFolder && item.children ? filterRec(item.children) : [];
        if (!q) {
          result.push({
            ...item,
            children: filteredChildren
          });
          continue;
        }
        const matchesSelf = item.name.toLowerCase().includes(q);
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

    this.filteredItems = filterRec(this.items || []);
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
    this.lucide.refresh();
  }

  expandAll(): void {
    const collectAll = (nodes: DocExplorerItem[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          this.expandedFolders.add(node.path);
          if (node.children) collectAll(node.children);
        }
      }
    };
    collectAll(this.items || []);
    this.lucide.refresh();
  }

  collapseAll(): void {
    this.expandedFolders.clear();
    this.lucide.refresh();
  }

  // Auto expandir las carpetas padre del archivo activo
  private autoExpandParents(filePath: string): void {
    const parts = filePath.replace(/\\/g, '/').split('/');
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      this.expandedFolders.add(current);
    }
  }

  isActiveFile(itemPath: string): boolean {
    const norm = (p: string) => (p || '').replace(/\\/g, '/').trim();
    return norm(this.activeFile) === norm(itemPath);
  }

  // Acciones en carpetas
  onCreateFileIn(folderPath: string, event: Event): void {
    event.stopPropagation();
    this.expandedFolders.add(folderPath);
    this.createFile.emit(folderPath);
  }

  onCreateFolderIn(folderPath: string, event: Event): void {
    event.stopPropagation();
    this.expandedFolders.add(folderPath);
    this.createFolder.emit(folderPath);
  }

  onRename(item: DocExplorerItem, event: Event): void {
    event.stopPropagation();
    this.renameItem.emit(item);
  }

  onDelete(itemPath: string, event: Event): void {
    event.stopPropagation();
    this.deleteItem.emit(itemPath);
  }
}

import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocExplorerItem } from '../../../../core/services/doc-api.service';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-api-explorer-sidebar',
  standalone: true,
  imports: [CommonModule],
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
  @Output() createFolder = new EventEmitter<void>();
  @Output() createFile = new EventEmitter<void>();
  @Output() selectRootDirectory = new EventEmitter<void>();
  @Output() openInWindowsExplorer = new EventEmitter<void>();
  @Output() resetRootDirectory = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<string>();
  @Output() goBack = new EventEmitter<void>();
  @Output() openFolder = new EventEmitter<string>();
  @Output() loadFile = new EventEmitter<string>();
  @Output() renameItem = new EventEmitter<DocExplorerItem>();
  @Output() deleteItem = new EventEmitter<string>();

  filteredItems: DocExplorerItem[] = [];

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngAfterViewChecked(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.filteredItems = (this.items || []).filter(
      item => item.name !== '.keep.txt' && item.name !== '.keep' && item.name !== '_init.txt'
    );
    this.lucide.refresh();
  }

  get displayRootPath(): string {
    if (this.currentRoot) return this.currentRoot;
    return this.defaultDocsDir || 'api_docs (app)';
  }

  get isCustomRoot(): boolean {
    return !!this.currentRoot && this.currentRoot !== this.defaultDocsDir;
  }

  trackByPath(_index: number, item: DocExplorerItem): string {
    return item.path;
  }

  getFileIcon(item: DocExplorerItem): string {
    if (item.isFolder) return 'folder';
    const ext = (item.extension || '').toLowerCase();
    if (ext === '.json') return 'file-json';
    if (ext === '.md') return 'file-code';
    return 'file-text';
  }

  getFileIconColor(item: DocExplorerItem): string {
    if (item.isFolder) return 'text-amber-500';
    const ext = (item.extension || '').toLowerCase();
    if (ext === '.json') return 'text-amber-400';
    if (ext === '.md') return 'text-emerald-400';
    return 'text-indigo-400';
  }

  onItemClick(item: DocExplorerItem): void {
    if (item.isFolder) {
      this.openFolder.emit(item.path);
    } else {
      this.loadFile.emit(item.path);
    }
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

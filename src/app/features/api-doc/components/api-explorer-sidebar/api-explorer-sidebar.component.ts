import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
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
export class ApiExplorerSidebarComponent implements OnChanges, AfterViewInit {
  @Input() items: DocExplorerItem[] = [];
  @Input() currentFolder = '';
  @Input() activeFile = '';

  @Output() createFolder = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<string>();
  @Output() goBack = new EventEmitter<void>();
  @Output() openFolder = new EventEmitter<string>();
  @Output() loadFile = new EventEmitter<string>();
  @Output() deleteItem = new EventEmitter<string>();

  filteredItems: DocExplorerItem[] = [];

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.filteredItems = (this.items || []).filter(
      item => item.name !== '.keep.txt' && item.name !== '.keep' && item.name !== '_init.txt'
    );
    this.lucide.refresh();
  }

  trackByPath(_index: number, item: DocExplorerItem): string {
    return item.path;
  }

  onItemClick(item: DocExplorerItem): void {
    if (item.isFolder) {
      this.openFolder.emit(item.path);
    } else {
      this.loadFile.emit(item.path);
    }
  }

  onDeleteItem(event: Event, path: string): void {
    event.stopPropagation();
    this.deleteItem.emit(path);
  }
}

import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmdProject } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-cmd-header',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cmd-header.component.html',
  styleUrls: ['./cmd-header.component.css']
})
export class CmdHeaderComponent implements OnChanges, AfterViewInit {
  @Input() searchTerm = '';
  @Input() viewMode: 'list' | 'card' = 'card';
  @Input() activeProject: CmdProject | null = null;

  @Output() searchTermChange = new EventEmitter<string>();
  @Output() viewModeChange = new EventEmitter<'list' | 'card'>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() openNewCategory = new EventEmitter<void>();
  @Output() openNewCommand = new EventEmitter<void>();
  @Output() openNewBat = new EventEmitter<void>();
  @Output() importBatFiles = new EventEmitter<FileList>();
  @Output() exportAllBats = new EventEmitter<void>();
  @Output() deselectProject = new EventEmitter<void>();

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.lucide.refresh();
  }

  onSearchInput(value: string): void {
    this.searchTermChange.emit(value);
  }

  onImportChange(event: any): void {
    if (event.target.files && event.target.files.length > 0) {
      this.importBatFiles.emit(event.target.files);
      event.target.value = '';
    }
  }
}

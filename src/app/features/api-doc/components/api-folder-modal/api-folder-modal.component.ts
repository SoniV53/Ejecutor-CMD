import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-api-folder-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-folder-modal.component.html',
  styleUrls: ['./api-folder-modal.component.css']
})
export class ApiFolderModalComponent implements OnChanges, AfterViewInit, AfterViewChecked {
  @Input() showFolderModal = false;
  @Input() showFileModal = false;
  @Input() showRenameModal = false;
  @Input() renameOldName = '';
  @Input() showConfirmModal = false;
  @Input() confirmTitle = '¿Estás seguro?';
  @Input() confirmText = 'Esta acción no se puede deshacer.';

  @Input() toastVisible = false;
  @Input() toastMsg = 'Acción completada';
  @Input() toastIcon = 'check-circle';
  @Input() toastColor = 'text-indigo-400';

  @Output() closeFolderModal = new EventEmitter<void>();
  @Output() confirmCreateFolder = new EventEmitter<string>();

  @Output() closeFileModal = new EventEmitter<void>();
  @Output() confirmCreateFile = new EventEmitter<{ name: string; type: string }>();

  @Output() closeRenameModal = new EventEmitter<void>();
  @Output() confirmRename = new EventEmitter<string>();

  @Output() closeConfirmModal = new EventEmitter<void>();
  @Output() confirmAction = new EventEmitter<void>();

  inFolderName = '';
  inFileName = '';
  inFileType = 'txt';
  inRenameName = '';

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngAfterViewChecked(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showFolderModal'] && this.showFolderModal) {
      this.inFolderName = '';
    }
    if (changes['showFileModal'] && this.showFileModal) {
      this.inFileName = '';
      this.inFileType = 'txt';
    }
    if (changes['showRenameModal'] && this.showRenameModal) {
      this.inRenameName = this.renameOldName || '';
    }
    this.lucide.refresh();
  }

  onConfirmFolder(): void {
    this.confirmCreateFolder.emit(this.inFolderName);
  }

  onConfirmFile(): void {
    let name = this.inFileName.trim();
    if (!name) name = 'nota';
    if (!name.includes('.')) {
      name = `${name}.${this.inFileType}`;
    }
    this.confirmCreateFile.emit({ name, type: this.inFileType });
  }

  onConfirmRename(): void {
    this.confirmRename.emit(this.inRenameName);
  }
}

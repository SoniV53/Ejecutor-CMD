import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
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
export class ApiFolderModalComponent implements OnChanges, AfterViewInit {
  @Input() showFolderModal = false;
  @Input() showConfirmModal = false;
  @Input() confirmTitle = '¿Estás seguro?';
  @Input() confirmText = 'Esta acción no se puede deshacer.';

  @Input() toastVisible = false;
  @Input() toastMsg = 'Acción completada';
  @Input() toastIcon = 'check-circle';
  @Input() toastColor = 'text-indigo-400';

  @Output() closeFolderModal = new EventEmitter<void>();
  @Output() confirmCreateFolder = new EventEmitter<string>();

  @Output() closeConfirmModal = new EventEmitter<void>();
  @Output() confirmAction = new EventEmitter<void>();

  inFolderName = '';

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showFolderModal'] && this.showFolderModal) {
      this.inFolderName = '';
    }
    this.lucide.refresh();
  }

  onConfirmFolder(): void {
    this.confirmCreateFolder.emit(this.inFolderName);
  }
}

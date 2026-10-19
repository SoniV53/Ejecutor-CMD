import { Component, EventEmitter, Output, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocParameter } from '../../models/doc-generator.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-doc-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './doc-import-modal.component.html',
  styleUrls: ['./doc-import-modal.component.css']
})
export class DocImportModalComponent implements AfterViewInit {
  @Output() closeModal = new EventEmitter<void>();
  @Output() importParameters = new EventEmitter<DocParameter[]>();

  importText = '';

  constructor(private lucideService: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucideService.refresh();
  }

  processImport(): void {
    const lines = this.importText.split('\n');
    const newParams: DocParameter[] = [];
    const regex = /@(Input|Output)\(\)\s+(\w+)\s*:\s*([^=;]+)/;

    lines.forEach((line) => {
      const match = line.match(regex);
      if (match) {
        const [, decorator, name, type] = match;
        newParams.push({
          id: (Date.now() + Math.random()).toString(),
          name: name.trim(),
          type: type.trim(),
          description: `[${decorator}] Detectado automáticamente`
        });
      }
    });

    if (newParams.length > 0) {
      this.importParameters.emit(newParams);
      this.importText = '';
      this.closeModal.emit();
    }
  }
}

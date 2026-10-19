import { Component, EventEmitter, Input, Output, AfterViewInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DocFormData, DocVariant } from '../../models/doc-generator.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-doc-editor-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './doc-editor-panel.component.html',
  styleUrls: ['./doc-editor-panel.component.css']
})
export class DocEditorPanelComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) formData!: DocFormData;
  @Input() isGenerating = false;
  @Input() hoveredVariantId: number | null = null;

  @Output() openImportModal = new EventEmitter<void>();
  @Output() openJson = new EventEmitter<void>();
  @Output() saveJson = new EventEmitter<void>();
  @Output() exportPdf = new EventEmitter<void>();
  @Output() hoveredVariantChange = new EventEmitter<number | null>();
  @Output() imageSelected = new EventEmitter<{ variantId: number; file: File }>();

  activeDragId: number | null = null;

  constructor(private lucideService: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucideService.refresh();
  }

  ngOnChanges(): void {
    this.lucideService.refresh();
  }

  addParameter(): void {
    this.formData.globalParameters.push({
      id: Date.now().toString(),
      name: '',
      type: '',
      description: ''
    });
    this.lucideService.refresh();
  }

  removeParameter(id: string): void {
    this.formData.globalParameters = this.formData.globalParameters.filter((p) => p.id !== id);
    this.lucideService.refresh();
  }

  addMethod(): void {
    this.formData.methods.push({
      id: Date.now().toString(),
      name: '',
      details: '',
      description: ''
    });
    this.lucideService.refresh();
  }

  removeMethod(id: string): void {
    this.formData.methods = this.formData.methods.filter((m) => m.id !== id);
    this.lucideService.refresh();
  }

  addVariant(): void {
    this.formData.variants.push({
      id: Date.now(),
      name: '',
      description: '',
      image: null,
      selectedProperties: []
    });
    this.lucideService.refresh();
  }

  removeVariant(id: number): void {
    this.formData.variants = this.formData.variants.filter((v) => v.id !== id);
    if (this.hoveredVariantId === id) {
      this.hoveredVariantChange.emit(null);
    }
    this.lucideService.refresh();
  }

  addVariantProperty(variant: DocVariant): void {
    variant.selectedProperties.push({
      parameterId: '',
      value: ''
    });
    this.lucideService.refresh();
  }

  removeVariantProperty(variant: DocVariant, index: number): void {
    variant.selectedProperties.splice(index, 1);
    this.lucideService.refresh();
  }

  addCommit(): void {
    this.formData.historyCommits.push({
      id: Date.now().toString(),
      title: '',
      hash: ''
    });
    this.lucideService.refresh();
  }

  removeCommit(id: string): void {
    this.formData.historyCommits = this.formData.historyCommits.filter((c) => c.id !== id);
    this.lucideService.refresh();
  }

  onDragOver(event: DragEvent, variantId: number): void {
    event.preventDefault();
    this.activeDragId = variantId;
  }

  onDragLeave(): void {
    this.activeDragId = null;
  }

  onDrop(event: DragEvent, variantId: number): void {
    event.preventDefault();
    this.activeDragId = null;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.imageSelected.emit({ variantId, file });
      this.lucideService.refresh();
    }
  }

  onFileInput(event: Event, variantId: number): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.imageSelected.emit({ variantId, file });
      input.value = '';
      this.lucideService.refresh();
    }
  }
}

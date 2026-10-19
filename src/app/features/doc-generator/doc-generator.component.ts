import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocFormData, DocParameter } from './models/doc-generator.models';
import { PdfExportService } from './services/pdf-export.service';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { DocEditorPanelComponent } from './components/doc-editor-panel/doc-editor-panel.component';
import { DocPreviewPaperComponent } from './components/doc-preview-paper/doc-preview-paper.component';
import { DocImportModalComponent } from './components/doc-import-modal/doc-import-modal.component';

@Component({
  selector: 'app-doc-generator',
  standalone: true,
  imports: [
    CommonModule,
    DocEditorPanelComponent,
    DocPreviewPaperComponent,
    DocImportModalComponent
  ],
  templateUrl: './doc-generator.component.html',
  styleUrls: ['./doc-generator.component.css']
})
export class DocGeneratorComponent implements AfterViewInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  hoveredVariantId: number | null = null;
  showImportModal = false;
  showEditor = true;
  isGenerating = false;

  formData: DocFormData = {
    name: '',
    subtitle: '',
    description: '',
    status: 'Estable',
    historyCommits: [],
    globalParameters: [
      { id: '1', name: 'color', type: 'string', description: '[Input] Color del tema' }
    ],
    methods: [],
    variants: [
      {
        id: Date.now(),
        name: 'Variante Principal',
        description: '',
        image: null,
        selectedProperties: [{ parameterId: '1', value: 'primary' }]
      }
    ]
  };

  constructor(
    private pdfExportService: PdfExportService,
    private lucideService: LucideIconService
  ) {}

  ngAfterViewInit(): void {
    this.lucideService.refresh();
  }

  @HostListener('window:paste', ['$event'])
  handleGlobalPaste(event: ClipboardEvent): void {
    if (this.hoveredVariantId !== null && event.clipboardData) {
      const items = event.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            this.processImage(this.hoveredVariantId, blob);
          }
        }
      }
    }
  }

  toggleEditor(): void {
    this.showEditor = !this.showEditor;
    this.lucideService.refresh();
  }

  processImage(id: number, file: File): void {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        this.formData = {
          ...this.formData,
          variants: this.formData.variants.map((v) =>
            v.id === id ? { ...v, image: reader.result as string } : v
          )
        };
        this.lucideService.refresh();
      };
      reader.readAsDataURL(file);
    }
  }

  onImageSelected(event: { variantId: number; file: File }): void {
    this.processImage(event.variantId, event.file);
  }

  triggerOpenJson(): void {
    this.fileInputRef?.nativeElement?.click();
  }

  saveProject(): void {
    const dataStr = JSON.stringify(this.formData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `${this.formData.name || 'proyecto'}-doc.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  loadProject(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const json = JSON.parse(result);
        this.formData = json;
        input.value = '';
        this.lucideService.refresh();
      } catch {
        alert('Error al cargar el archivo JSON.');
      }
    };
    reader.readAsText(file);
  }

  onImportParameters(newParams: DocParameter[]): void {
    this.formData = {
      ...this.formData,
      globalParameters: [...this.formData.globalParameters, ...newParams]
    };
    this.lucideService.refresh();
  }

  async generatePDF(): Promise<void> {
    this.isGenerating = true;
    this.lucideService.refresh();
    await this.pdfExportService.generatePDF(this.formData);
    this.isGenerating = false;
    this.lucideService.refresh();
  }
}

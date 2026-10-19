import { Component, Input, AfterViewInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocFormData } from '../../models/doc-generator.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-doc-preview-paper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './doc-preview-paper.component.html',
  styleUrls: ['./doc-preview-paper.component.css']
})
export class DocPreviewPaperComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) formData!: DocFormData;
  @Input() showEditor = true;

  constructor(private lucideService: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucideService.refresh();
  }

  ngOnChanges(): void {
    this.lucideService.refresh();
  }

  getParameterName(parameterId: string): string {
    const p = this.formData.globalParameters.find((gp) => gp.id === parameterId);
    return p && p.name ? p.name : '-';
  }
}

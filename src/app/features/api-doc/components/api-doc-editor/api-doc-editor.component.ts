import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-api-doc-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-doc-editor.component.html',
  styleUrls: ['./api-doc-editor.component.css']
})
export class ApiDocEditorComponent implements OnChanges, AfterViewInit {
  @Input() docName = '';
  @Input() docContent = '';
  @Input() currentDocType: 'req' | 'res' = 'req';

  @Output() docNameChange = new EventEmitter<string>();
  @Output() docContentChange = new EventEmitter<string>();
  @Output() docTypeChange = new EventEmitter<'req' | 'res'>();
  @Output() formatContent = new EventEmitter<'json' | 'txt'>();

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.lucide.refresh();
  }
}

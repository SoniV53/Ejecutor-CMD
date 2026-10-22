import {
  Component,
  Input,
  Output,
  EventEmitter,
  AfterViewInit,
  AfterViewChecked,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';
import { NoteTab } from '../../models/api-doc.models';

@Component({
  selector: 'app-api-doc-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-doc-editor.component.html',
  styleUrls: ['./api-doc-editor.component.css']
})
export class ApiDocEditorComponent implements OnChanges, AfterViewInit, AfterViewChecked {
  @Input() tabs: NoteTab[] = [];
  @Input() activeTabId: string = '';
  @Input() saving = false;
  @Input() currentFolder = '';

  @Output() selectTab = new EventEmitter<string>();
  @Output() newTab = new EventEmitter<void>();
  @Output() closeTab = new EventEmitter<string>();
  @Output() saveActive = new EventEmitter<void>();
  @Output() downloadActive = new EventEmitter<void>();
  @Output() formatContent = new EventEmitter<'json' | 'minify' | 'txt'>();
  @Output() copyContent = new EventEmitter<void>();
  @Output() clearContent = new EventEmitter<void>();

  // Referencias para editor estándar / TXT / fuente MD
  @ViewChild('editorTextarea') editorTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('editorGutter') editorGutter?: ElementRef<HTMLDivElement>;

  // Referencias para editor JSON unificado en vivo
  @ViewChild('jsonHighlightPre') jsonHighlightPre?: ElementRef<HTMLPreElement>;
  @ViewChild('jsonTextarea') jsonTextarea?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('jsonGutter') jsonGutter?: ElementRef<HTMLDivElement>;

  // Canvas visual unificado para Markdown (Notion/Word)
  @ViewChild('richCanvas') richCanvas?: ElementRef<HTMLDivElement>;

  // Modo Markdown: Hoja Visual (editable) vs Código Fuente (.md)
  mdViewMode: 'rich' | 'source' = 'rich';

  private lastActiveTabId = '';

  constructor(
    private lucide: LucideIconService,
    private sanitizer: DomSanitizer
  ) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
    setTimeout(() => this.syncRichEditorFromTab(), 10);
  }

  ngAfterViewChecked(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.lucide.refresh();
    if (changes['activeTabId'] || changes['tabs']) {
      if (this.activeTabId !== this.lastActiveTabId) {
        this.lastActiveTabId = this.activeTabId;
        setTimeout(() => this.syncRichEditorFromTab(), 10);
      }
    }
  }

  get activeTab(): NoteTab | null {
    if (!this.tabs || this.tabs.length === 0) return null;
    return this.tabs.find(t => t.id === this.activeTabId) || this.tabs[0];
  }

  get lineCount(): number {
    if (!this.activeTab?.content) return 1;
    return this.activeTab.content.split('\n').length;
  }

  get charCount(): number {
    return this.activeTab?.content ? this.activeTab.content.length : 0;
  }

  get wordCount(): number {
    const text = this.activeTab?.content?.trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
  }

  get linesArray(): number[] {
    const count = this.lineCount;
    return Array.from({ length: Math.max(count, 1) }, (_, i) => i + 1);
  }

  onNameChange(newName: string): void {
    const tab = this.activeTab;
    if (!tab) return;
    tab.name = newName;
    const lower = newName.toLowerCase();
    if (lower.endsWith('.json')) {
      tab.fileType = 'json';
    } else if (lower.endsWith('.md')) {
      tab.fileType = 'md';
      setTimeout(() => this.syncRichEditorFromTab(), 10);
    } else if (lower.endsWith('.txt')) {
      tab.fileType = 'txt';
    }
    tab.isDirty = tab.content !== tab.savedContent || tab.isNew === true;
    this.lucide.refresh();
  }

  onContentChange(newContent: string): void {
    const tab = this.activeTab;
    if (!tab) return;
    tab.content = newContent;
    tab.isDirty = tab.content !== tab.savedContent;
  }

  setExtension(ext: 'json' | 'txt' | 'md'): void {
    const tab = this.activeTab;
    if (!tab) return;
    let base = tab.name.replace(/\.(json|txt|md|sql|js|ts|html)$/i, '');
    if (!base) base = 'documento';
    tab.name = `${base}.${ext}`;
    tab.fileType = ext;
    tab.isDirty = true;
    if (ext === 'md') {
      setTimeout(() => this.syncRichEditorFromTab(), 10);
    }
    this.lucide.refresh();
  }

  setMdViewMode(mode: 'rich' | 'source'): void {
    if (this.mdViewMode === mode) return;

    if (mode === 'rich' && this.mdViewMode === 'source') {
      this.mdViewMode = 'rich';
      setTimeout(() => this.syncRichEditorFromTab(), 10);
    } else if (mode === 'source' && this.mdViewMode === 'rich') {
      this.onRichInput();
      this.mdViewMode = 'source';
    }
    this.lucide.refresh();
  }

  getTabIcon(fileType: string): string {
    switch (fileType) {
      case 'json':
        return 'file-json';
      case 'md':
        return 'file-code';
      case 'txt':
      default:
        return 'file-text';
    }
  }

  getTabIconColor(fileType: string): string {
    switch (fileType) {
      case 'json':
        return 'text-amber-400';
      case 'md':
        return 'text-emerald-400';
      case 'txt':
      default:
        return 'text-indigo-400';
    }
  }

  onTextareaScroll(e: Event): void {
    const textarea = e.target as HTMLTextAreaElement;
    if (this.editorGutter && textarea) {
      this.editorGutter.nativeElement.scrollTop = textarea.scrollTop;
    }
  }

  // =========================================================================
  // JSON EN VIVO: SINCRONIZACIÓN DE TEXTAREA Y RESALTADO DE SINTAXIS
  // =========================================================================

  onJsonScroll(e: Event): void {
    const textarea = e.target as HTMLTextAreaElement;
    if (textarea) {
      if (this.jsonHighlightPre) {
        this.jsonHighlightPre.nativeElement.scrollTop = textarea.scrollTop;
        this.jsonHighlightPre.nativeElement.scrollLeft = textarea.scrollLeft;
      }
      if (this.jsonGutter) {
        this.jsonGutter.nativeElement.scrollTop = textarea.scrollTop;
      }
    }
  }

  onJsonContentChange(newContent: string): void {
    const tab = this.activeTab;
    if (!tab) return;
    tab.content = newContent;
    tab.isDirty = tab.content !== tab.savedContent;
  }

  get isJsonValid(): boolean {
    const raw = this.activeTab?.content;
    if (!raw || !raw.trim()) return true;
    try {
      JSON.parse(raw);
      return true;
    } catch {
      return false;
    }
  }

  get highlightedJsonContent(): SafeHtml {
    const raw = this.activeTab?.content || '';
    if (!raw) return '';

    const escaped = this.escapeHtmlKeepQuotes(raw);
    const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\]]|[:,])/g;

    const highlighted = escaped.replace(tokenRegex, (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          const colonIdx = match.lastIndexOf(':');
          return `<span class="json-key">${match.slice(0, colonIdx)}</span><span class="json-colon">:</span>`;
        }
        return `<span class="json-string">${match}</span>`;
      }
      if (/^(true|false)$/.test(match)) return `<span class="json-boolean">${match}</span>`;
      if (/^null$/.test(match)) return `<span class="json-null">${match}</span>`;
      if (/^-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?$/.test(match)) return `<span class="json-number">${match}</span>`;
      if (match === '{' || match === '}') return `<span class="json-brace">${match}</span>`;
      if (match === '[' || match === ']') return `<span class="json-bracket">${match}</span>`;
      if (match === ':') return `<span class="json-colon">:</span>`;
      if (match === ',') return `<span class="json-comma">,</span>`;
      return match;
    });

    return this.sanitizer.bypassSecurityTrustHtml(highlighted + '\n');
  }

  highlightJsonInline(escapedCode: string): string {
    const tokenRegex = /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?|[{}\[\]]|[:,])/g;
    return escapedCode.replace(tokenRegex, (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          const colonIndex = match.lastIndexOf(':');
          const keyPart = match.slice(0, colonIndex);
          return `<span class="json-key">${keyPart}</span><span class="json-colon">:</span>`;
        }
        return `<span class="json-string">${match}</span>`;
      }
      if (/^(true|false)$/.test(match)) return `<span class="json-boolean">${match}</span>`;
      if (/^null$/.test(match)) return `<span class="json-null">${match}</span>`;
      if (/^-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?$/.test(match)) return `<span class="json-number">${match}</span>`;
      if (match === '{' || match === '}') return `<span class="json-brace">${match}</span>`;
      if (match === '[' || match === ']') return `<span class="json-bracket">${match}</span>`;
      if (match === ':') return `<span class="json-colon">:</span>`;
      if (match === ',') return `<span class="json-comma">,</span>`;
      return match;
    });
  }

  // =========================================================================
  // HOJA VISUAL MARKDOWN (NOTION / WORD): EDICIÓN DIRECTA EN VIVO
  // =========================================================================

  syncRichEditorFromTab(): void {
    const canvas = this.richCanvas?.nativeElement;
    const tab = this.activeTab;
    if (canvas && tab && tab.fileType === 'md') {
      canvas.innerHTML = this.renderMarkdown(tab.content || '');
      this.lucide.refresh();
    }
  }

  onRichInput(): void {
    const canvas = this.richCanvas?.nativeElement;
    const tab = this.activeTab;
    if (!canvas || !tab) return;

    const md = this.htmlToMarkdown(canvas);
    tab.content = md;
    tab.isDirty = tab.content !== tab.savedContent;
  }

  onRichFocusOut(): void {
    this.onRichInput();
  }

  insertHtmlAtCursor(html: string): void {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const el = document.createElement('div');
      el.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node: Node | null;
      let lastNode: Node | null = null;
      while ((node = el.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      const canvas = this.richCanvas?.nativeElement;
      if (canvas) {
        canvas.insertAdjacentHTML('beforeend', html);
      }
    }
    this.onRichInput();
    this.lucide.refresh();
  }

  formatText(command: string, arg: string = ''): void {
    if (this.mdViewMode === 'rich' && this.richCanvas) {
      this.richCanvas.nativeElement.focus();
      document.execCommand(command, false, arg);
      this.onRichInput();
    } else {
      if (command === 'bold') this.insertBold();
      else if (command === 'italic') this.insertItalic();
      else if (command === 'insertUnorderedList') this.insertBulletList();
      else if (command === 'insertOrderedList') this.insertNumberedList();
    }
  }

  formatHeading(level: 1 | 2 | 3): void {
    if (this.mdViewMode === 'rich' && this.richCanvas) {
      const canvas = this.richCanvas.nativeElement;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !canvas.contains(sel.anchorNode)) {
        canvas.focus();
      }

      let success = false;
      try {
        success = document.execCommand('formatBlock', false, `<h${level}>`);
      } catch (e) {
        success = false;
      }

      if (!success) {
        try {
          success = document.execCommand('formatBlock', false, `h${level}`);
        } catch (e) {
          success = false;
        }
      }

      if (!success) {
        const text = sel?.toString() || `Título H${level}`;
        this.insertHtmlAtCursor(`<h${level}>${this.escapeHtml(text)}</h${level}><p class="my-2"><br></p>`);
      }
      this.onRichInput();
    } else {
      const hashes = '#'.repeat(level);
      this.insertMarkdown(`${hashes} `, '\n', `Título H${level}`);
    }
  }

  // =========================================================================
  // TABLAS INTERACTIVAS ESTILO EXCEL / WORD
  // =========================================================================

  getColumnLetter(colIndex: number): string {
    let letter = '';
    let temp = colIndex;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  parseMarkdownTable(tableMd: string): { headers: string[]; rows: string[][] } | null {
    const lines = tableMd.trim().split(/\r?\n/);
    if (lines.length < 2) return null;
    if (!lines[1].includes('---')) return null;

    const parseLine = (line: string) =>
      line
        .split('|')
        .slice(1, -1)
        .map(c => c.trim());

    const headers = parseLine(lines[0]);
    const rows = lines.slice(2).map(parseLine);
    return { headers, rows };
  }

  serializeTable(headers: string[], rows: string[][]): string {
    const colCount = Math.max(headers.length, ...rows.map(r => r.length), 1);
    const safeHeaders = [...headers];
    while (safeHeaders.length < colCount) {
      safeHeaders.push(`Columna ${this.getColumnLetter(safeHeaders.length)}`);
    }

    const headerLine = `| ${safeHeaders.join(' | ')} |`;
    const sepLine = `| ${safeHeaders.map(() => '---').join(' | ')} |`;
    const rowLines = rows.map(r => {
      const padded = [...r];
      while (padded.length < colCount) padded.push('');
      return `| ${padded.join(' | ')} |`;
    });

    return [headerLine, sepLine, ...rowLines].join('\n') + '\n';
  }

  serializeDomTableToMarkdown(tableEl: HTMLTableElement): string {
    const headerCells = Array.from(tableEl.querySelectorAll('thead.excel-headers th.table-editable-cell'))
      .map(th => th.textContent?.trim() || '');
    if (headerCells.length === 0) return '';

    const headerLine = `| ${headerCells.join(' | ')} |`;
    const sepLine = `| ${headerCells.map(() => '---').join(' | ')} |`;

    const bodyRowEls = Array.from(tableEl.querySelectorAll('tbody tr'));
    const bodyRows = bodyRowEls.map(tr => {
      const cells = Array.from(tr.querySelectorAll('td.table-editable-cell')).map(td => td.textContent?.trim() || '');
      while (cells.length < headerCells.length) cells.push('');
      return `| ${cells.join(' | ')} |`;
    });

    return [headerLine, sepLine, ...bodyRows].join('\n') + '\n';
  }

  replaceTableInMarkdown(content: string, targetIdx: number, newTableMd: string): string {
    let currentIdx = 0;
    return content.replace(/((?:\|[^\n\r]+(?:\r?\n|$))+)/g, (match) => {
      if (!match.includes('---')) return match;
      if (currentIdx === targetIdx) {
        currentIdx++;
        return newTableMd.trimEnd() + '\n';
      }
      currentIdx++;
      return match;
    });
  }

  generateExcelTableHtml(headers: string[], rows: string[][], idx: number): string {
    let tableHtml = `
      <div class="my-6 rounded-2xl excel-table-widget overflow-hidden select-text" contenteditable="false" data-table-id="${idx}">
        <div class="flex items-center justify-between px-4 py-2.5 bg-[#101626] border-b border-[#242e44] select-none">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <i data-lucide="sheet" class="w-3 h-3"></i> Tabla de Datos
            </span>
            <span class="text-[11px] text-slate-400 font-mono">(${rows.length} filas × ${headers.length} columnas)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" class="btn-table-action flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-200 hover:text-emerald-300 text-[11px] font-bold border border-slate-700 transition-all active:scale-95" data-action="add-row" data-table-id="${idx}" title="Insertar nueva fila al final">
              <i data-lucide="plus" class="w-3 h-3 text-emerald-400"></i>
              <span>Fila</span>
            </button>
            <button type="button" class="btn-table-action flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-300 text-[11px] font-bold border border-slate-700 transition-all active:scale-95" data-action="add-col" data-table-id="${idx}" title="Insertar nueva columna a la derecha">
              <i data-lucide="plus" class="w-3 h-3 text-indigo-400"></i>
              <span>Columna</span>
            </button>
            <button type="button" class="btn-table-action flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-rose-900/30 text-slate-400 hover:text-rose-300 text-[11px] font-bold border border-slate-700 transition-all active:scale-95" data-action="del-row" data-table-id="${idx}" title="Eliminar última fila">
              <i data-lucide="minus" class="w-3 h-3 text-rose-400"></i>
              <span>Fila</span>
            </button>
            <button type="button" class="btn-table-action flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-rose-900/30 text-slate-400 hover:text-rose-300 text-[11px] font-bold border border-slate-700 transition-all active:scale-95" data-action="del-col" data-table-id="${idx}" title="Eliminar última columna">
              <i data-lucide="minus" class="w-3 h-3 text-rose-400"></i>
              <span>Col</span>
            </button>
          </div>
        </div>

        <div class="excel-table-scroll custom-table-scrollbar">
          <table class="excel-grid">
            <thead class="bg-[#0b0f1a] text-slate-500 font-mono text-[10px] select-none border-b border-[#242e44]">
              <tr>
                <th class="excel-row-num text-center py-1 border-r border-[#242e44] text-slate-600 font-bold bg-[#090d17]">#</th>`;

    headers.forEach((_h, cIdx) => {
      const letter = this.getColumnLetter(cIdx);
      tableHtml += `
        <th class="excel-col-header" data-col-idx="${cIdx}">
          <div class="flex items-center justify-between px-1.5">
            <span>${letter}</span>
            <button type="button" class="col-del-btn text-rose-400 hover:text-rose-200" data-table-id="${idx}" data-col-idx="${cIdx}" title="Eliminar Columna ${letter}">×</button>
          </div>
        </th>`;
    });

    tableHtml += `</tr></thead>`;

    tableHtml += `<thead class="excel-headers bg-[#121829] border-b border-[#242e44] text-slate-100 font-bold"><tr>`;
    tableHtml += `<th class="excel-row-num excel-row-h text-center text-[10px] font-mono text-slate-500 bg-[#0e1320] border-r border-[#242e44]">H</th>`;

    headers.forEach((h, cIdx) => {
      tableHtml += `<th contenteditable="true" data-table-id="${idx}" data-row="header" data-col="${cIdx}" class="table-editable-cell p-2.5 border-r border-[#20293d] last:border-0 hover:bg-indigo-950/30 focus:bg-indigo-950/60 focus:outline-none transition-colors">${this.escapeHtml(h) || '<br>'}</th>`;
    });

    tableHtml += `</tr></thead><tbody class="divide-y divide-[#1e273a] bg-[#0c101c]">`;

    rows.forEach((r, rIdx) => {
      tableHtml += `<tr class="hover:bg-slate-800/20 transition-colors">`;
      tableHtml += `
        <td class="excel-row-num">
          <div class="flex items-center justify-between px-1">
            <span>${rIdx + 1}</span>
            <button type="button" class="row-del-btn text-rose-400 hover:text-rose-200" data-table-id="${idx}" data-row-idx="${rIdx}" title="Eliminar Fila ${rIdx + 1}">×</button>
          </div>
        </td>`;

      headers.forEach((_h, cIdx) => {
        const val = r[cIdx] !== undefined ? r[cIdx] : '';
        tableHtml += `<td contenteditable="true" data-table-id="${idx}" data-row="${rIdx}" data-col="${cIdx}" class="table-editable-cell p-2.5 border-r border-[#20293d] last:border-0 text-slate-300 hover:bg-indigo-950/30 focus:bg-indigo-950/60 focus:outline-none transition-colors">${this.escapeHtml(val) || '<br>'}</td>`;
      });
      tableHtml += `</tr>`;
    });

    tableHtml += `</tbody></table></div></div>`;
    return tableHtml;
  }

  handleTableAction(tableIdx: number, action: string, paramIndex?: number): void {
    const tab = this.activeTab;
    if (!tab) return;

    // 1. Intentar leer los datos directamente desde el DOM vivo para no perder ediciones
    const widgetEl = document.querySelector(`.excel-table-widget[data-table-id="${tableIdx}"]`) as HTMLElement;
    let headers: string[] = [];
    let rows: string[][] = [];

    if (widgetEl) {
      const headerEls = Array.from(widgetEl.querySelectorAll('thead.excel-headers th.table-editable-cell'));
      headers = headerEls.map(th => th.textContent?.trim() || '');

      const rowEls = Array.from(widgetEl.querySelectorAll('tbody tr'));
      rows = rowEls.map(tr => {
        const cellEls = Array.from(tr.querySelectorAll('td.table-editable-cell'));
        return cellEls.map(td => td.textContent?.trim() || '');
      });
    }

    // 2. Si no se encontró en el DOM, recurrir a tab.content
    if (headers.length === 0 && tab.content) {
      let currentIdx = 0;
      let foundTable = '';
      tab.content.replace(/((?:\|[^\n\r]+(?:\r?\n|$))+)/g, (match) => {
        if (!match.includes('---')) return match;
        if (currentIdx === tableIdx) {
          foundTable = match;
        }
        currentIdx++;
        return match;
      });

      if (foundTable) {
        const parsed = this.parseMarkdownTable(foundTable);
        if (parsed) {
          headers = parsed.headers;
          rows = parsed.rows;
        }
      }
    }

    if (headers.length === 0) return;

    // 3. Ejecutar la acción
    if (action === 'add-row') {
      const newRow = headers.map(() => '');
      if (paramIndex !== undefined && paramIndex >= 0 && paramIndex <= rows.length) {
        rows.splice(paramIndex, 0, newRow);
      } else {
        rows.push(newRow);
      }
    } else if (action === 'add-col') {
      const letter = this.getColumnLetter(headers.length);
      const colName = `Columna ${letter}`;
      if (paramIndex !== undefined && paramIndex >= 0 && paramIndex <= headers.length) {
        headers.splice(paramIndex, 0, colName);
        rows.forEach(r => r.splice(paramIndex, 0, ''));
      } else {
        headers.push(colName);
        rows.forEach(r => r.push(''));
      }
    } else if (action === 'del-row') {
      if (rows.length > 1) {
        if (paramIndex !== undefined && paramIndex >= 0 && paramIndex < rows.length) {
          rows.splice(paramIndex, 1);
        } else {
          rows.pop();
        }
      }
    } else if (action === 'del-col') {
      if (headers.length > 1) {
        if (paramIndex !== undefined && paramIndex >= 0 && paramIndex < headers.length) {
          headers.splice(paramIndex, 1);
          rows.forEach(r => r.splice(paramIndex, 1));
        } else {
          headers.pop();
          rows.forEach(r => r.pop());
        }
      }
    }

    // 4. Reemplazo directo en el DOM: instantáneo y sin parpadeo
    if (widgetEl) {
      const newHtml = this.generateExcelTableHtml(headers, rows, tableIdx);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newHtml.trim();
      const newWidget = tempDiv.firstElementChild;
      if (newWidget) {
        widgetEl.replaceWith(newWidget);

        // Desplazamiento horizontal automático al agregar columna
        if (action === 'add-col') {
          setTimeout(() => {
            const scrollContainer = newWidget.querySelector('.excel-table-scroll') as HTMLElement;
            if (scrollContainer) {
              scrollContainer.scrollLeft = scrollContainer.scrollWidth;
            }
          }, 30);
        }

        this.onRichInput();
        this.lucide.refresh();
        return;
      }
    }

    // Fallback completo si el widget no estaba en el DOM
    const newTableMd = this.serializeTable(headers, rows);
    const updated = this.replaceTableInMarkdown(tab.content, tableIdx, newTableMd);
    tab.content = updated;
    tab.isDirty = true;
    this.syncRichEditorFromTab();
  }

  onTableKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (!target || !target.classList.contains('table-editable-cell')) return;

    if (event.key === 'Tab') {
      event.preventDefault();
      const allCells = Array.from(document.querySelectorAll<HTMLElement>('.table-editable-cell'));
      const currentIdx = allCells.indexOf(target);
      if (event.shiftKey) {
        if (currentIdx > 0) {
          allCells[currentIdx - 1].focus();
        }
      } else {
        if (currentIdx < allCells.length - 1) {
          allCells[currentIdx + 1].focus();
        } else {
          const tableWrapper = target.closest('[data-table-id]') as HTMLElement;
          if (tableWrapper) {
            const tableId = parseInt(tableWrapper.getAttribute('data-table-id') || '0', 10);
            this.handleTableAction(tableId, 'add-row');
            setTimeout(() => {
              const updatedCells = Array.from(document.querySelectorAll<HTMLElement>('.table-editable-cell'));
              if (updatedCells.length > currentIdx + 1) {
                updatedCells[currentIdx + 1].focus();
              }
            }, 60);
          }
        }
      }
    }
  }

  onCanvasKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;

    // 1. Manejo de tabulaciones en tabla Excel
    this.onTableKeyDown(event);

    // 2. Manejo de items de Checklist
    if (target && target.classList.contains('task-label-text')) {
      const taskItem = target.closest('.checklist-item') as HTMLElement;
      if (!taskItem) return;

      // Al pulsar Backspace en una tarea vacía, eliminarla y regresar el foco
      if (event.key === 'Backspace' && (!target.textContent || target.textContent.trim() === '')) {
        event.preventDefault();
        const prev = taskItem.previousElementSibling as HTMLElement;
        const next = taskItem.nextElementSibling as HTMLElement;
        taskItem.remove();
        this.onRichInput();
        if (prev) {
          const prevSpan = (prev.querySelector('.task-label-text') as HTMLElement) || prev;
          this.focusNode(prevSpan);
        } else if (next) {
          const nextSpan = (next.querySelector('.task-label-text') as HTMLElement) || next;
          this.focusNode(nextSpan);
        } else {
          const p = document.createElement('p');
          p.className = 'my-2';
          p.innerHTML = '<br>';
          this.richCanvas?.nativeElement.appendChild(p);
          this.focusNode(p);
        }
        return;
      }

      // Al pulsar Enter, crear una nueva tarea inmediatamente debajo
      if (event.key === 'Enter') {
        event.preventDefault();
        const newIdx = document.querySelectorAll('.checklist-item').length;
        const newCheckHtml = `
          <div class="checklist-item flex items-center gap-2.5 my-2 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors group/task" contenteditable="false" data-task-index="${newIdx}">
            <input type="checkbox" class="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 accent-emerald-500 cursor-pointer">
            <span contenteditable="true" class="task-label-text text-xs font-medium leading-normal text-slate-200 focus:outline-none flex-1"></span>
            <button type="button" class="del-task-btn p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-all opacity-0 group-hover/task:opacity-100 ml-auto flex-shrink-0 cursor-pointer" title="Eliminar tarea">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
          </div>
        `;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newCheckHtml.trim();
        const newEl = tempDiv.firstElementChild as HTMLElement;
        taskItem.after(newEl);
        this.lucide.refresh();
        const newSpan = newEl.querySelector('.task-label-text') as HTMLElement;
        if (newSpan) {
          this.focusNode(newSpan);
        }
        this.onRichInput();
        return;
      }
    }
  }

  onPreviewClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Botones de acción general de tabla (+ Fila, + Columna, - Fila, - Columna)
    const actionBtn = target.closest('.btn-table-action') as HTMLElement;
    if (actionBtn) {
      event.preventDefault();
      event.stopPropagation();
      const action = actionBtn.getAttribute('data-action') as string;
      const tableIdStr = actionBtn.getAttribute('data-table-id');
      if (action && tableIdStr !== null) {
        this.handleTableAction(parseInt(tableIdStr, 10), action);
        return;
      }
    }

    // Botón borrar columna individual
    const delColBtn = target.closest('.col-del-btn') as HTMLElement;
    if (delColBtn) {
      event.preventDefault();
      event.stopPropagation();
      const tableId = parseInt(delColBtn.getAttribute('data-table-id') || '0', 10);
      const colIdx = parseInt(delColBtn.getAttribute('data-col-idx') || '0', 10);
      this.handleTableAction(tableId, 'del-col', colIdx);
      return;
    }

    // Botón borrar fila individual
    const delRowBtn = target.closest('.row-del-btn') as HTMLElement;
    if (delRowBtn) {
      event.preventDefault();
      event.stopPropagation();
      const tableId = parseInt(delRowBtn.getAttribute('data-table-id') || '0', 10);
      const rowIdx = parseInt(delRowBtn.getAttribute('data-row-idx') || '0', 10);
      this.handleTableAction(tableId, 'del-row', rowIdx);
      return;
    }

    // Botón borrar item de checklist
    const delTaskBtn = target.closest('.del-task-btn') as HTMLElement;
    if (delTaskBtn) {
      event.preventDefault();
      event.stopPropagation();
      const taskRow = delTaskBtn.closest('.checklist-item');
      if (taskRow) {
        taskRow.remove();
        this.onRichInput();
      }
      return;
    }

    // Checklist interactivo
    const taskRow = target.closest('.checklist-item') as HTMLElement;
    if (taskRow) {
      const checkbox = taskRow.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (target.tagName.toLowerCase() === 'input') {
        // Clic directo en el checkbox
        const label = taskRow.querySelector('.task-label-text');
        if (checkbox.checked) {
          label?.classList.add('line-through', 'text-slate-400');
        } else {
          label?.classList.remove('line-through', 'text-slate-400');
        }
        this.onRichInput();
      }
    }
  }

  // =========================================================================
  // HERRAMIENTAS DE FORMATEO MARKDOWN (.MD)
  // =========================================================================

  insertMarkdown(prefix: string, suffix = '', defaultText = ''): void {
    const tab = this.activeTab;
    if (!tab) return;
    const val = tab.content || '';
    const replacement = prefix + defaultText + suffix;
    tab.content = val + (val.endsWith('\n') ? '' : '\n\n') + replacement + '\n';
    tab.isDirty = true;
    this.lucide.refresh();
  }

  insertBold(): void {
    this.formatText('bold');
  }

  insertItalic(): void {
    this.formatText('italic');
  }

  insertHeading(level: 1 | 2 | 3): void {
    this.formatHeading(level);
  }

  insertBulletList(): void {
    this.formatText('insertUnorderedList');
  }

  insertNumberedList(): void {
    this.formatText('insertOrderedList');
  }

  insertChecklist(): void {
    if (this.mdViewMode === 'rich' && this.richCanvas) {
      const idx = document.querySelectorAll('.checklist-item').length;
      const checkHtml = `
        <div class="checklist-item flex items-center gap-2.5 my-2 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors group/task" contenteditable="false" data-task-index="${idx}">
          <input type="checkbox" class="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 accent-emerald-500 cursor-pointer">
          <span contenteditable="true" class="task-label-text text-xs font-medium leading-normal text-slate-200 focus:outline-none flex-1">Nueva tarea</span>
          <button type="button" class="del-task-btn p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-all opacity-0 group-hover/task:opacity-100 ml-auto flex-shrink-0 cursor-pointer" title="Eliminar tarea">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
          </button>
        </div>
        <p class="my-2"><br></p>
      `;
      this.insertHtmlAtCursor(checkHtml);
      this.lucide.refresh();
    } else {
      this.insertMarkdown('- [ ] ', '\n', 'Nueva tarea');
    }
  }

  insertCodeBlock(): void {
    if (this.mdViewMode === 'rich' && this.richCanvas) {
      const canvas = this.richCanvas.nativeElement;
      const isEmpty = !canvas.textContent?.trim();
      const codeHtml = `
        ${isEmpty ? '<p class="my-2 leading-relaxed"><br></p>' : ''}
        <div class="my-5 rounded-xl code-block-dark border border-[#242938] shadow-lg overflow-hidden select-text" contenteditable="false">
          <div class="flex items-center justify-between px-3.5 py-1.5 bg-[#0f121a] border-b border-[#242938] text-[10px] uppercase font-bold text-slate-400 tracking-wider select-none">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              <span contenteditable="true" spellcheck="false" class="code-lang-label outline-none px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-amber-300 cursor-text select-text transition-colors border border-slate-700/60" title="Haz clic para editar el lenguaje o título">json</span>
            </span>
            <span class="text-[9px] text-slate-500 font-mono">bloque de código</span>
          </div>
          <pre class="p-3.5 code-font text-xs text-slate-200 select-text leading-relaxed overflow-x-auto custom-scrollbar"><code contenteditable="true" spellcheck="false" class="outline-none block min-h-[40px]">{\n  "status": 200\n}</code></pre>
        </div>
        <p class="my-3"><br></p>
      `;
      this.insertHtmlAtCursor(codeHtml);
    } else {
      this.insertMarkdown('```json\n', '\n```\n', '{\n  "status": 200\n}');
    }
  }

  insertQuote(): void {
    if (this.mdViewMode === 'rich' && this.richCanvas) {
      const sel = window.getSelection();
      const selectedText = sel?.toString()?.trim();
      if (selectedText) {
        let ok = false;
        try {
          ok = document.execCommand('formatBlock', false, '<blockquote>');
        } catch (e) {
          ok = false;
        }
        if (!ok) {
          this.insertHtmlAtCursor(`<blockquote>${this.escapeHtml(selectedText)}</blockquote><p class="my-3"><br></p>`);
        }
      } else {
        const quoteHtml = `<blockquote>Cita o nota importante</blockquote><p class="my-3"><br></p>`;
        this.insertHtmlAtCursor(quoteHtml);
      }
      this.onRichInput();
    } else {
      this.insertMarkdown('> ', '\n', 'Cita o nota importante');
    }
  }

  insertTable(): void {
    if (this.mdViewMode === 'rich' && this.richCanvas) {
      const idx = document.querySelectorAll('.excel-table-widget').length;
      const tableHtml = this.generateExcelTableHtml(['Parámetro', 'Tipo', 'Descripción'], [
        ['id', 'number', 'Identificador único'],
        ['nombre', 'string', 'Nombre del registro']
      ], idx) + '<p class="my-3"><br></p>';
      this.insertHtmlAtCursor(tableHtml);
    } else {
      const table = '| Parámetro | Tipo | Descripción |\n| --- | --- | --- |\n| id | number | Identificador único |\n| nombre | string | Nombre del registro |\n';
      this.insertMarkdown(table, '', '');
    }
  }

  // =========================================================================
  // SERIALIZADOR BIDIRECCIONAL: HTML -> MARKDOWN
  // =========================================================================

  htmlToMarkdown(element: HTMLElement): string {
    let md = '';
    element.childNodes.forEach((node) => {
      md += this.nodeToMarkdown(node);
    });
    return md.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }

  nodeToMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    // 1. Widget de Tabla Excel
    if (el.classList.contains('excel-table-widget') || tag === 'table') {
      const tableEl = el.querySelector('table') || (tag === 'table' ? (el as HTMLTableElement) : null);
      if (tableEl) {
        return '\n' + this.serializeDomTableToMarkdown(tableEl) + '\n';
      }
      return '';
    }

    // 2. Bloque de código
    if (el.classList.contains('code-block-dark')) {
      const codeEl = el.querySelector('code');
      const langSpan = el.querySelector('.code-lang-label');
      const lang = langSpan?.textContent?.trim().toLowerCase() || '';
      const code = codeEl?.textContent || '';
      return `\n\`\`\`${lang}\n${code.trimEnd()}\n\`\`\`\n\n`;
    }

    // 3. Encabezados
    if (tag === 'h1') {
      return `\n# ${this.getInnerMarkdown(el).trim()}\n\n`;
    }
    if (tag === 'h2') {
      return `\n## ${this.getInnerMarkdown(el).trim()}\n\n`;
    }
    if (tag === 'h3') {
      return `\n### ${this.getInnerMarkdown(el).trim()}\n\n`;
    }
    if (tag === 'h4') {
      return `\n#### ${this.getInnerMarkdown(el).trim()}\n\n`;
    }

    // 4. Cita (Blockquote)
    if (tag === 'blockquote') {
      return `\n> ${this.getInnerMarkdown(el).trim()}\n\n`;
    }

    // 5. Checklist
    if (el.classList.contains('checklist-item')) {
      const checkbox = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const isChecked = checkbox ? checkbox.checked : false;
      const labelSpan = el.querySelector('.task-label-text') || el.querySelector('span:last-child');
      const label = labelSpan?.textContent?.trim() || '';
      return `- [${isChecked ? 'x' : ' '}] ${label}\n`;
    }

    // 6. Listas
    if (tag === 'ol') {
      let listMd = '\n';
      let itemNum = 1;
      el.childNodes.forEach((c) => {
        if (c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName.toLowerCase() === 'li') {
          listMd += `${itemNum++}. ${this.getInnerMarkdown(c as HTMLElement).trim()}\n`;
        } else {
          listMd += this.nodeToMarkdown(c);
        }
      });
      return listMd + '\n';
    }
    if (tag === 'ul') {
      let listMd = '\n';
      el.childNodes.forEach((c) => {
        if (c.nodeType === Node.ELEMENT_NODE && (c as HTMLElement).tagName.toLowerCase() === 'li') {
          listMd += `- ${this.getInnerMarkdown(c as HTMLElement).trim()}\n`;
        } else {
          listMd += this.nodeToMarkdown(c);
        }
      });
      return listMd + '\n';
    }
    if (tag === 'li') {
      const parentTag = el.parentElement?.tagName.toLowerCase();
      if (parentTag === 'ol') {
        return `1. ${this.getInnerMarkdown(el).trim()}\n`;
      }
      return `- ${this.getInnerMarkdown(el).trim()}\n`;
    }

    // 7. Separador
    if (tag === 'hr') {
      return '\n---\n\n';
    }

    // 8. Formato en línea
    if (tag === 'strong' || tag === 'b') {
      return `**${this.getInnerMarkdown(el)}**`;
    }
    if (tag === 'em' || tag === 'i') {
      return `*${this.getInnerMarkdown(el)}*`;
    }
    if (tag === 'code') {
      return `\`${el.textContent || ''}\``;
    }
    if (tag === 'a') {
      const href = el.getAttribute('href') || '#';
      return `[${el.textContent || ''}](${href})`;
    }
    if (tag === 'br') {
      return '\n';
    }

    // 9. Párrafos o divs genéricos
    if (tag === 'p' || tag === 'div') {
      const inner = this.getInnerMarkdown(el);
      if (!inner.trim()) return '\n';
      return `${inner}\n\n`;
    }

    return this.getInnerMarkdown(el);
  }

  getInnerMarkdown(el: HTMLElement): string {
    let res = '';
    el.childNodes.forEach((child) => {
      res += this.nodeToMarkdown(child);
    });
    return res;
  }

  // =========================================================================
  // RENDERIZADOR: MARKDOWN -> HTML VISUAL UNIFICADO
  // =========================================================================

  renderMarkdown(raw: string): string {
    if (!raw || !raw.trim()) {
      return '<p class="text-slate-400 italic">Haz clic aquí para comenzar a escribir tu documento...</p>';
    }

    let text = raw.replace(/\r\n/g, '\n');

    // 1. Extraer bloques de código a tokens seguros
    const codeBlocks: string[] = [];
    text = text.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      const idx = codeBlocks.length;
      const cleanLang = (lang || '').trim().toLowerCase();

      let formattedCode = this.escapeHtmlKeepQuotes(code.trimEnd());
      if (cleanLang === 'json') {
        formattedCode = this.highlightJsonInline(formattedCode);
      }

      const langLabel = `<div class="flex items-center justify-between px-3.5 py-1.5 bg-[#0f121a] border-b border-[#242938] text-[10px] uppercase font-bold text-slate-400 tracking-wider select-none">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full ${cleanLang === 'json' ? 'bg-amber-400' : 'bg-indigo-400'}"></span>
            <span contenteditable="true" spellcheck="false" class="code-lang-label outline-none px-2 py-0.5 rounded bg-slate-800/90 hover:bg-slate-700 text-amber-300 cursor-text select-text transition-colors border border-slate-700/60" title="Haz clic para editar el lenguaje o título">${this.escapeHtml(cleanLang || 'código')}</span>
          </span>
          <span class="text-[9px] text-slate-500 font-mono">bloque de código</span>
         </div>`;

      codeBlocks.push(
        `<div class="my-5 rounded-xl code-block-dark border border-[#242938] shadow-lg overflow-hidden select-text" contenteditable="false">${langLabel}<pre class="p-3.5 code-font text-xs text-slate-200 select-text leading-relaxed overflow-x-auto custom-scrollbar"><code contenteditable="true" spellcheck="false" class="outline-none block min-h-[40px]">${formattedCode}</code></pre></div><p class="my-3"><br></p>`
      );
      return `TOKENCODEBLOCK${idx}ENDTOKEN`;
    });

    // 2. Extraer tablas Markdown y renderizarlas como Tablas Excel / Word interactivas
    const tableBlocks: string[] = [];
    text = text.replace(/((?:\|[^\n\r]+\|\n)+)/g, (match) => {
      const idx = tableBlocks.length;
      const parsed = this.parseMarkdownTable(match);
      if (!parsed) return match;

      const { headers, rows } = parsed;
      const tableHtml = this.generateExcelTableHtml(headers, rows, idx) + '<p class="my-3"><br></p>';
      tableBlocks.push(tableHtml);
      return `TOKENTABLEBLOCK${idx}ENDTOKEN\n`;
    });

    // 3. Escapar HTML base
    text = this.escapeHtml(text);

    // 4. Encabezados con margen generoso
    text = text.replace(/^### (.*$)/gim, '<h3 class="text-sm md:text-base font-bold text-indigo-300 mt-6 mb-2.5 flex items-center gap-1.5"><span class="text-indigo-500 font-mono text-xs select-none">###</span> $1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2 class="text-base md:text-lg font-bold text-slate-100 border-b border-slate-800/80 pb-1.5 mt-7 mb-3 flex items-center gap-1.5"><span class="text-indigo-400 font-mono text-xs select-none">##</span> $1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1 class="text-lg md:text-xl font-black text-white border-b-2 border-indigo-500/40 pb-2 mt-8 mb-4 flex items-center gap-2"><span class="text-indigo-500 font-mono text-sm select-none">#</span> $1</h1>');

    // 5. Separadores
    text = text.replace(/^---$/gim, '<hr class="border-slate-800 my-6" />');

    // 6. Citas (Blockquotes) con párrafo posterior para escribir fluido
    text = text.replace(/^(&gt;|>)\s*(.*$)/gim, '<blockquote class="border-l-4 border-indigo-500 bg-indigo-500/10 px-4 py-2.5 my-4 rounded-r-xl text-slate-300 italic text-xs leading-relaxed shadow-sm">$2</blockquote><p class="my-2"><br></p>');

    // 7. Checklists interactivos con botón eliminar
    let checklistIndex = 0;
    text = text.replace(/^[\s]*[-*]\s+\[([ xX])\]\s*(.*$)/gim, (_match, checkState, taskLabel) => {
      const isChecked = checkState.toLowerCase() === 'x';
      const currentIndex = checklistIndex++;
      return `
        <div class="checklist-item flex items-center gap-2.5 my-2 p-1.5 rounded-lg hover:bg-slate-800/40 transition-colors group/task" contenteditable="false" data-task-index="${currentIndex}">
          <input type="checkbox" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 accent-emerald-500 cursor-pointer">
          <span contenteditable="true" class="task-label-text text-xs font-medium leading-normal ${isChecked ? 'line-through text-slate-400' : 'text-slate-200 group-hover/task:text-white'} focus:outline-none flex-1">${taskLabel}</span>
          <button type="button" class="del-task-btn p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-all opacity-0 group-hover/task:opacity-100 ml-auto flex-shrink-0 cursor-pointer" title="Eliminar tarea">
            <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
          </button>
        </div>
      `;
    });

    // 8. Listas ordenadas y desordenadas (Viñetas y Numeradas)
    text = text.replace(/((?:^(?:[\*\-])(?!\s*\[[ xX]\])\s+[^\n]+(?:\r?\n|$))+)/gm, (match) => {
      const items = match.trim().split(/\r?\n/).map(line => {
        const content = line.replace(/^[\*\-]\s+/, '');
        return `<li class="my-1">${content}</li>`;
      }).join('');
      return `<ul class="my-3 pl-6 list-disc text-slate-200 text-xs md:text-sm space-y-1">${items}</ul>\n`;
    });

    text = text.replace(/((?:^\d+\.\s+[^\n]+(?:\r?\n|$))+)/gm, (match) => {
      const items = match.trim().split(/\r?\n/).map(line => {
        const content = line.replace(/^\d+\.\s+/, '');
        return `<li class="my-1">${content}</li>`;
      }).join('');
      return `<ol class="my-3 pl-6 list-decimal text-slate-200 text-xs md:text-sm space-y-1">${items}</ol>\n`;
    });

    // 9. Código en línea
    text = text.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[#141720] text-emerald-300 border border-[#232736] font-semibold">$1</code>');

    // 10. Negrita y Cursiva
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong class="font-bold text-white">$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em class="italic text-indigo-200">$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em class="italic text-indigo-200">$1</em>');

    // 11. Enlaces
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">$1</a>');

    // 12. Saltos de línea y espaciado de párrafos
    text = text.replace(/\n{2,}/g, '<div class="h-4 my-2.5"></div>');
    text = text.replace(/\n/g, '<br/>');
    text = text.replace(/<\/ul>\s*<br\s*\/?>/gi, '</ul>');
    text = text.replace(/<\/ol>\s*<br\s*\/?>/gi, '</ol>');

    // 13. Restaurar tablas interactivas
    text = text.replace(/TOKENTABLEBLOCK(\d+)ENDTOKEN/g, (_match, idx) => {
      return tableBlocks[Number(idx)] || '';
    });

    // 14. Restaurar bloques de código
    text = text.replace(/TOKENCODEBLOCK(\d+)ENDTOKEN/g, (_match, idx) => {
      return codeBlocks[Number(idx)] || '';
    });

    // Si el documento comienza con un bloque de código, tabla o cita, insertar un párrafo inicial para poder escribir al inicio
    if (/^\s*(<div class="[^"]*code-block-dark|<div class="[^"]*excel-table-widget|<blockquote)/.test(text.trim())) {
      text = `<p class="my-2 leading-relaxed"><br></p>` + text;
    }

    return text;
  }

  onCanvasWrapperClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const canvas = this.richCanvas?.nativeElement;
    if (!canvas) return;

    // Si el clic fue en un elemento editable, botón o input, no interferir
    if (target.isContentEditable || target.closest('button') || target.closest('input')) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    // 1. Clic en la parte superior (arriba del primer elemento para poder escribir al inicio)
    if (event.clientY < rect.top + 36) {
      const firstChild = canvas.firstElementChild;
      if (firstChild && (firstChild.classList.contains('code-block-dark') || firstChild.classList.contains('excel-table-widget') || firstChild.tagName.toLowerCase() === 'blockquote')) {
        const p = document.createElement('p');
        p.className = 'my-2';
        p.innerHTML = '<br>';
        canvas.insertBefore(p, firstChild);
        this.focusNode(p);
        this.onRichInput();
        return;
      }
    }

    // 2. Clic en el lienzo o en el wrapper de la hoja por debajo del contenido
    if (event.clientY > rect.bottom - 100 || target === canvas || target.id === 'documentSheetCanvas' || target.classList.contains('document-sheet-canvas')) {
      const lastChild = canvas.lastElementChild;
      if (!lastChild || lastChild.classList.contains('code-block-dark') || lastChild.classList.contains('excel-table-widget') || lastChild.tagName.toLowerCase() !== 'p') {
        const p = document.createElement('p');
        p.className = 'my-3';
        p.innerHTML = '<br>';
        canvas.appendChild(p);
        this.focusNode(p);
      } else if (lastChild.tagName.toLowerCase() === 'p') {
        this.focusNode(lastChild as HTMLElement);
      }
    }
  }

  focusNode(el: HTMLElement): void {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    el.focus();
  }

  // =========================================================================
  // EXPORTAR A PDF E IMAGEN
  // =========================================================================

  exportPdf(): void {
    const tab = this.activeTab;
    if (!tab) return;
    const targetEl = document.getElementById('documentSheetCanvas') || this.editorTextarea?.nativeElement;
    if (!targetEl) return;

    const baseName = tab.name.replace(/\.[^/.]+$/, '') || 'documento';
    const filename = `${baseName}.pdf`;

    const html2pdf = (window as any).html2pdf;
    if (typeof html2pdf === 'function') {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#0f1424' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(targetEl).save();
    } else {
      window.print();
    }
  }

  async exportImage(): Promise<void> {
    const tab = this.activeTab;
    if (!tab) return;
    const targetEl = document.getElementById('documentSheetCanvas') || this.editorTextarea?.nativeElement;
    if (!targetEl) return;

    const baseName = tab.name.replace(/\.[^/.]+$/, '') || 'documento';
    const filename = `${baseName}.png`;

    const html2canvas = (window as any).html2canvas;
    if (typeof html2canvas === 'function') {
      try {
        const canvas = await html2canvas(targetEl, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#0f1424'
        });
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (e) {
        console.error('Error al exportar imagen:', e);
      }
    }
  }

  escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  escapeHtmlKeepQuotes(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

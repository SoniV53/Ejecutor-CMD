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
import * as beautify from 'js-beautify';
import * as Prism from 'prismjs';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';

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
  @Output() toastRequested = new EventEmitter<{ msg: string; icon?: string; color?: string }>();

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

    if (mode === 'source' && this.mdViewMode === 'rich') {
      this.onRichInput();
      this.mdViewMode = 'source';
    } else if (mode === 'rich' && this.mdViewMode === 'source') {
      this.mdViewMode = 'rich';
      setTimeout(() => {
        this.syncRichEditorFromTab();
      }, 50);
    }
    this.lucide.refresh();
  }

  onSwitchTab(tabId: string): void {
    if (this.activeTabId === tabId) return;
    if (this.mdViewMode === 'rich') {
      this.onRichInput();
    }
    this.selectTab.emit(tabId);
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

  private savedRange: Range | null = null;

  saveSelection(): void {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (this.richCanvas?.nativeElement.contains(range.commonAncestorContainer)) {
        this.savedRange = range.cloneRange();
      }
    }
  }

  restoreSelection(): boolean {
    if (this.savedRange) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
        return true;
      }
    }
    return false;
  }

  updateCodeGutter(codeBlock: HTMLElement | null): void {
    if (!codeBlock) return;
    const gutter = codeBlock.querySelector('.code-gutter');
    const code = codeBlock.querySelector('code');
    if (!gutter || !code) return;

    const lines = Math.max((code.innerText || code.textContent || '').split('\n').length, 1);
    gutter.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
  }

  formatSqlCode(sql: string): string {
    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING',
      'LIMIT', 'OFFSET', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'
    ];
    let formatted = sql.replace(/\s+/g, ' ').trim();
    keywords.forEach(kw => {
      const reg = new RegExp(`\\b${kw}\\b`, 'gi');
      if (['AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN'].includes(kw)) {
        formatted = formatted.replace(reg, `\n    ${kw}`);
      } else {
        formatted = formatted.replace(reg, `\n${kw}`);
      }
    });
    return formatted.trim();
  }

  formatGenericCode(code: string): string {
    return code
      .split('\n')
      .map(line => line.replace(/\t/g, '    ').trimEnd())
      .join('\n')
      .trim();
  }

  formatHtmlCode(html: string): string {
    try {
      return beautify.html(html, {
        indent_size: 4,
        wrap_attributes: 'force-expand-multiline',
        indent_inner_html: true,
        preserve_newlines: true,
        max_preserve_newlines: 2,
        end_with_newline: false
      });
    } catch {
      return html;
    }
  }

  formatJsCode(code: string): string {
    try {
      return beautify.js(code, {
        indent_size: 4,
        preserve_newlines: true,
        max_preserve_newlines: 2
      });
    } catch {
      return code;
    }
  }

  formatJavaCode(code: string): string {
    try {
      return beautify.js(code, {
        indent_size: 4,
        preserve_newlines: true,
        max_preserve_newlines: 2,
        brace_style: 'collapse',
        space_before_conditional: true
      });
    } catch {
      return code;
    }
  }

  formatKotlinCode(code: string): string {
    try {
      return beautify.js(code, {
        indent_size: 4,
        preserve_newlines: true,
        max_preserve_newlines: 2,
        brace_style: 'collapse',
        space_before_conditional: true
      });
    } catch {
      return code;
    }
  }

  formatCssCode(css: string): string {
    try {
      return beautify.css(css, {
        indent_size: 4,
        newline_between_rules: true
      });
    } catch {
      return css;
    }
  }

  highlightCode(code: string, lang: string): string {
    const l = (lang || '').trim().toLowerCase();
    let grammar = Prism.languages['markup'];
    let prismLang = 'markup';

    if (l === 'json') {
      grammar = Prism.languages['json'] || Prism.languages['javascript'];
      prismLang = 'json';
    } else if (['java'].includes(l)) {
      grammar = Prism.languages['java'] || Prism.languages['clike'];
      prismLang = 'java';
    } else if (['kt', 'kotlin'].includes(l)) {
      grammar = Prism.languages['kotlin'] || Prism.languages['clike'];
      prismLang = 'kotlin';
    } else if (['ts', 'typescript'].includes(l)) {
      grammar = Prism.languages['typescript'] || Prism.languages['javascript'];
      prismLang = 'typescript';
    } else if (['js', 'javascript'].includes(l)) {
      grammar = Prism.languages['javascript'];
      prismLang = 'javascript';
    } else if (['css', 'scss'].includes(l)) {
      grammar = Prism.languages['css'];
      prismLang = 'css';
    } else if (l === 'sql') {
      grammar = Prism.languages['sql'];
      prismLang = 'sql';
    } else if (['bash', 'sh', 'shell', 'cmd', 'ps1'].includes(l)) {
      grammar = Prism.languages['bash'];
      prismLang = 'bash';
    } else if (['py', 'python'].includes(l)) {
      grammar = Prism.languages['python'];
      prismLang = 'python';
    } else if (['html', 'xml'].includes(l) || /<!DOCTYPE|<\/?[a-zA-Z0-9_\-]+>/i.test(code)) {
      grammar = Prism.languages['markup'];
      prismLang = 'markup';
    }

    if (grammar) {
      try {
        return Prism.highlight(code, grammar, prismLang);
      } catch {
        return this.escapeHtml(code);
      }
    }
    return this.escapeHtml(code);
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
              <i data-lucide="sheet" class="w-3 h-3 pointer-events-none"></i> Tabla de Datos
            </span>
            <span class="text-[11px] text-slate-400 font-mono">(${rows.length} filas × ${headers.length} columnas)</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" class="btn-table-action flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-200 hover:text-emerald-300 text-[11px] font-bold border border-slate-700 transition-all active:scale-95 cursor-pointer" data-action="add-row" data-table-id="${idx}" title="Insertar nueva fila al final">
              <i data-lucide="plus" class="w-3 h-3 text-emerald-400 pointer-events-none"></i>
              <span class="pointer-events-none">Fila</span>
            </button>
            <button type="button" class="btn-table-action flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-200 hover:text-indigo-300 text-[11px] font-bold border border-slate-700 transition-all active:scale-95 cursor-pointer" data-action="add-col" data-table-id="${idx}" title="Insertar nueva columna a la derecha">
              <i data-lucide="plus" class="w-3 h-3 text-indigo-400 pointer-events-none"></i>
              <span class="pointer-events-none">Columna</span>
            </button>
            <button type="button" class="btn-table-action flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-rose-900/30 text-slate-400 hover:text-rose-300 text-[11px] font-bold border border-slate-700 transition-all active:scale-95 cursor-pointer" data-action="del-row" data-table-id="${idx}" title="Eliminar última fila">
              <i data-lucide="minus" class="w-3 h-3 text-rose-400 pointer-events-none"></i>
              <span class="pointer-events-none">Fila</span>
            </button>
            <button type="button" class="btn-table-action flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-rose-900/30 text-slate-400 hover:text-rose-300 text-[11px] font-bold border border-slate-700 transition-all active:scale-95 cursor-pointer" data-action="del-col" data-table-id="${idx}" title="Eliminar última columna">
              <i data-lucide="minus" class="w-3 h-3 text-rose-400 pointer-events-none"></i>
              <span class="pointer-events-none">Col</span>
            </button>
            <button type="button" class="del-table-btn flex items-center justify-center w-7 h-7 rounded-lg hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer ml-1" data-table-id="${idx}" title="Eliminar tabla completa">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
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
            <button type="button" class="col-del-btn text-rose-400 hover:text-rose-200 px-1 font-bold text-xs cursor-pointer" data-table-id="${idx}" data-col-idx="${cIdx}" title="Eliminar Columna ${letter}">×</button>
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
            <button type="button" class="row-del-btn text-rose-400 hover:text-rose-200 px-1 font-bold text-xs cursor-pointer" data-table-id="${idx}" data-row-idx="${rIdx}" title="Eliminar Fila ${rIdx + 1}">×</button>
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

  handleTableAction(tableIdx: number, action: string, paramIndex?: number, originEl?: HTMLElement): void {
    const tab = this.activeTab;
    if (!tab) return;

    // 1. Intentar leer los datos directamente desde el DOM vivo para no perder ediciones
    const widgetEl = (originEl?.closest('.excel-table-widget') as HTMLElement) ||
      (document.querySelector(`.excel-table-widget[data-table-id="${tableIdx}"]`) as HTMLElement);
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

    // Si la acción es eliminar la tabla completa
    if (action === 'del-table') {
      if (widgetEl) {
        widgetEl.remove();
        this.onRichInput();
        this.showToast('Tabla eliminada', 'trash-2', 'text-rose-400');
        return;
      }
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
      } else {
        // Si sólo queda 1 fila y se solicita eliminar, eliminar toda la tabla
        if (widgetEl) {
          widgetEl.remove();
          this.onRichInput();
          this.showToast('Tabla eliminada', 'trash-2', 'text-rose-400');
          return;
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
      } else {
        // Si sólo queda 1 columna y se solicita eliminar, eliminar toda la tabla
        if (widgetEl) {
          widgetEl.remove();
          this.onRichInput();
          this.showToast('Tabla eliminada', 'trash-2', 'text-rose-400');
          return;
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

    if (event.key === 'Backspace') {
      const isHeader0 = target.getAttribute('data-row') === 'header' && target.getAttribute('data-col') === '0';
      if (isHeader0 && (!target.textContent || target.textContent.trim() === '')) {
        const widget = target.closest('.excel-table-widget') as HTMLElement;
        if (widget) {
          const cells = Array.from(widget.querySelectorAll('.table-editable-cell'));
          const hasAnyText = cells.some(c => (c.textContent || '').trim().length > 0);
          if (!hasAnyText) {
            event.preventDefault();
            const prev = widget.previousElementSibling as HTMLElement;
            widget.remove();
            this.onRichInput();
            if (prev) {
              this.focusNode(prev);
            } else {
              const p = document.createElement('p');
              p.innerHTML = '<br>';
              this.richCanvas?.nativeElement.appendChild(p);
              this.focusNode(p);
            }
            this.showToast('Tabla eliminada', 'trash-2', 'text-rose-400');
            return;
          }
        }
      }
    }

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
            this.handleTableAction(tableId, 'add-row', undefined, tableWrapper);
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

  showToast(msg: string, icon = 'check', color = 'text-emerald-400'): void {
    this.toastRequested.emit({ msg, icon, color });
  }

  onCanvasPaste(event: ClipboardEvent): void {
    const target = event.target as HTMLElement;
    const text = event.clipboardData?.getData('text/plain');
    if (!text) return;

    // 1. Pegar dentro de un bloque de código -> Pegar texto y auto-formatear con sangría IDE
    const codeEl = (target.tagName.toLowerCase() === 'code' ? target : target.closest('code')) as HTMLElement | null;
    if (codeEl) {
      event.preventDefault();
      const codeBlock = codeEl.closest('.code-block-dark') as HTMLElement | null;
      document.execCommand('insertText', false, text);
      if (codeBlock) {
        setTimeout(() => {
          this.formatCodeBlockElement(codeBlock, false);
          this.showToast('Código pegado y auto-formateado', 'wand-2', 'text-indigo-400');
        }, 10);
      } else {
        this.onRichInput();
      }
      return;
    }

    if (
      target &&
      (target.classList.contains('table-editable-cell') ||
        target.closest('.table-editable-cell') ||
        target.classList.contains('task-label-text') ||
        target.classList.contains('code-lang-label') ||
        target.classList.contains('quote-content') ||
        target.closest('.quote-content'))
    ) {
      event.preventDefault();
      document.execCommand('insertText', false, text);
      this.onRichInput();
    }
  }

  onCanvasKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;

    // Resolver el elemento activo real a través de la selección actual
    const sel = window.getSelection();
    let currentEl = target;
    if (sel && sel.rangeCount > 0) {
      const anchor = sel.anchorNode;
      const el = anchor?.nodeType === Node.ELEMENT_NODE ? (anchor as HTMLElement) : anchor?.parentElement;
      if (el && this.richCanvas?.nativeElement.contains(el)) {
        currentEl = el;
      }
    }

    // 1. Manejo de tabulaciones en tabla Excel
    this.onTableKeyDown(event);

    // 2. Manejo de Bloques de Código (VS Code Style)
    const codeEl = currentEl.tagName?.toLowerCase() === 'code' ? currentEl : currentEl.closest('code');
    if (codeEl) {
      const codeBlock = codeEl.closest('.code-block-dark') as HTMLElement;

      // Ctrl + A dentro del bloque de código: Seleccionar únicamente el contenido del bloque
      if ((event.ctrlKey || event.metaKey) && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        event.stopPropagation();
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        this.saveSelection();
        return;
      }

      // Manejo de Backspace y Delete para que el bloque NUNCA quede roto o en blanco
      if (event.key === 'Backspace' || event.key === 'Delete') {
        const sel = window.getSelection();
        // Caso A: Si todo el bloque de código está seleccionado y se presiona Backspace o Delete
        if (sel && !sel.isCollapsed) {
          const selectedText = sel.toString();
          const totalText = codeEl.innerText || codeEl.textContent || '';
          if (selectedText.trim() === totalText.trim() && totalText.trim().length > 0) {
            event.preventDefault();
            codeEl.innerHTML = '<br>';
            this.updateCodeGutter(codeBlock);
            this.focusNode(codeEl);
            this.onRichInput();
            this.saveSelection();
            return;
          }
        }

        // Caso B: Si ya está completamente vacío y presiona Backspace una vez más
        if (event.key === 'Backspace' && (!codeEl.textContent || codeEl.textContent.trim() === '')) {
          event.preventDefault();
          codeBlock?.remove();
          this.onRichInput();
          return;
        }

        // Caso C: Borrado normal, asegurar que el gutter y el <br> se mantengan sincronizados
        setTimeout(() => {
          if (!codeEl.innerHTML || codeEl.innerHTML === '' || codeEl.innerHTML === '<br>') {
            codeEl.innerHTML = '<br>';
          }
          this.updateCodeGutter(codeBlock);
          this.onRichInput();
        }, 0);
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        document.execCommand('insertText', false, '    ');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        this.saveSelection();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        document.execCommand('insertLineBreak');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        this.saveSelection();
        return;
      }
    }

    // 3. Manejo de Viñetas y Listas (Eliminación limpia sin dejar puntos atascados)
    const liEl = currentEl.tagName?.toLowerCase() === 'li' ? currentEl : currentEl.closest('li');
    if (liEl) {
      const isEmpty = !liEl.textContent || liEl.textContent.trim() === '';
      if (event.key === 'Backspace' && isEmpty) {
        event.preventDefault();
        const parentList = liEl.parentElement;
        liEl.remove();
        if (parentList && parentList.children.length === 0) {
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          parentList.replaceWith(p);
          this.focusNode(p);
        }
        this.onRichInput();
        return;
      }
      if (event.key === 'Enter' && isEmpty) {
        event.preventDefault();
        const parentList = liEl.parentElement;
        liEl.remove();
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        if (parentList) {
          parentList.after(p);
          if (parentList.children.length === 0) {
            parentList.remove();
          }
        }
        this.focusNode(p);
        this.onRichInput();
        return;
      }
    }

    // 4. Manejo de items de Checklist
    if (target && target.classList.contains('task-label-text')) {
      const taskItem = target.closest('.checklist-item') as HTMLElement;
      if (!taskItem) return;

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

    // 5. Manejo de Backspace en párrafo vacío después de tabla o widget
    if (event.key === 'Backspace') {
      const p = currentEl.tagName?.toLowerCase() === 'p' ? currentEl : currentEl.closest('p');
      if (p && (!p.textContent || p.textContent.trim() === '')) {
        const prev = p.previousElementSibling as HTMLElement;
        if (prev && prev.classList.contains('excel-table-widget')) {
          event.preventDefault();
          p.remove();
          const lastCell = prev.querySelector('tbody tr:last-child td.table-editable-cell:last-child') as HTMLElement;
          if (lastCell) {
            this.focusNode(lastCell);
          }
          this.onRichInput();
          return;
        }
      }
    }
  }

  onPreviewClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Botón borrar tabla completa
    const delTableBtn = target.closest('.del-table-btn') as HTMLElement;
    if (delTableBtn) {
      event.preventDefault();
      event.stopPropagation();
      const tableWidget = (delTableBtn.closest('.excel-table-widget') as HTMLElement) ||
        (delTableBtn.getAttribute('data-table-id') ? document.querySelector(`.excel-table-widget[data-table-id="${delTableBtn.getAttribute('data-table-id')}"]`) as HTMLElement : null);
      if (tableWidget) {
        tableWidget.remove();
        this.onRichInput();
        this.showToast('Tabla eliminada', 'trash-2', 'text-rose-400');
      }
      return;
    }

    // Botón copiar código al portapapeles
    const copyCodeBtn = target.closest('.copy-codeblock-btn') as HTMLElement;
    if (copyCodeBtn) {
      event.preventDefault();
      event.stopPropagation();
      const codeBlock = copyCodeBtn.closest('.code-block-dark');
      const codeEl = codeBlock?.querySelector('code');
      if (codeEl) {
        const text = codeEl.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
          this.showToast('Código copiado al portapapeles', 'copy', 'text-emerald-400');
        });
      }
      return;
    }

    // Botón formatear bloque de código dinámico (HTML, JSON, SQL, JS, TS, CSS, Python, etc.)
    const formatCodeBtn = target.closest('.format-codeblock-btn') as HTMLElement;
    if (formatCodeBtn) {
      event.preventDefault();
      event.stopPropagation();
      const codeBlock = formatCodeBtn.closest('.code-block-dark') as HTMLElement;
      if (codeBlock) {
        this.formatCodeBlockElement(codeBlock, true);
      }
      return;
    }

    // Botón borrar bloque de código
    const delCodeBtn = target.closest('.del-codeblock-btn') as HTMLElement;
    if (delCodeBtn) {
      event.preventDefault();
      event.stopPropagation();
      const codeBlock = delCodeBtn.closest('.code-block-dark');
      if (codeBlock) {
        codeBlock.remove();
        this.onRichInput();
      }
      return;
    }

    // Botón borrar cita
    const delQuoteBtn = target.closest('.del-quote-btn') as HTMLElement;
    if (delQuoteBtn) {
      event.preventDefault();
      event.stopPropagation();
      const quoteEl = delQuoteBtn.closest('blockquote');
      if (quoteEl) {
        quoteEl.remove();
        this.onRichInput();
      }
      return;
    }

    // Botones de acción general de tabla (+ Fila, + Columna, - Fila, - Columna)
    const actionBtn = target.closest('.btn-table-action') as HTMLElement;
    if (actionBtn) {
      event.preventDefault();
      event.stopPropagation();
      const action = actionBtn.getAttribute('data-action') as string;
      const tableIdStr = actionBtn.getAttribute('data-table-id');
      const tableId = tableIdStr !== null ? parseInt(tableIdStr, 10) : 0;
      if (action) {
        this.handleTableAction(tableId, action, undefined, actionBtn);
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
      this.handleTableAction(tableId, 'del-col', colIdx, delColBtn);
      return;
    }

    // Botón borrar fila individual
    const delRowBtn = target.closest('.row-del-btn') as HTMLElement;
    if (delRowBtn) {
      event.preventDefault();
      event.stopPropagation();
      const tableId = parseInt(delRowBtn.getAttribute('data-table-id') || '0', 10);
      const rowIdx = parseInt(delRowBtn.getAttribute('data-row-idx') || '0', 10);
      this.handleTableAction(tableId, 'del-row', rowIdx, delRowBtn);
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

  formatCodeBlockElement(codeBlock: HTMLElement, notify: boolean = true): void {
    const codeEl = codeBlock.querySelector('code');
    const langSpan = codeBlock.querySelector('.code-lang-label');
    let lang = langSpan?.textContent?.trim().toLowerCase() || '';

    if (!codeEl) return;

    let rawCode = (codeEl.innerText || codeEl.textContent || '').replace(/\r\n/g, '\n');
    rawCode = rawCode
      .replace(/"?text-[a-z]+-\d+[^"]*"*>/g, '')
      .replace(/class="[^"]*">/g, '')
      .replace(/<span[^>]*>/gi, '')
      .replace(/<\/span>/gi, '')
      .trim();

    if (!rawCode) {
      if (notify) this.showToast('El bloque de código está vacío', 'alert-circle', 'text-amber-400');
      return;
    }

    const trimmed = rawCode;

    // A) SI EL LENGUAJE FUE ESPECIFICADO EXPLÍCITAMENTE
    if (lang && lang !== 'código' && lang !== 'codigo') {
      if (lang === 'html' || lang === 'xml') {
        const prettyHtml = this.formatHtmlCode(rawCode);
        codeEl.innerHTML = this.highlightCode(prettyHtml, 'markup');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('HTML formateado con sangría de 4 espacios');
        return;
      }

      if (lang === 'css' || lang === 'scss') {
        const prettyCss = this.formatCssCode(rawCode);
        codeEl.innerHTML = this.highlightCode(prettyCss, 'css');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('CSS formateado con sangría de 4 espacios');
        return;
      }

      if (lang === 'json') {
        try {
          const parsed = JSON.parse(rawCode);
          const pretty = JSON.stringify(parsed, null, 4);
          codeEl.innerHTML = this.highlightCode(pretty, 'json');
          this.updateCodeGutter(codeBlock);
          this.onRichInput();
          if (notify) this.showToast('JSON formateado con sangría de 4 espacios');
          return;
        } catch (e: any) {
          if (notify) this.showToast('JSON Inválido: ' + (e.message || ''));
          return;
        }
      }

      if (['java'].includes(lang)) {
        const prettyJava = this.formatJavaCode(rawCode);
        codeEl.innerHTML = this.highlightCode(prettyJava, 'java');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('Java formateado e indentado');
        return;
      }

      if (['kt', 'kotlin'].includes(lang)) {
        const prettyKt = this.formatKotlinCode(rawCode);
        codeEl.innerHTML = this.highlightCode(prettyKt, 'kotlin');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('Kotlin formateado e indentado');
        return;
      }

      if (['ts', 'typescript'].includes(lang)) {
        const prettyTs = this.formatJsCode(rawCode);
        codeEl.innerHTML = this.highlightCode(prettyTs, 'typescript');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('TypeScript formateado e indentado');
        return;
      }

      if (['js', 'javascript'].includes(lang)) {
        const prettyJs = this.formatJsCode(rawCode);
        codeEl.innerHTML = this.highlightCode(prettyJs, 'javascript');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('JavaScript formateado e indentado');
        return;
      }

      if (lang === 'sql') {
        const prettySql = this.formatSqlCode(rawCode);
        codeEl.innerHTML = this.highlightCode(prettySql, 'sql');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('SQL formateado e indentado');
        return;
      }

      if (['py', 'python'].includes(lang)) {
        const cleanCode = this.formatGenericCode(rawCode);
        codeEl.innerHTML = this.highlightCode(cleanCode, 'python');
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('Python formateado');
        return;
      }
    }

    // B) AUTO-DETECCIÓN INTELIGENTE
    // 1. JSON
    if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && (trimmed.endsWith('}') || trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(rawCode);
        const pretty = JSON.stringify(parsed, null, 4);
        codeEl.innerHTML = this.highlightCode(pretty, 'json');
        if (langSpan) langSpan.textContent = 'json';
        this.updateCodeGutter(codeBlock);
        this.onRichInput();
        if (notify) this.showToast('JSON detectado y formateado');
        return;
      } catch {
        // continuar
      }
    }

    // 2. Kotlin
    if (/\b(fun\s+[a-zA-Z0-9_]+|data\s+class|companion\s+object|val\s+[a-zA-Z0-9_]+)\b/.test(trimmed)) {
      const prettyKt = this.formatKotlinCode(rawCode);
      codeEl.innerHTML = this.highlightCode(prettyKt, 'kotlin');
      if (langSpan) langSpan.textContent = 'kotlin';
      this.updateCodeGutter(codeBlock);
      this.onRichInput();
      if (notify) this.showToast('Kotlin detectado y formateado');
      return;
    }

    // 3. Java
    if (/\b(public\s+class|public\s+static\s+void\s+main|System\.out\.println|import\s+java\.|package\s+[a-z0-9_.]+;)\b/.test(trimmed)) {
      const prettyJava = this.formatJavaCode(rawCode);
      codeEl.innerHTML = this.highlightCode(prettyJava, 'java');
      if (langSpan) langSpan.textContent = 'java';
      this.updateCodeGutter(codeBlock);
      this.onRichInput();
      if (notify) this.showToast('Java detectado y formateado');
      return;
    }

    // 4. TypeScript
    if (/\b(interface\s+[A-Z]|type\s+[A-Z]|:\s*(string|number|boolean|any|void)\b|as\s+const)\b/.test(trimmed)) {
      const prettyTs = this.formatJsCode(rawCode);
      codeEl.innerHTML = this.highlightCode(prettyTs, 'typescript');
      if (langSpan) langSpan.textContent = 'typescript';
      this.updateCodeGutter(codeBlock);
      this.onRichInput();
      if (notify) this.showToast('TypeScript detectado y formateado');
      return;
    }

    // 5. JavaScript
    if (/\b(const\s+[a-zA-Z0-9_]+|let\s+[a-zA-Z0-9_]+|function\s+[a-zA-Z0-9_]+|console\.log|export\s+default)\b/.test(trimmed)) {
      const prettyJs = this.formatJsCode(rawCode);
      codeEl.innerHTML = this.highlightCode(prettyJs, 'javascript');
      if (langSpan) langSpan.textContent = 'javascript';
      this.updateCodeGutter(codeBlock);
      this.onRichInput();
      if (notify) this.showToast('JavaScript detectado y formateado');
      return;
    }

    // 6. SQL
    if (/\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+.+\s+SET|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(trimmed)) {
      const prettySql = this.formatSqlCode(rawCode);
      codeEl.innerHTML = this.highlightCode(prettySql, 'sql');
      if (langSpan) langSpan.textContent = 'sql';
      this.updateCodeGutter(codeBlock);
      this.onRichInput();
      if (notify) this.showToast('SQL detectado y formateado');
      return;
    }

    // 7. CSS
    if (trimmed.includes('{') && /:\s*[^;]+;/i.test(trimmed) && !trimmed.includes('fun ') && !trimmed.includes('class ')) {
      const prettyCss = this.formatCssCode(rawCode);
      codeEl.innerHTML = this.highlightCode(prettyCss, 'css');
      if (langSpan) langSpan.textContent = 'css';
      this.updateCodeGutter(codeBlock);
      this.onRichInput();
      if (notify) this.showToast('CSS detectado y formateado');
      return;
    }

    // 8. HTML / XML (Tags reales de marcado)
    if (/<!DOCTYPE|<html|<head|<body|<div\b|<span\b|<p\b|<table\b|<button\b|<input\b|<form\b|<\/[a-zA-Z0-9_\-]+>/i.test(trimmed)) {
      const prettyHtml = this.formatHtmlCode(rawCode);
      codeEl.innerHTML = this.highlightCode(prettyHtml, 'markup');
      if (langSpan) langSpan.textContent = 'html';
      this.updateCodeGutter(codeBlock);
      this.onRichInput();
      if (notify) this.showToast('HTML detectado y formateado');
      return;
    }

    // 9. Código genérico (Fallback)
    const cleanCode = this.formatGenericCode(rawCode);
    codeEl.innerHTML = this.highlightCode(cleanCode, lang);
    this.updateCodeGutter(codeBlock);
    this.onRichInput();
    if (notify) {
      this.showToast(`Código ${lang && lang !== 'código' ? lang.toUpperCase() : 'general'} normalizado`);
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
        <div class="my-6 rounded-xl code-block-dark border border-[#242938] shadow-2xl overflow-hidden select-text group/codeblock" contenteditable="false">
          <div class="flex items-center justify-between px-3.5 py-2 bg-[#0e1118] border-b border-[#242938] select-none">
            <div class="flex items-center gap-2.5">
              <div class="flex items-center gap-1.5 mr-1">
                <span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80 hover:bg-[#ff5f56] transition-colors" title="Ventana IDE"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80 hover:bg-[#ffbd2e] transition-colors"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80 hover:bg-[#27c93f] transition-colors"></span>
              </div>
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-t bg-[#161922] border-t-2 border-indigo-500 border-x border-[#242938] text-xs font-mono text-slate-200">
                <i data-lucide="file-code" class="w-3.5 h-3.5 text-indigo-400"></i>
                <span contenteditable="true" spellcheck="false" class="code-lang-label outline-none font-bold cursor-text select-text transition-colors" title="Haz clic para editar el lenguaje (ej: html, css, ts, js, java, kotlin, json, sql)">código</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" class="copy-codeblock-btn flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 transition-all cursor-pointer active:scale-95" title="Copiar código al portapapeles">
                <i data-lucide="copy" class="w-3 h-3 text-slate-400 pointer-events-none"></i>
                <span class="pointer-events-none">Copiar</span>
              </button>
              <button type="button" class="format-codeblock-btn flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-100 text-[11px] font-bold border border-indigo-500/40 transition-all cursor-pointer active:scale-95" title="Formatear código con sangría IDE">
                <i data-lucide="wand-2" class="w-3 h-3 text-indigo-400 pointer-events-none"></i>
                <span class="pointer-events-none">Formatear</span>
              </button>
              <button type="button" class="del-codeblock-btn flex items-center justify-center w-7 h-7 rounded-lg hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer" title="Eliminar bloque de código">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
              </button>
            </div>
          </div>
          <div class="flex bg-[#12151e] code-editor-body">
            <div class="code-gutter py-3 pl-3 pr-2 select-none text-right font-mono text-[11px] text-slate-600 border-r border-[#1f2433] bg-[#0c0e14] leading-[22px] min-w-[36px]">
              1
            </div>
            <pre class="p-3 code-font text-xs text-slate-200 select-text leading-[22px] overflow-x-auto custom-scrollbar flex-1 m-0 bg-transparent"><code contenteditable="true" spellcheck="false" class="outline-none block min-h-[44px] whitespace-pre"><br></code></pre>
          </div>
        </div>
        <p class="my-3"><br></p>
      `;
      this.insertHtmlAtCursor(codeHtml);
      this.lucide.refresh();
    } else {
      this.insertMarkdown('```\n', '\n```\n', '// Escribe o pega tu código aquí...');
    }
  }

  insertQuote(): void {
    if (this.mdViewMode === 'rich' && this.richCanvas) {
      const sel = window.getSelection();
      const selectedText = sel?.toString()?.trim();
      const content = selectedText || 'Cita o nota importante';
      const quoteHtml = `
        <blockquote contenteditable="false" class="group/quote relative border-l-4 border-indigo-500 bg-indigo-500/10 px-4 py-2.5 my-4 rounded-r-xl text-slate-300 italic text-xs md:text-sm leading-relaxed shadow-sm select-text">
          <div class="flex items-start justify-between gap-2">
            <div contenteditable="true" spellcheck="false" class="quote-content outline-none flex-1 min-w-0 pr-2">${this.escapeHtml(content)}</div>
            <button type="button" class="del-quote-btn opacity-0 group-hover/quote:opacity-100 flex items-center justify-center w-6 h-6 rounded-md hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-all cursor-pointer shrink-0" title="Eliminar cita">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
            </button>
          </div>
        </blockquote>
        <p class="my-2.5 leading-relaxed text-slate-100"><br></p>
      `;
      this.insertHtmlAtCursor(quoteHtml);
      this.lucide.refresh();
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
    md = md.replace(/Haz clic aqu[íi] para comenzar a escribir tu documento\.{0,3}/gi, '');
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
      const cleanLang = (lang === 'código' || lang === 'codigo') ? '' : lang;
      let code = (codeEl?.innerText || codeEl?.textContent || '').replace(/\r\n/g, '\n');
      code = code
        .replace(/"?text-[a-z]+-\d+[^"]*"*>/g, '')
        .replace(/class="[^"]*">/g, '')
        .replace(/<span[^>]*>/gi, '')
        .replace(/<\/span>/gi, '');
      return `\n\`\`\`${cleanLang}\n${code.trimEnd()}\n\`\`\`\n\n`;
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
      const contentEl = (el.querySelector('.quote-content') || el) as HTMLElement;
      const rawText = this.getInnerMarkdown(contentEl).trim();
      if (!rawText) return '\n\n';
      const lines = rawText.split('\n').map(l => `> ${l.replace(/^>\s*/, '')}`);
      return `\n${lines.join('\n')}\n\n`;
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
    const trimmed = (raw || '').trim();
    if (!trimmed || trimmed === 'Haz clic aquí para comenzar a escribir tu documento...') {
      return '<p><br></p>';
    }

    let text = raw.replace(/\r\n/g, '\n');

    // 1. Extraer bloques de código a tokens seguros
    const codeBlocks: string[] = [];
    text = text.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      const idx = codeBlocks.length;
      const cleanLang = (lang || '').trim().toLowerCase();

      const cleanCode = (code || '')
        .trimEnd()
        .replace(/"?text-[a-z]+-\d+[^"]*"*>/g, '')
        .replace(/class="[^"]*">/g, '')
        .replace(/<span[^>]*>/gi, '')
        .replace(/<\/span>/gi, '');

      let formattedCode = this.highlightCode(cleanCode, cleanLang);
      let dotColor = 'bg-indigo-400';

      if (cleanLang === 'json') dotColor = 'bg-amber-400';
      else if (cleanLang === 'sql') dotColor = 'bg-emerald-400';
      else if (['js', 'javascript', 'ts', 'typescript'].includes(cleanLang)) dotColor = 'bg-sky-400';
      else if (['html', 'xml'].includes(cleanLang) || /<[a-zA-Z0-9_\-]+[\s>]/.test(cleanCode)) dotColor = 'bg-orange-400';
      else if (['css', 'scss'].includes(cleanLang)) dotColor = 'bg-pink-400';
      else if (['py', 'python'].includes(cleanLang)) dotColor = 'bg-blue-400';
      else if (['bash', 'sh', 'shell', 'cmd', 'ps1'].includes(cleanLang)) dotColor = 'bg-purple-400';

      const lineCount = Math.max(cleanCode.split('\n').length, 1);
      const gutterHtml = Array.from({ length: lineCount }, (_, i) => i + 1).join('<br>');

      const vsCodeBlock = `
        <div class="my-6 rounded-xl code-block-dark border border-[#242938] shadow-2xl overflow-hidden select-text group/codeblock" contenteditable="false">
          <div class="flex items-center justify-between px-3.5 py-2 bg-[#0e1118] border-b border-[#242938] select-none">
            <div class="flex items-center gap-2.5">
              <div class="flex items-center gap-1.5 mr-1">
                <span class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80 hover:bg-[#ff5f56] transition-colors" title="Ventana IDE"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80 hover:bg-[#ffbd2e] transition-colors"></span>
                <span class="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80 hover:bg-[#27c93f] transition-colors"></span>
              </div>
              <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-t bg-[#161922] border-t-2 border-indigo-500 border-x border-[#242938] text-xs font-mono text-slate-200">
                <i data-lucide="file-code" class="w-3.5 h-3.5 ${dotColor}"></i>
                <span contenteditable="true" spellcheck="false" class="code-lang-label outline-none font-bold cursor-text select-text transition-colors" title="Haz clic para editar el lenguaje">${this.escapeHtml(cleanLang || 'código')}</span>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" class="copy-codeblock-btn flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 transition-all cursor-pointer active:scale-95" title="Copiar código al portapapeles">
                <i data-lucide="copy" class="w-3 h-3 text-slate-400 pointer-events-none"></i>
                <span class="pointer-events-none">Copiar</span>
              </button>
              <button type="button" class="format-codeblock-btn flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 hover:text-indigo-100 text-[11px] font-bold border border-indigo-500/40 transition-all cursor-pointer active:scale-95" title="Formatear código con sangría IDE">
                <i data-lucide="wand-2" class="w-3 h-3 text-indigo-400 pointer-events-none"></i>
                <span class="pointer-events-none">Formatear</span>
              </button>
              <button type="button" class="del-codeblock-btn flex items-center justify-center w-7 h-7 rounded-lg hover:bg-rose-950/50 text-slate-500 hover:text-rose-400 border border-transparent hover:border-rose-900/40 transition-colors cursor-pointer" title="Eliminar bloque de código">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 pointer-events-none"></i>
              </button>
            </div>
          </div>
          <div class="flex bg-[#12151e] code-editor-body">
            <div class="code-gutter py-3 pl-3 pr-2 select-none text-right font-mono text-[11px] text-slate-600 border-r border-[#1f2433] bg-[#0c0e14] leading-[22px] min-w-[36px]">
              ${gutterHtml}
            </div>
            <pre class="p-3 code-font text-xs text-slate-200 select-text leading-[22px] overflow-x-auto custom-scrollbar flex-1 m-0 bg-transparent"><code contenteditable="true" spellcheck="false" class="outline-none block min-h-[44px] whitespace-pre">${formattedCode}</code></pre>
          </div>
        </div>
      `;
      codeBlocks.push(vsCodeBlock);
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

    // 0. Si el usuario seleccionó texto, NUNCA interferir ni cambiar el foco
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      return;
    }

    // 1. Si el clic fue en un elemento editable, botón, input, o dentro del canvas, no interferir
    if (target.isContentEditable || target.closest('button') || target.closest('input')) {
      return;
    }

    // Si el clic ocurrió dentro de cualquier elemento hijo del canvas, no interferir
    if (canvas.contains(target) && target !== canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();

    // 2. Clic en la parte superior (arriba del primer elemento para poder escribir al inicio)
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

    // 3. Clic EXCLUSIVAMENTE en el espacio vacío del fondo por debajo de la hoja
    if (target.id === 'documentSheetCanvas' || target.classList.contains('document-sheet-canvas')) {
      if (event.clientY > rect.bottom - 40) {
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

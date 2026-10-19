import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  AfterViewInit,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CmdConsoleLog } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

const ANSI_FG_COLORS: Record<number, string> = {
  30: '#64748b', // Black / Slate
  31: '#f87171', // Red
  32: '#34d399', // Green
  33: '#fbbf24', // Yellow
  34: '#60a5fa', // Blue
  35: '#c084fc', // Magenta / Purple
  36: '#22d3ee', // Cyan
  37: '#e2e8f0', // White
  90: '#94a3b8', // Bright Black (Gray)
  91: '#fb7185', // Bright Red (Rose)
  92: '#4ade80', // Bright Green
  93: '#fde047', // Bright Yellow
  94: '#93c5fd', // Bright Blue
  95: '#e879f9', // Bright Magenta
  96: '#67e8f9', // Bright Cyan
  97: '#ffffff'  // Bright White
};

@Component({
  selector: 'app-cmd-console-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cmd-console-drawer.component.html',
  styleUrls: ['./cmd-console-drawer.component.css']
})
export class CmdConsoleDrawerComponent implements OnChanges, AfterViewInit {
  @Input() logs: CmdConsoleLog[] = [];
  @Input() activeLogId: string | null = null;
  @Input() consoleMin = false;
  @Input() consoleMax = false;
  @Input() cleared = false;
  @Input() activeCwd = 'C:\\';

  @Output() toggleConsole = new EventEmitter<void>();
  @Output() toggleConsoleMax = new EventEmitter<void>();
  @Output() clearLogs = new EventEmitter<void>();
  @Output() selectTab = new EventEmitter<string>();
  @Output() closeTab = new EventEmitter<string>();
  @Output() clearTabOutput = new EventEmitter<string>();
  @Output() createNewTab = new EventEmitter<void>();
  @Output() rerunTab = new EventEmitter<string>();
  @Output() stopProcess = new EventEmitter<string>();
  @Output() runManualCommand = new EventEmitter<string>();
  @Output() sendProcessInput = new EventEmitter<{ processId: string; input: string }>();

  manualCmdText = '';
  stdinMap: Record<string, string> = {};
  runningCount = 0;
  activeLog: CmdConsoleLog | null = null;
  activeLogHtml: SafeHtml = '';

  constructor(
    private lucide: LucideIconService,
    private sanitizer: DomSanitizer
  ) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const list = this.logs || [];
    this.runningCount = list.filter(l => l.running).length;
    this.activeLog =
      list.find(l => l.id === this.activeLogId) || (list.length > 0 ? list[list.length - 1] : null);

    if (this.activeLog) {
      const raw =
        this.activeLog.output ||
        (this.activeLog.running ? 'Iniciando proceso en CMD interno...' : '(Sin salida en consola)');
      this.activeLogHtml = this.sanitizer.bypassSecurityTrustHtml(this.colorizeTerminalText(raw));
    } else {
      this.activeLogHtml = '';
    }

    if (changes['consoleMin'] || changes['consoleMax']) {
      this.lucide.refresh();
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private colorizeTerminalText(rawText: string): string {
    if (!rawText) return '';

    const lines = rawText.split(/\r?\n/);
    const coloredLines = lines.map(line => {
      // Si la línea contiene códigos ANSI de color (\x1b[...m), procesarlos directamente
      if (line.includes('\x1b[') || line.includes('\u001b[')) {
        return this.parseAnsiLine(line);
      }

      const escaped = this.escapeHtml(line);
      const trimmed = line.trim();
      if (!trimmed) return escaped;

      // 1. Prompts de ruta (ej: C:\ruta> comando o > entrada)
      if (/^[a-zA-Z]:\\[^>]*>/.test(trimmed) || /^>\s+/.test(trimmed)) {
        return `<span style="color:#818cf8;font-weight:700;">${escaped}</span>`;
      }

      // 2. Separadores o encabezados de scripts .bat (===, ---, ***, [PASO...])
      if (/^([=\-*]{4,}|\[.*\])$/.test(trimmed) || /^(iniciando|compilando|ejecutando|generando|empaquetando)\b/i.test(trimmed)) {
        return `<span style="color:#38bdf8;font-weight:700;">${escaped}</span>`;
      }

      // 3. Líneas de error (español e inglés)
      if (
        /\b(error|errores|failed|failure|fatal|exception|err!|unhandled|denegado)\b/i.test(trimmed) ||
        /(no se reconoce como un comando|el sistema no puede encontrar|no se pudo|fallo al|\^C \[Proceso detenido)/i.test(trimmed)
      ) {
        return `<span style="color:#fb7185;font-weight:600;">${escaped}</span>`;
      }

      // 4. Líneas de advertencia (warnings)
      if (/\b(warn|warning|advertencia|deprecated|cuidado)\b/i.test(trimmed)) {
        return `<span style="color:#fbbf24;">${escaped}</span>`;
      }

      // 5. Líneas de éxito / completado
      if (
        /[✔√]/.test(trimmed) ||
        /\b(success|successful|successfully|completado|exitosamente|archivos copiados|build at:|listo)\b/i.test(trimmed)
      ) {
        return `<span style="color:#34d399;font-weight:600;">${escaped}</span>`;
      }

      // 6. Resaltado inline de URLs y números/tamaños en líneas estándar
      return escaped
        .replace(
          /(https?:\/\/[^\s&<>"']+)/g,
          '<span style="color:#38bdf8;text-decoration:underline;">$1</span>'
        )
        .replace(
          /\b(\d+(?:\.\d+)?\s*(?:kB|MB|GB|ms|s|%))\b/g,
          '<span style="color:#a78bfa;font-weight:600;">$1</span>'
        );
    });

    return coloredLines.join('\n');
  }

  private parseAnsiLine(line: string): string {
    const ansiRegex = /\x1b\[([0-9;]*)m/g;
    let result = '';
    let lastIndex = 0;
    let currentColor: string | null = null;
    let isBold = false;
    let openSpan = false;

    const buildSpan = (): string => {
      if (!currentColor && !isBold) return '';
      const styles: string[] = [];
      if (currentColor) styles.push(`color:${currentColor}`);
      if (isBold) styles.push('font-weight:700');
      return `<span style="${styles.join(';')}">`;
    };

    let match: RegExpExecArray | null;
    while ((match = ansiRegex.exec(line)) !== null) {
      const textChunk = line.slice(lastIndex, match.index);
      if (textChunk) {
        result += this.escapeHtml(textChunk);
      }
      lastIndex = ansiRegex.lastIndex;

      if (openSpan) {
        result += '</span>';
        openSpan = false;
      }

      const codes = (match[1] || '0').split(';').map(c => parseInt(c, 10));
      for (const code of codes) {
        if (code === 0 || isNaN(code)) {
          currentColor = null;
          isBold = false;
        } else if (code === 1) {
          isBold = true;
        } else if (code === 22) {
          isBold = false;
        } else if (code === 39) {
          currentColor = null;
        } else if (ANSI_FG_COLORS[code]) {
          currentColor = ANSI_FG_COLORS[code];
        }
      }

      const spanTag = buildSpan();
      if (spanTag) {
        result += spanTag;
        openSpan = true;
      }
    }

    const remaining = line.slice(lastIndex);
    if (remaining) {
      result += this.escapeHtml(remaining);
    }
    if (openSpan) {
      result += '</span>';
    }
    return result;
  }

  trackByLogId(_index: number, log: CmdConsoleLog): string {
    return log.id;
  }

  onSelectTab(event: Event, logId: string): void {
    event.stopPropagation();
    this.selectTab.emit(logId);
  }

  onCloseTab(event: Event, logId: string): void {
    event.stopPropagation();
    this.closeTab.emit(logId);
  }

  onNewTab(event: Event): void {
    event.stopPropagation();
    this.createNewTab.emit();
  }

  onClearActiveTabOutput(event: Event, logId: string): void {
    event.stopPropagation();
    this.clearTabOutput.emit(logId);
  }

  onRerunTab(event: Event, logId: string): void {
    event.stopPropagation();
    this.rerunTab.emit(logId);
  }

  onClearAll(event: Event): void {
    event.stopPropagation();
    this.clearLogs.emit();
  }

  onToggleMax(event: Event): void {
    event.stopPropagation();
    this.toggleConsoleMax.emit();
  }

  onStopProcess(event: Event, processId?: string): void {
    event.stopPropagation();
    if (processId) {
      this.stopProcess.emit(processId);
    }
  }

  onSubmitManualCommand(): void {
    const trimmed = this.manualCmdText.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === 'cls' || trimmed.toLowerCase() === 'clear') {
      if (this.activeLog) {
        this.clearTabOutput.emit(this.activeLog.id);
      } else {
        this.clearLogs.emit();
      }
      this.manualCmdText = '';
      return;
    }
    this.runManualCommand.emit(trimmed);
    this.manualCmdText = '';
  }

  onSendStdin(processId?: string): void {
    if (!processId) return;
    const text = this.stdinMap[processId] ?? '';
    this.sendProcessInput.emit({ processId, input: text });
    this.stdinMap[processId] = '';
  }
}

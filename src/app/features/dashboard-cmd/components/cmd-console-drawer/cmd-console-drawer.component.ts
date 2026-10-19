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
import { CmdConsoleLog } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

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

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const list = this.logs || [];
    this.runningCount = list.filter(l => l.running).length;
    this.activeLog =
      list.find(l => l.id === this.activeLogId) || (list.length > 0 ? list[list.length - 1] : null);

    if (changes['consoleMin'] || changes['consoleMax']) {
      this.lucide.refresh();
    }
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

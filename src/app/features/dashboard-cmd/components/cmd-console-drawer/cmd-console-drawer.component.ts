import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CmdConsoleLog } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-cmd-console-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cmd-console-drawer.component.html',
  styleUrls: ['./cmd-console-drawer.component.css']
})
export class CmdConsoleDrawerComponent implements OnChanges, AfterViewInit {
  @Input() logs: CmdConsoleLog[] = [];
  @Input() consoleMin = false;
  @Input() cleared = false;

  @Output() toggleConsole = new EventEmitter<void>();
  @Output() clearLogs = new EventEmitter<void>();

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.lucide.refresh();
  }

  onClear(event: Event): void {
    event.stopPropagation();
    this.clearLogs.emit();
  }
}

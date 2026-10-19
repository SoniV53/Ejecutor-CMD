import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CmdCommandItem, CmdScriptVariant } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

@Component({
  selector: 'app-cmd-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cmd-grid.component.html',
  styleUrls: ['./cmd-grid.component.css']
})
export class CmdGridComponent implements OnChanges, AfterViewInit {
  @Input() commands: CmdCommandItem[] = [];
  @Input() explicitCategories: string[] = [];
  @Input() collapsedCategories: Record<string, boolean> = {};
  @Input() viewMode: 'list' | 'card' = 'card';
  @Input() searchTerm = '';

  @Output() toggleCategory = new EventEmitter<string>();
  @Output() editCategory = new EventEmitter<string>();
  @Output() deleteCategory = new EventEmitter<string>();
  @Output() editCommand = new EventEmitter<string>();
  @Output() deleteCommand = new EventEmitter<string>();
  @Output() runCommand = new EventEmitter<{ id: string; selectedScripts: string[] }>();

  selectedIndices: Record<string, Set<number>> = {};

  readonly btnColorMap: Record<string, string> = {
    indigo: 'bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white',
    emerald: 'bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white',
    rose: 'bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white',
    amber: 'bg-amber-600/10 hover:bg-amber-600 text-amber-400 hover:text-white'
  };

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.ensureDefaultSelections();
    this.lucide.refresh();
  }

  private ensureDefaultSelections(): void {
    for (const c of this.commands) {
      if (!this.selectedIndices[c.id]) {
        this.selectedIndices[c.id] = new Set([0]);
      }
    }
  }

  getScripts(cmd: CmdCommandItem): string[] {
    if (cmd.scripts && cmd.scripts.length > 0) {
      return cmd.scripts.map(s => (typeof s === 'string' ? s : (s as CmdScriptVariant).code || ''));
    }
    return [cmd.script || ''];
  }

  get allCategories(): string[] {
    const cats = new Set<string>([
      ...this.commands.map(c => c.category || 'General'),
      ...this.explicitCategories
    ]);
    return Array.from(cats).sort();
  }

  get filteredCommands(): CmdCommandItem[] {
    const search = (this.searchTerm || '').toLowerCase();
    if (!search) return this.commands;
    return this.commands.filter(c => {
      const scriptsStr = this.getScripts(c).join(' ').toLowerCase();
      return (
        c.label.toLowerCase().includes(search) ||
        scriptsStr.includes(search) ||
        (c.category && c.category.toLowerCase().includes(search))
      );
    });
  }

  get visibleCategories(): { name: string; commands: CmdCommandItem[] }[] {
    const isSearching = (this.searchTerm || '').trim().length > 0;
    const filtered = this.filteredCommands;
    const result: { name: string; commands: CmdCommandItem[] }[] = [];

    for (const cat of this.allCategories) {
      const catCommands = filtered.filter(c => (c.category || 'General') === cat);
      if (isSearching && catCommands.length === 0) continue;
      if (catCommands.length === 0 && cat !== 'General' && !this.explicitCategories.includes(cat)) continue;
      result.push({ name: cat, commands: catCommands });
    }
    return result;
  }

  isSelected(cmdId: string, idx: number): boolean {
    if (!this.selectedIndices[cmdId]) {
      this.selectedIndices[cmdId] = new Set([0]);
    }
    return this.selectedIndices[cmdId].has(idx);
  }

  onToggleVariant(cmd: CmdCommandItem, idx: number, event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    if (!this.selectedIndices[cmd.id]) {
      this.selectedIndices[cmd.id] = new Set([0]);
    }
    if (cmd.multiSelect) {
      if (input.checked) {
        this.selectedIndices[cmd.id].add(idx);
      } else {
        this.selectedIndices[cmd.id].delete(idx);
      }
    } else {
      this.selectedIndices[cmd.id] = new Set([idx]);
    }
  }

  onRun(cmd: CmdCommandItem): void {
    const scrs = this.getScripts(cmd);
    let scriptsToRun: string[] = [];
    if (scrs.length > 1) {
      const selected = this.selectedIndices[cmd.id] || new Set([0]);
      scrs.forEach((s, i) => {
        if (selected.has(i)) {
          scriptsToRun.push(s);
        }
      });
      if (!cmd.multiSelect && scriptsToRun.length > 1) {
        scriptsToRun = [scriptsToRun[0]];
      }
    } else {
      scriptsToRun = [scrs[0]];
    }
    this.runCommand.emit({ id: cmd.id, selectedScripts: scriptsToRun });
  }

  onEditCat(event: Event, cat: string): void {
    event.stopPropagation();
    this.editCategory.emit(cat);
  }

  onDeleteCat(event: Event, cat: string): void {
    event.stopPropagation();
    this.deleteCategory.emit(cat);
  }

  getDotColorClass(color: string): string {
    if (color === 'emerald') return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (color === 'rose') return 'bg-rose-500';
    if (color === 'amber') return 'bg-amber-500';
    return 'bg-indigo-500';
  }

  getBtnColorClass(color: string): string {
    return this.btnColorMap[color] || this.btnColorMap['indigo'];
  }
}

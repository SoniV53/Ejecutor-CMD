import { Component, Input, Output, EventEmitter, OnChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CmdCommandItem, CmdScriptVariant } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

export interface VisibleCategoryGroup {
  name: string;
  commands: CmdCommandItem[];
}

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
  @Output() editBatCommand = new EventEmitter<CmdCommandItem>();
  @Output() exportBatCommand = new EventEmitter<CmdCommandItem>();
  @Output() deleteCommand = new EventEmitter<string>();
  @Output() runCommand = new EventEmitter<{ id: string; selectedScripts: string[] }>();

  selectedIndices: Record<string, Set<number>> = {};
  visibleCategories: VisibleCategoryGroup[] = [];
  scriptsByCmdId: Record<string, string[]> = {};

  readonly btnColorMap: Record<string, string> = {
    indigo: 'bg-indigo-500/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/25 hover:border-indigo-500 hover:shadow-md hover:shadow-indigo-500/20',
    emerald: 'bg-emerald-500/15 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/25 hover:border-emerald-500 hover:shadow-md hover:shadow-emerald-500/20',
    rose: 'bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/25 hover:border-rose-500 hover:shadow-md hover:shadow-rose-500/20',
    amber: 'bg-amber-500/15 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/25 hover:border-amber-500 hover:shadow-md hover:shadow-amber-500/20'
  };

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(): void {
    this.ensureDefaultSelections();
    this.rebuildVisibleCategories();
    this.lucide.refresh();
  }

  private ensureDefaultSelections(): void {
    const map: Record<string, string[]> = {};
    for (const c of this.commands) {
      if (!this.selectedIndices[c.id]) {
        this.selectedIndices[c.id] = new Set([0]);
      }
      map[c.id] = this.extractScripts(c);
    }
    this.scriptsByCmdId = map;
  }

  private extractScripts(cmd: CmdCommandItem): string[] {
    if (cmd.scripts && cmd.scripts.length > 0) {
      return cmd.scripts.map(s => (typeof s === 'string' ? s : (s as CmdScriptVariant).code || ''));
    }
    return [cmd.script || ''];
  }

  getScripts(cmd: CmdCommandItem): string[] {
    return this.scriptsByCmdId[cmd.id] || [cmd.script || ''];
  }

  private rebuildVisibleCategories(): void {
    const cats = new Set<string>([
      ...this.commands.map(c => c.category || 'General'),
      ...this.explicitCategories
    ]);
    const allCats = Array.from(cats).sort();

    const search = (this.searchTerm || '').trim().toLowerCase();
    const isSearching = search.length > 0;

    const filtered = !isSearching
      ? this.commands
      : this.commands.filter(c => {
          const scriptsStr = this.getScripts(c).join(' ').toLowerCase();
          const batInfo = (c.batFileName || '') + ' ' + (c.batPath || '');
          const tagsStr = (c.tags || []).join(' ').toLowerCase();
          return (
            c.label.toLowerCase().includes(search) ||
            scriptsStr.includes(search) ||
            batInfo.toLowerCase().includes(search) ||
            tagsStr.includes(search) ||
            (c.category && c.category.toLowerCase().includes(search))
          );
        });

    const result: VisibleCategoryGroup[] = [];
    for (const cat of allCats) {
      const catCommands = filtered.filter(c => (c.category || 'General') === cat);
      if (isSearching && catCommands.length === 0) continue;
      if (catCommands.length === 0 && cat !== 'General' && !this.explicitCategories.includes(cat)) continue;
      result.push({ name: cat, commands: catCommands });
    }
    this.visibleCategories = result;
  }

  trackByCategory(_index: number, item: VisibleCategoryGroup): string {
    return item.name;
  }

  trackByCommand(_index: number, item: CmdCommandItem): string {
    return item.id;
  }

  trackByScriptIndex(index: number): number {
    return index;
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

  onEditCmd(cmd: CmdCommandItem): void {
    if (cmd.isBat) {
      this.editBatCommand.emit(cmd);
    } else {
      this.editCommand.emit(cmd.id);
    }
  }

  onExportBat(e: Event, cmd: CmdCommandItem): void {
    e.stopPropagation();
    this.exportBatCommand.emit(cmd);
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
    } else if (scrs.length === 1) {
      scriptsToRun = [scrs[0]];
    }

    if (scriptsToRun.length === 0) {
      scriptsToRun = [scrs[0] || ''];
    }

    this.runCommand.emit({
      id: cmd.id,
      selectedScripts: scriptsToRun
    });
  }

  getDotColorClass(color?: string): string {
    switch (color) {
      case 'emerald':
        return 'bg-emerald-500 shadow-sm shadow-emerald-500/50';
      case 'rose':
        return 'bg-rose-500 shadow-sm shadow-rose-500/50';
      case 'amber':
        return 'bg-amber-500 shadow-sm shadow-amber-500/50';
      case 'indigo':
      default:
        return 'bg-indigo-500 shadow-sm shadow-indigo-500/50';
    }
  }

  getBtnColorClass(color?: string): string {
    return this.btnColorMap[color || 'indigo'] || this.btnColorMap['indigo'];
  }

  getCardHoverClass(cmd: CmdCommandItem): string {
    if (cmd.isBat) {
      return 'hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5';
    }
    switch (cmd.color) {
      case 'emerald':
        return 'hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/5';
      case 'rose':
        return 'hover:border-rose-500/50 hover:shadow-lg hover:shadow-rose-500/5';
      case 'amber':
        return 'hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5';
      case 'indigo':
      default:
        return 'hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/5';
    }
  }

  getAccentBarClass(cmd: CmdCommandItem): string {
    if (cmd.isBat) return 'bg-emerald-400';
    switch (cmd.color) {
      case 'emerald':
        return 'bg-emerald-400';
      case 'rose':
        return 'bg-rose-400';
      case 'amber':
        return 'bg-amber-400';
      case 'indigo':
      default:
        return 'bg-indigo-500';
    }
  }

  onEditCat(e: Event, cat: string): void {
    e.stopPropagation();
    this.editCategory.emit(cat);
  }

  onDeleteCat(e: Event, cat: string): void {
    e.stopPropagation();
    this.deleteCategory.emit(cat);
  }
}

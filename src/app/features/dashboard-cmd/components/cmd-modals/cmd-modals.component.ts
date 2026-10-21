import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmdCommandItem, CmdProject, CmdScriptVariant } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';
import { ElectronService } from '../../../../core/services/electron.service';
import { ConsoleFlowApiService } from '../../../../core/services/console-flow-api.service';

@Component({
  selector: 'app-cmd-modals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cmd-modals.component.html',
  styleUrls: ['./cmd-modals.component.css']
})
export class CmdModalsComponent implements OnChanges, AfterViewInit {
  @Input() showProjModal = false;
  @Input() editingProject: CmdProject | null = null;

  @Input() showCatModal = false;
  @Input() editingCatName: string | null = null;

  @Input() showCmdModal = false;
  @Input() editingCommand: CmdCommandItem | null = null;

  @Input() allCategories: string[] = [];
  @Input() allAvailableTags: string[] = [];

  @Output() closeProjModal = new EventEmitter<void>();
  @Output() saveProject = new EventEmitter<{ name: string; path: string; tags: string[] }>();

  @Output() closeCatModal = new EventEmitter<void>();
  @Output() saveCategory = new EventEmitter<string>();

  @Output() closeCmdModal = new EventEmitter<void>();
  @Output() saveCommand = new EventEmitter<{
    label: string;
    category: string;
    scripts: string[];
    multiSelect: boolean;
    color: string;
    background: boolean;
    tags: string[];
  }>();

  // Project form
  inProjName = '';
  inProjPath = '';
  inProjTags: string[] = [];
  inProjTagInput = '';

  // Category form
  inCatName = '';

  // Command form
  inCmdLabel = '';
  inCmdCategory = '';
  inCmdScripts: { value: string }[] = [{ value: '' }];
  inCmdMulti = false;
  inCmdBg = false;
  inCmdTags: string[] = [];
  inCmdTagInput = '';
  activeColor = 'indigo';

  showCatSuggestions = false;
  lastFocusedIndex = 0;
  private lastFocusedTextarea: HTMLTextAreaElement | null = null;

  readonly colors = ['indigo', 'emerald', 'rose', 'amber'];

  constructor(
    private lucide: LucideIconService,
    private electronService: ElectronService,
    private api: ConsoleFlowApiService
  ) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showProjModal'] && this.showProjModal) {
      if (this.editingProject) {
        this.inProjName = this.editingProject.name;
        this.inProjPath = this.editingProject.path;
        this.inProjTags = this.editingProject.tags ? [...this.editingProject.tags] : [];
      } else {
        this.inProjName = '';
        this.inProjPath = '';
        this.inProjTags = [];
      }
      this.inProjTagInput = '';
    }

    if (changes['showCatModal'] && this.showCatModal) {
      this.inCatName = this.editingCatName || '';
    }

    if (changes['showCmdModal'] && this.showCmdModal) {
      if (this.editingCommand) {
        this.inCmdLabel = this.editingCommand.label;
        this.inCmdCategory = this.editingCommand.category || 'General';
        this.inCmdMulti = !!this.editingCommand.multiSelect;
        this.inCmdBg = !!this.editingCommand.background;
        this.activeColor = this.editingCommand.color || 'indigo';
        this.inCmdTags = this.editingCommand.tags ? [...this.editingCommand.tags] : [];

        const rawScripts =
          this.editingCommand.scripts && this.editingCommand.scripts.length > 0
            ? this.editingCommand.scripts.map(s => (typeof s === 'string' ? s : (s as CmdScriptVariant).code || ''))
            : [this.editingCommand.script || ''];
        this.inCmdScripts = rawScripts.map(v => ({ value: v }));
      } else {
        this.inCmdLabel = '';
        this.inCmdCategory = '';
        this.inCmdScripts = [{ value: '' }];
        this.inCmdMulti = false;
        this.inCmdBg = false;
        this.activeColor = 'indigo';
        this.inCmdTags = [];
      }
      this.inCmdTagInput = '';
      this.lastFocusedIndex = 0;
      this.lastFocusedTextarea = null;
      this.showCatSuggestions = false;
    }

    this.lucide.refresh();
  }

  async onBrowseProjectDir(fallbackInput?: HTMLInputElement): Promise<void> {
    // 1. Intentar con Electron si está disponible
    if (this.electronService.isElectron) {
      const selected = await this.electronService.selectDirectory(this.inProjPath);
      if (selected) {
        this.inProjPath = selected;
        if (!this.inProjName) {
          const parts = selected.replace(/\\/g, '/').split('/').filter(Boolean);
          this.inProjName = parts[parts.length - 1] || 'Proyecto';
        }
        return;
      }
    }

    // 2. Si no es Electron o falló, intentar con el diálogo de Windows del backend
    try {
      const res = await this.api.selectDirectoryDialog();
      if (res && res.selectedPath) {
        this.inProjPath = res.selectedPath;
        if (!this.inProjName) {
          const parts = res.selectedPath.replace(/\\/g, '/').split('/').filter(Boolean);
          this.inProjName = parts[parts.length - 1] || 'Proyecto';
        }
        return;
      }
    } catch {}

    // 3. Fallback: input HTML webkitdirectory
    if (fallbackInput) {
      fallbackInput.click();
    }
  }

  handleDirSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0] as any;
      let folderPath = '';
      const folderName = (file.webkitRelativePath || '').split('/')[0] || file.name;

      if (file.path) {
        const normalized = file.path.replace(/\\/g, '/');
        const rel = (file.webkitRelativePath || '').replace(/\\/g, '/');
        if (rel && normalized.endsWith(rel)) {
          const baseIndex = normalized.length - rel.length;
          folderPath = (normalized.substring(0, baseIndex) + folderName).replace(/\//g, '\\');
        } else {
          const lastSlash = normalized.lastIndexOf('/');
          folderPath = (lastSlash !== -1 ? normalized.substring(0, lastSlash) : normalized).replace(/\//g, '\\');
        }
      }

      if (folderPath) {
        this.inProjPath = folderPath;
      }
      if (!this.inProjName && folderName) {
        this.inProjName = folderName;
      }
    }
  }

  addProjTag(tagToAdd?: string): void {
    const raw = tagToAdd !== undefined ? tagToAdd : this.inProjTagInput;
    if (!raw) return;
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (!this.inProjTags.some(t => t.toLowerCase() === part.toLowerCase())) {
        this.inProjTags.push(part);
      }
    }
    this.inProjTagInput = '';
    this.lucide.refresh();
  }

  removeProjTag(idx: number): void {
    this.inProjTags.splice(idx, 1);
    this.lucide.refresh();
  }

  addCmdTag(tagToAdd?: string): void {
    const raw = tagToAdd !== undefined ? tagToAdd : this.inCmdTagInput;
    if (!raw) return;
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (!this.inCmdTags.some(t => t.toLowerCase() === part.toLowerCase())) {
        this.inCmdTags.push(part);
      }
    }
    this.inCmdTagInput = '';
    this.lucide.refresh();
  }

  removeCmdTag(idx: number): void {
    this.inCmdTags.splice(idx, 1);
    this.lucide.refresh();
  }

  onSaveProject(): void {
    if (this.inProjTagInput.trim()) {
      this.addProjTag();
    }
    const name = this.inProjName.trim();
    const path = this.inProjPath.trim();
    if (name && path) {
      this.saveProject.emit({ name, path, tags: [...this.inProjTags] });
    }
  }

  onSaveCategory(): void {
    const name = this.inCatName.trim();
    if (name) {
      this.saveCategory.emit(name);
    }
  }

  get filteredCategories(): string[] {
    const val = (this.inCmdCategory || '').toLowerCase();
    const list = [...this.allCategories];
    if (!list.includes('General')) list.unshift('General');
    return list.filter(c => c.toLowerCase().includes(val));
  }

  selectCategory(cat: string): void {
    this.inCmdCategory = cat;
    this.showCatSuggestions = false;
  }

  addScriptVariant(): void {
    this.inCmdScripts.push({ value: '' });
    this.lastFocusedIndex = this.inCmdScripts.length - 1;
    this.lucide.refresh();
  }

  removeScriptVariant(idx: number): void {
    if (this.inCmdScripts.length > 1) {
      this.inCmdScripts.splice(idx, 1);
      if (this.lastFocusedIndex >= this.inCmdScripts.length) {
        this.lastFocusedIndex = this.inCmdScripts.length - 1;
      }
      this.lucide.refresh();
    }
  }

  onFocusScript(idx: number, event: FocusEvent): void {
    this.lastFocusedIndex = idx;
    this.lastFocusedTextarea = event.target as HTMLTextAreaElement;
  }

  insertMacro(text: string): void {
    const idx =
      this.lastFocusedIndex >= 0 && this.lastFocusedIndex < this.inCmdScripts.length
        ? this.lastFocusedIndex
        : this.inCmdScripts.length - 1;

    if (idx < 0) return;

    const currentVal = this.inCmdScripts[idx].value || '';
    if (this.lastFocusedTextarea && document.body.contains(this.lastFocusedTextarea)) {
      const startPos = this.lastFocusedTextarea.selectionStart || 0;
      const endPos = this.lastFocusedTextarea.selectionEnd || 0;
      const newVal = currentVal.substring(0, startPos) + text + currentVal.substring(endPos);
      this.inCmdScripts[idx].value = newVal;
      setTimeout(() => {
        if (this.lastFocusedTextarea) {
          this.lastFocusedTextarea.focus();
          this.lastFocusedTextarea.selectionStart = this.lastFocusedTextarea.selectionEnd = startPos + text.length;
        }
      }, 0);
    } else {
      this.inCmdScripts[idx].value = currentVal + text;
    }
  }

  setColor(c: string): void {
    this.activeColor = c;
  }

  onSaveCommand(): void {
    if (this.inCmdTagInput.trim()) {
      this.addCmdTag();
    }
    const label = this.inCmdLabel.trim();
    const scriptsArray = this.inCmdScripts.map(s => s.value.trim()).filter(v => v.length > 0);
    const category = this.inCmdCategory.trim() || 'General';

    if (label && scriptsArray.length > 0) {
      this.saveCommand.emit({
        label,
        category,
        scripts: scriptsArray,
        multiSelect: this.inCmdMulti,
        color: this.activeColor,
        background: this.inCmdBg,
        tags: [...this.inCmdTags]
      });
    }
  }
}

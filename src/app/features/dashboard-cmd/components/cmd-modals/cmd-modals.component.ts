import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmdCommandItem, CmdProject, CmdScriptVariant } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';

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

  @Output() closeProjModal = new EventEmitter<void>();
  @Output() saveProject = new EventEmitter<{ name: string; path: string }>();

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
  }>();

  // Project form
  inProjName = '';
  inProjPath = '';

  // Category form
  inCatName = '';

  // Command form
  inCmdLabel = '';
  inCmdCategory = '';
  inCmdScripts: { value: string }[] = [{ value: '' }];
  inCmdMulti = false;
  inCmdBg = false;
  activeColor = 'indigo';

  showCatSuggestions = false;
  lastFocusedIndex = 0;
  private lastFocusedTextarea: HTMLTextAreaElement | null = null;

  readonly colors = ['indigo', 'emerald', 'rose', 'amber'];

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showProjModal'] && this.showProjModal) {
      if (this.editingProject) {
        this.inProjName = this.editingProject.name;
        this.inProjPath = this.editingProject.path;
      } else {
        this.inProjName = '';
        this.inProjPath = '';
      }
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
      }
      this.lastFocusedIndex = 0;
      this.lastFocusedTextarea = null;
      this.showCatSuggestions = false;
    }

    this.lucide.refresh();
  }

  handleDirSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0] as any;
      const folderName = (file.webkitRelativePath || '').split('/')[0] || file.name;
      this.inProjName = folderName;
      this.inProjPath = `C:\\...\\${folderName}`;
    }
  }

  onSaveProject(): void {
    const name = this.inProjName.trim();
    const path = this.inProjPath.trim();
    if (name && path) {
      this.saveProject.emit({ name, path });
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
        background: this.inCmdBg
      });
    }
  }
}

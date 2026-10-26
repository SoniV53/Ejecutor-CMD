import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmdCommandItem, CmdProject } from '../../models/cmd.models';
import { LucideIconService } from '../../../../core/services/lucide-icon.service';
import { ConsoleFlowApiService } from '../../../../core/services/console-flow-api.service';
import { ElectronService } from '../../../../core/services/electron.service';

export interface SaveBatPayload {
  id?: string;
  label: string;
  category: string;
  color: string;
  background: boolean;
  projectId: string | null;
  fileName: string;
  dirPath: string;
  content: string;
  tags?: string[];
  profiles?: string[];
  runImmediately?: boolean;
}

@Component({
  selector: 'app-cmd-bat-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cmd-bat-modal.component.html',
  styleUrls: ['./cmd-bat-modal.component.css']
})
export class CmdBatModalComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() showBatModal = false;
  @Input() editingCommand: CmdCommandItem | null = null;
  @Input() projects: CmdProject[] = [];
  @Input() activeProject: CmdProject | null = null;
  @Input() allCategories: string[] = [];
  @Input() allAvailableTags: string[] = [];
  @Input() allProfiles: string[] = [];

  @Output() closeBatModal = new EventEmitter<void>();
  @Output() saveBat = new EventEmitter<SaveBatPayload>();

  @ViewChild('batCodeTextarea') batCodeTextarea?: ElementRef<HTMLTextAreaElement>;

  // Form fields
  inBatLabel = '';
  inBatCategory = '';
  inBatFileName = '';
  inBatDirPath = '';
  inBatContent = '';
  inBatProjectId: string | null = null;
  inBatBg = false;
  inBatTags: string[] = [];
  inBatTagInput = '';
  inBatProfiles: string[] = [];
  inBatProfileInput = '';
  activeColor = 'emerald';
  appBatDir = '';

  showCatSuggestions = false;

  readonly colors = ['emerald', 'indigo', 'rose', 'amber'];

  readonly defaultTemplate = `@echo off
set DB_PASSWORD=admin
set DB_URL=jdbc:postgresql://localhost:5433/proyectoanalisis?currentSchema=ProyectoAnalisis
set DB_USER=postgres
set JWT_EXP=3600000
set JWT_SECRET=test
set PORT=8080

mvnw spring-boot:run
`;

  constructor(
    private lucide: LucideIconService,
    private api: ConsoleFlowApiService,
    private electronService: ElectronService
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      const info = await this.api.getBatInfo();
      this.appBatDir = info.batDir;
    } catch {}
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  get currentProject(): CmdProject | null {
    if (this.activeProject) return this.activeProject;
    if (this.inBatProjectId) {
      return this.projects.find(p => p.id === this.inBatProjectId) || null;
    }
    return null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showBatModal'] && this.showBatModal) {
      const selectedSidebarProj = this.activeProject;

      if (this.editingCommand && this.editingCommand.isBat) {
        this.inBatLabel = this.editingCommand.label;
        this.inBatCategory = this.editingCommand.category || 'General';
        this.inBatFileName = this.editingCommand.batFileName || 'run.bat';
        const targetProj = selectedSidebarProj || this.projects.find(p => p.id === this.editingCommand?.projectId);
        this.inBatProjectId = targetProj ? targetProj.id : null;
        this.inBatDirPath = this.editingCommand.batPath || this.appBatDir || 'bat';
        this.inBatContent = this.editingCommand.batContent || '';
        this.inBatBg = !!this.editingCommand.background;
        this.activeColor = this.editingCommand.color || 'emerald';
        this.inBatTags = this.editingCommand.tags ? [...this.editingCommand.tags] : [];
        this.inBatProfiles = this.editingCommand.profiles ? [...this.editingCommand.profiles] : [];
      } else {
        // Modo Nuevo Archivo .bat:
        // Guarda en la carpeta "bat" de la app (igual que json) y se ejecuta con el proyecto del menú lateral
        this.inBatProjectId = selectedSidebarProj ? selectedSidebarProj.id : null;
        this.inBatDirPath = this.appBatDir || 'bat';
        this.inBatFileName = 'iniciar_servidor.bat';
        this.inBatLabel = selectedSidebarProj ? `${selectedSidebarProj.name} (.bat)` : 'Iniciar Servidor (.bat)';
        this.inBatCategory = 'General';
        this.inBatContent = this.defaultTemplate;
        this.inBatBg = false;
        this.activeColor = 'emerald';
        this.inBatTags = selectedSidebarProj?.tags ? [...selectedSidebarProj.tags] : [];
        this.inBatProfiles = [];
      }
      this.inBatTagInput = '';
      this.inBatProfileInput = '';
      this.lucide.refresh();
    }
  }

  async onBrowseDir(fallbackInput?: HTMLInputElement): Promise<void> {
    if (this.electronService.isElectron) {
      const selected = await this.electronService.selectDirectory(this.inBatDirPath);
      if (selected) {
        this.inBatDirPath = selected;
        return;
      }
    }
    try {
      const res = await this.api.selectDirectoryDialog();
      if (res && res.selectedPath) {
        this.inBatDirPath = res.selectedPath;
        return;
      }
    } catch {}
    if (fallbackInput) {
      fallbackInput.click();
    }
  }

  handleDirSelect(event: any): void {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
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
        this.inBatDirPath = folderPath;
      }
    }
  }

  handleExistingBatFileSelect(event: any): void {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    this.inBatFileName = file.name;

    if (!this.inBatLabel || this.inBatLabel === 'Iniciar Servidor (.bat)') {
      this.inBatLabel = file.name.replace(/\.(bat|cmd)$/i, '');
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.inBatContent = e.target.result || '';
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  exportCurrentBat(): void {
    let clean = (this.inBatFileName || 'script').trim();
    if (!clean.toLowerCase().endsWith('.bat') && !clean.toLowerCase().endsWith('.cmd')) {
      clean += '.bat';
    }
    this.api.downloadBatFile(clean, this.inBatContent);
  }

  insertSnippet(text: string): void {
    const textarea = this.batCodeTextarea?.nativeElement;
    if (!textarea) {
      this.inBatContent += text;
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = this.inBatContent;
    this.inBatContent = current.substring(0, start) + text + current.substring(end);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }

  loadSpringBootExample(): void {
    this.inBatContent = this.defaultTemplate;
    if (!this.inBatLabel || this.inBatLabel === 'Iniciar Servidor (.bat)') {
      this.inBatLabel = 'Spring Boot Run';
    }
    if (!this.inBatFileName) {
      this.inBatFileName = 'spring-boot.bat';
    }
  }

  get filteredCategories(): string[] {
    const term = (this.inBatCategory || '').trim().toLowerCase();
    if (!term) return this.allCategories;
    return this.allCategories.filter(c => c.toLowerCase().includes(term));
  }

  selectCategory(cat: string): void {
    this.inBatCategory = cat;
    this.showCatSuggestions = false;
  }

  setColor(c: string): void {
    this.activeColor = c;
  }

  addBatTag(tagToAdd?: string): void {
    const raw = tagToAdd !== undefined ? tagToAdd : this.inBatTagInput;
    if (!raw) return;
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (!this.inBatTags.some(t => t.toLowerCase() === part.toLowerCase())) {
        this.inBatTags.push(part);
      }
    }
    this.inBatTagInput = '';
    this.lucide.refresh();
  }

  removeBatTag(idx: number): void {
    this.inBatTags.splice(idx, 1);
    this.lucide.refresh();
  }

  toggleBatProfile(profile: string): void {
    const idx = this.inBatProfiles.indexOf(profile);
    if (idx !== -1) {
      this.inBatProfiles.splice(idx, 1);
    } else {
      this.inBatProfiles.push(profile);
    }
    this.lucide.refresh();
  }

  addBatProfile(profileToAdd?: string): void {
    const raw = (profileToAdd !== undefined ? profileToAdd : this.inBatProfileInput).trim();
    if (!raw) return;
    if (!this.inBatProfiles.includes(raw)) {
      this.inBatProfiles.push(raw);
    }
    if (!this.allProfiles.includes(raw)) {
      this.allProfiles.push(raw);
    }
    this.inBatProfileInput = '';
    this.lucide.refresh();
  }

  removeBatProfile(idx: number): void {
    this.inBatProfiles.splice(idx, 1);
    this.lucide.refresh();
  }

  onSave(runImmediately = false): void {
    if (this.inBatTagInput.trim()) {
      this.addBatTag();
    }
    if (this.inBatProfileInput.trim()) {
      this.addBatProfile();
    }
    let cleanFileName = (this.inBatFileName || '').trim();
    if (!cleanFileName) {
      cleanFileName = 'ejecutar.bat';
    }
    if (!cleanFileName.toLowerCase().endsWith('.bat') && !cleanFileName.toLowerCase().endsWith('.cmd')) {
      cleanFileName += '.bat';
    }

    const cleanLabel = (this.inBatLabel || '').trim() || cleanFileName;
    const cleanCategory = (this.inBatCategory || '').trim() || 'General';
    const cleanDir = (this.inBatDirPath || '').trim() || this.appBatDir || 'bat';

    this.saveBat.emit({
      id: this.editingCommand ? this.editingCommand.id : undefined,
      label: cleanLabel,
      category: cleanCategory,
      color: this.activeColor,
      background: this.inBatBg,
      projectId: this.currentProject ? this.currentProject.id : null,
      fileName: cleanFileName,
      dirPath: cleanDir,
      content: this.inBatContent,
      tags: [...this.inBatTags],
      profiles: [...this.inBatProfiles],
      runImmediately
    });
  }
}

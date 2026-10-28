import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { DocApiService, DocExplorerItem } from '../../core/services/doc-api.service';
import { GoogleDriveService } from '../../core/services/google-drive.service';
import { ElectronService } from '../../core/services/electron.service';
import * as ExcelJS from 'exceljs';
import {
  BranchFolderLink,
  BranchLifecycleState,
  ExcelDesignConfig,
  ExcelDesignPreset,
  GravityLeadWorkspace,
  ReleaseBlockRecord,
  ReleaseEmailContact,
  SubBranchContext,
  TrackedBranch
} from './models/gravity-lead.models';

declare const jspdf: any;
declare const XLSX: any;

const STORAGE_KEY = 'consoleflow_gravity_lead_v1';
const ACTIVE_PROFILE_KEY = 'gravityActiveProfileFile';
const EMAIL_CONTACTS_KEY = 'gravity_release_email_contacts';
const EMAIL_LAST_BUILD_FOLDER_KEY = 'gravity_last_build_folder';
const EXCEL_DESIGN_KEY = 'gravity_excel_design_config';

@Component({
  selector: 'app-gravity-lead',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gravity-lead.component.html',
  styleUrls: ['./gravity-lead.component.css']
})
export class GravityLeadComponent implements OnInit, AfterViewInit {
  // Vista activa: 'branches' (Módulo 1 y 2), 'versions' (Diccionario QA), 'blocks' (Módulo 3 Release Blocks)
  activeSection: 'branches' | 'versions' | 'blocks' = 'branches';

  // Estado limpio sin datos precargados
  branches: TrackedBranch[] = [];
  releaseBlocks: ReleaseBlockRecord[] = [];

  // Catálogo global de tags de Desarrolladores y Flujos para asignar con un solo clic
  availableDevs: string[] = [];
  availableFlows: string[] = [];

  // Selección activa
  selectedBranchId: string | null = null;

  // Búsqueda rápida (ramas, flujos o versión QA ej. 6.10.13)
  searchQuery = '';
  stateFilter: 'ALL' | BranchLifecycleState = 'ALL';
  categoryFilter = 'ALL';
  collapsedCategories = new Set<string>();

  // Creación rápida de Categoría (Módulo / Flujo) separada para barra lateral y detalle
  showAddCategorySidebar = false;
  sidebarCategoryInput = '';
  showAddCategoryInput = false;
  categoryInput = '';

  // Modal Nueva Rama
  showNewBranchModal = false;
  newBranchName = '';
  newBranchFlow = '';
  newBranchTitle = '';
  newBranchState: BranchLifecycleState = 'En desarrollo';
  newBranchVersionInput = '';
  newBranchSelectedDevs: string[] = [];
  newBranchCustomDevInput = '';
  newBranchLinkedBranchIds: string[] = [];

  // Inputs auxiliares en el detalle de la rama seleccionada
  versionInput = '';
  devInput = '';
  showAddDevInput = false;
  subBranchNameInput = '';
  subBranchDevInput = '';
  subBranchNotesInput = '';
  showPullExistingBranchSelector = false;
  pullBranchSearchQuery = '';
  editingSubBranchId: string | null = null;
  editSubBranchName = '';
  editSubBranchDev = '';
  editSubBranchNotes = '';

  // Gestión de Direcciones / Enlaces de Carpetas de Compilados por Rama (Drive, Nube, Red)
  branchFolderUrlInput = '';
  branchFolderLabelInput = '';
  showAddFolderLinkInput = false;

  // Sincronización de Excel con Google Drive
  driveExcelSyncing = false;
  driveExcelImporting = false;
  localExcelImporting = false;
  driveExcelLastSyncTime: number | null = null;
  driveExcelFileId: string | null = null;
  driveExcelWebViewLink: string | null = null;
  autoSyncExcelToDrive = localStorage.getItem('gravity_auto_sync_excel') === 'true';
  showDriveExcelModal = false;
  showToolsMenu = false;
  customExcelFileName = '';
  private driveExcelDebounceTimer: any = null;

  // Resultado del MR generado en vista individual
  generatedSingleMr = '';

  // Módulo 3: Release Blocks (Consolidación de Ramas)
  selectedBlockBranchIds = new Set<string>();
  blockModuleFlow = '';
  blockFeatureTitle = '';
  generatedBlockMr = '';

  // Toast minimalista
  toastVisible = false;
  toastMsg = '';
  private toastTimer: any;
  copiedKey: string | null = null;
  private copiedTimer: any;

  // Notificación interactiva de descarga completada (clic para abrir carpeta)
  downloadNotificationVisible = false;
  downloadFileName = '';
  downloadFilePath = '';
  private downloadTimer: any;

  // Modal de configuración de secciones antes de generar el PDF
  showPdfConfigModal = false;
  pdfTargetBranch: TrackedBranch | null = null;
  pdfCustomHeaderTitle = '';
  pdfOptions = {
    includeHeader: true,
    includeTechSheet: true,
    fieldBranch: true,
    fieldCategory: true,
    fieldFeature: true,
    fieldState: true,
    fieldQaVersions: true,
    fieldDevs: true,
    fieldUpdatedAt: true,
    includeObjectives: true,
    includeSubBranches: true,
    includeMrPreview: true
  };
  pdfSelectableObjectives: { text: string; selected: boolean }[] = [];
  pdfSelectableSubBranches: { sub: SubBranchContext; selected: boolean }[] = [];

  readonly lifecycleStates: BranchLifecycleState[] = ['En desarrollo', 'QA', 'Certificada'];
  readonly BASE_FOLDER = 'json/gravity';
  appBaseDir = '';

  // Gestión de Perfiles en disco (json/gravity/*.json)
  activeProfileFile = localStorage.getItem(ACTIVE_PROFILE_KEY) || 'gravity_default.json';
  profileFiles: DocExplorerItem[] = [];
  showProfileModal = false;
  newProfileInput = '';

  // Subida / Importación selectiva de archivos desde una carpeta (elegir cuál subir y cuál no)
  folderCandidates: Array<{
    name: string;
    relativePath: string;
    content: string;
    selected: boolean;
    source: 'disk' | 'external';
  }> = [];
  isUploadingFolderFiles = false;

  // Modal Generador de Plantilla de Correo de Liberación
  showEmailTemplateModal = false;
  emailGreetingTime: 'tardes' | 'dias' | 'noches' = 'tardes';
  emailCustomGreeting = '';
  emailVersion = '';
  emailBranchVersions: string[] = [];
  emailPlatforms = 'IOS y Android';
  emailContent = '';
  emailBuildFolder = '';
  emailSubject = '';
  emailTargetBranch: TrackedBranch | null = null;
  emailModalTab: 'preview' | 'contacts' = 'preview';

  // Apartado de Destinatarios Guardados (Para / CC)
  savedEmailContacts: ReleaseEmailContact[] = [];
  newContactEmail = '';
  newContactName = '';
  newContactType: 'to' | 'cc' = 'to';

  // --- CONFIGURACIÓN DE DISEÑO PERSONALIZADO DE EXCEL (exceljs) ---
  showExcelDesignModal = false;

  excelDesign: ExcelDesignConfig = {
    presetId: 'indigo',
    titleBgColor: '#1e1b4b',
    titleTextColor: '#ffffff',
    tableTheme: 'TableStyleMedium9'
  };

  readonly excelDesignPresets: ExcelDesignPreset[] = [
    {
      id: 'indigo',
      name: 'Indigo Tech',
      titleBgColor: '#1e1b4b',
      titleTextColor: '#ffffff',
      tableTheme: 'TableStyleMedium9',
      headerBgPreview: '#4338ca'
    },
    {
      id: 'blue',
      name: 'Azul Corporativo',
      titleBgColor: '#0f172a',
      titleTextColor: '#ffffff',
      tableTheme: 'TableStyleMedium2',
      headerBgPreview: '#1d4ed8'
    },
    {
      id: 'emerald',
      name: 'Verde Esmeralda',
      titleBgColor: '#064e3b',
      titleTextColor: '#ffffff',
      tableTheme: 'TableStyleMedium10',
      headerBgPreview: '#047857'
    },
    {
      id: 'purple',
      name: 'Púrpura Royal',
      titleBgColor: '#3b0764',
      titleTextColor: '#ffffff',
      tableTheme: 'TableStyleMedium12',
      headerBgPreview: '#7c3aed'
    },
    {
      id: 'amber',
      name: 'Ámbar Ejecutivo',
      titleBgColor: '#451a03',
      titleTextColor: '#ffffff',
      tableTheme: 'TableStyleMedium3',
      headerBgPreview: '#b45309'
    },
    {
      id: 'slate',
      name: 'Grafito Minimal',
      titleBgColor: '#020617',
      titleTextColor: '#38bdf8',
      tableTheme: 'TableStyleMedium1',
      headerBgPreview: '#334155'
    },
    {
      id: 'rose',
      name: 'Rubí / Vino',
      titleBgColor: '#4c0519',
      titleTextColor: '#ffffff',
      tableTheme: 'TableStyleMedium4',
      headerBgPreview: '#be123c'
    },
    {
      id: 'custom',
      name: 'Personalizado',
      titleBgColor: '#1e1b4b',
      titleTextColor: '#ffffff',
      tableTheme: 'TableStyleMedium9',
      headerBgPreview: '#6366f1'
    }
  ];

  readonly excelTableThemes = [
    { id: 'TableStyleMedium9', name: 'Azul Marino / Indigo (Zebra clásica)' },
    { id: 'TableStyleMedium2', name: 'Azul Clásico Ejecutivo' },
    { id: 'TableStyleMedium10', name: 'Verde Esmeralda / QA Pass' },
    { id: 'TableStyleMedium12', name: 'Púrpura / Violeta Intenso' },
    { id: 'TableStyleMedium3', name: 'Ámbar / Naranja Dinámico' },
    { id: 'TableStyleMedium4', name: 'Rojo Vino / Coral' },
    { id: 'TableStyleMedium1', name: 'Gris Carbón / Slate' },
    { id: 'TableStyleMedium5', name: 'Celeste Suave' },
    { id: 'TableStyleLight1', name: 'Minimalista Claro (Bordes sutiles)' },
    { id: 'TableStyleLight9', name: 'Líneas Azules Sutiles' },
    { id: 'TableStyleDark2', name: 'Contraste Alto Azul' },
    { id: 'TableStyleDark10', name: 'Contraste Alto Verde' }
  ];

  constructor(
    private lucide: LucideIconService,
    private docApi: DocApiService,
    public googleDrive: GoogleDriveService,
    private electronService: ElectronService
  ) {}

  ngOnInit(): void {
    this.loadSavedEmailContacts();
    this.loadDriveExcelMetadataForActiveProfile();
    this.loadExcelDesign();
    this.initProfilesAndWorkspace();
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  // --- GESTIÓN DE PERFILES Y CARPETA FÍSICA (json/gravity/) ---

  get activeProfileDisplayName(): string {
    const raw = (this.activeProfileFile || 'default.json').replace(/\.json$/i, '');
    return raw.replace(/^gravity[_-]/i, '') || raw;
  }

  private async ensureAppBaseDir(): Promise<string> {
    if (this.appBaseDir) return this.appBaseDir;
    try {
      const info = await this.docApi.getDocInfo();
      this.appBaseDir = info.baseDir || '';
    } catch {}
    return this.appBaseDir;
  }

  async initProfilesAndWorkspace(): Promise<void> {
    // 1. Primero consultar SIEMPRE los archivos reales en disco (json/gravity/) sin sobrescribirlos con localStorage
    try {
      const rootDir = await this.ensureAppBaseDir();
      const items = await this.docApi.listDocs(this.BASE_FOLDER, rootDir);
      this.profileFiles = items.filter(i => !i.isFolder && i.name.toLowerCase().endsWith('.json'));

      const matchedActive = this.profileFiles.find(
        f => f.name.toLowerCase() === this.activeProfileFile.toLowerCase()
      );

      if (matchedActive) {
        this.activeProfileFile = matchedActive.name;
        await this.loadProfileFromDisk(this.activeProfileFile, false);
      } else if (this.profileFiles.length > 0) {
        // Si existe otro archivo .json en la carpeta json/gravity/, cargarlo desde disco sin borrarlo
        this.activeProfileFile = this.profileFiles[0].name;
        localStorage.setItem(ACTIVE_PROFILE_KEY, this.activeProfileFile);
        await this.loadProfileFromDisk(this.activeProfileFile, false);
      } else {
        // Solo si la carpeta json/gravity/ está completamente vacía, migrar desde localStorage
        this.loadWorkspaceFromRaw(localStorage.getItem(STORAGE_KEY));
        await this.persistActiveProfileToDisk();
        const refreshed = await this.docApi.listDocs(this.BASE_FOLDER, rootDir);
        this.profileFiles = refreshed.filter(i => !i.isFolder && i.name.toLowerCase().endsWith('.json'));
      }
      this.syncDiskFolderCandidates();
    } catch {
      // Si el backend no responde en modo estático, operar con localStorage sin escribir en disco
      this.loadWorkspaceFromRaw(localStorage.getItem(STORAGE_KEY));
    }
  }

  async refreshProfileList(): Promise<void> {
    try {
      const rootDir = await this.ensureAppBaseDir();
      const items = await this.docApi.listDocs(this.BASE_FOLDER, rootDir);
      this.profileFiles = items.filter(i => !i.isFolder && i.name.toLowerCase().endsWith('.json'));
      await this.syncDiskFolderCandidates();
      setTimeout(() => this.lucide.refresh(), 40);
    } catch {
      // Ignorar error de red
    }
  }

  async openProfileModal(): Promise<void> {
    this.showProfileModal = true;
    this.newProfileInput = '';
    await this.refreshProfileList();
    setTimeout(() => this.lucide.refresh(), 50);
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
  }

  async selectProfile(fileName: string): Promise<void> {
    if (!fileName) return;
    await this.loadProfileFromDisk(fileName, true);
  }

  async loadProfileFromDisk(fileName: string, notify = true): Promise<void> {
    try {
      const rootDir = await this.ensureAppBaseDir();
      const res = await this.docApi.readFile(`${this.BASE_FOLDER}/${fileName}`, rootDir);
      if (res && typeof res.content === 'string') {
        const trimmed = res.content.replace(/^\uFEFF/, '').trim();
        this.activeProfileFile = fileName;
        localStorage.setItem(ACTIVE_PROFILE_KEY, fileName);
        this.loadDriveExcelMetadataForActiveProfile();
        this.selectedBranchId = null;

        if (!trimmed) {
          // El archivo fue creado vacío en el editor: inicializar memoria en limpio sin sobrescribir hasta que el usuario guarde algo
          this.branches = [];
          this.releaseBlocks = [];
          this.availableDevs = [];
          this.availableFlows = [];
        } else {
          const ok = this.loadWorkspaceFromRaw(trimmed);
          if (!ok && notify) {
            this.showToast(`El archivo ${fileName} tiene formato JSON inválido. No fue modificado.`);
            return;
          }
        }

        if (notify) {
          this.showToast(`Perfil cargado desde disco: ${fileName.replace(/\.json$/i, '')}`);
        }
        setTimeout(() => this.lucide.refresh(), 50);
      }
    } catch {
      if (notify) {
        this.showToast('No se pudo leer el perfil seleccionado');
      }
    }
  }

  async createNewProfile(): Promise<void> {
    const clean = this.newProfileInput.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if (!clean) {
      this.showToast('Escribe un nombre para el nuevo perfil');
      return;
    }
    const fileName = clean.toLowerCase().endsWith('.json') ? clean : `${clean}.json`;

    // Refrescar lista real desde disco antes de crear para no sobrescribir un archivo creado manualmente en Explorer/VS Code
    await this.refreshProfileList();
    const existing = this.profileFiles.find(f => f.name.toLowerCase() === fileName.toLowerCase());
    if (existing) {
      this.newProfileInput = '';
      await this.loadProfileFromDisk(existing.name, true);
      return;
    }

    this.activeProfileFile = fileName;
    localStorage.setItem(ACTIVE_PROFILE_KEY, fileName);
    this.loadDriveExcelMetadataForActiveProfile();
    this.branches = [];
    this.releaseBlocks = [];
    this.selectedBranchId = null;
    this.newProfileInput = '';

    this.saveWorkspace();
    await this.refreshProfileList();
    this.showToast(`Nuevo perfil creado en ${this.BASE_FOLDER}/${fileName}`);
  }

  async deleteProfileFile(fileName: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.profileFiles.length <= 1) {
      this.showToast('Debe existir al menos un perfil activo en json/gravity/');
      return;
    }
    try {
      const rootDir = await this.ensureAppBaseDir();
      await this.docApi.deleteItem(`${this.BASE_FOLDER}/${fileName}`, rootDir);
      await this.refreshProfileList();
      if (this.activeProfileFile.toLowerCase() === fileName.toLowerCase() && this.profileFiles.length > 0) {
        await this.loadProfileFromDisk(this.profileFiles[0].name, true);
      }
      this.showToast(`Perfil eliminado: ${fileName}`);
    } catch {
      this.showToast('No se pudo eliminar el perfil');
    }
  }

  async openProfileFolderInExplorer(): Promise<void> {
    await this.openGravityFolderInExplorer();
  }

  async openGravityFolderInExplorer(): Promise<void> {
    try {
      const rootDir = await this.ensureAppBaseDir();
      await this.docApi.openInExplorer(this.BASE_FOLDER, rootDir);
      this.showToast(`Carpeta abierta: ${this.BASE_FOLDER}/`);
    } catch {
      this.showToast('No se pudo abrir la carpeta en el explorador');
    }
  }

  // --- SUBIDA / IMPORTACIÓN DE ARCHIVOS EN CARPETA ELIGIENDO CUÁL SUBIR Y CUÁL NO ---

  async syncDiskFolderCandidates(): Promise<void> {
    const externalOnly = this.folderCandidates.filter(c => c.source === 'external');
    const diskList: Array<{
      name: string;
      relativePath: string;
      content: string;
      selected: boolean;
      source: 'disk' | 'external';
    }> = [];

    for (const item of this.profileFiles) {
      const existing = this.folderCandidates.find(
        c => c.source === 'disk' && c.name.toLowerCase() === item.name.toLowerCase()
      );
      diskList.push({
        name: item.name,
        relativePath: `${this.BASE_FOLDER}/${item.name}`,
        content: existing?.content || '',
        selected: existing ? existing.selected : true,
        source: 'disk'
      });
    }
    this.folderCandidates = [...diskList, ...externalOnly];
  }

  async onExternalFolderFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    let added = 0;

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.json')) continue;
      try {
        const text = await file.text();
        const relPath = (file as any).webkitRelativePath || file.name;
        const existingIdx = this.folderCandidates.findIndex(
          c => c.name.toLowerCase() === file.name.toLowerCase() && c.source === 'external'
        );
        const entry = {
          name: file.name,
          relativePath: relPath,
          content: text,
          selected: true,
          source: 'external' as const
        };
        if (existingIdx >= 0) {
          this.folderCandidates[existingIdx] = entry;
        } else {
          this.folderCandidates.push(entry);
        }
        added++;
      } catch {
        // Ignorar archivo ilegible
      }
    }

    input.value = '';
    if (added > 0) {
      this.showToast(`${added} archivo(s) detectados. Elige cuáles importar o subir.`);
    } else {
      this.showToast('No se encontraron archivos .json en la selección');
    }
    setTimeout(() => this.lucide.refresh(), 40);
  }

  toggleCandidateSelection(item: { selected: boolean }): void {
    item.selected = !item.selected;
  }

  selectAllCandidates(selected: boolean): void {
    for (const c of this.folderCandidates) {
      c.selected = selected;
    }
  }

  get selectedCandidatesCount(): number {
    return this.folderCandidates.filter(c => c.selected).length;
  }

  get selectedExternalCandidatesCount(): number {
    return this.folderCandidates.filter(c => c.selected && c.source === 'external').length;
  }

  async importSelectedCandidatesToGravityFolder(): Promise<void> {
    const selectedExt = this.folderCandidates.filter(c => c.selected && c.source === 'external');
    if (selectedExt.length === 0) {
      this.showToast('Selecciona al menos un archivo externo para importar a json/gravity/');
      return;
    }
    this.isUploadingFolderFiles = true;
    let imported = 0;
    try {
      const rootDir = await this.ensureAppBaseDir();
      for (const item of selectedExt) {
        await this.docApi.saveJsonDoc(item.name, this.BASE_FOLDER, item.content, rootDir);
        imported++;
      }
      // Quitar los externos ya importados y refrescar la carpeta física
      this.folderCandidates = this.folderCandidates.filter(c => c.source !== 'external' || !c.selected);
      await this.refreshProfileList();
      this.showToast(`${imported} archivo(s) guardados en ${this.BASE_FOLDER}/`);
    } catch {
      this.showToast('Error al importar archivos a la carpeta');
    } finally {
      this.isUploadingFolderFiles = false;
    }
  }

  async uploadSelectedCandidatesToDrive(): Promise<void> {
    const selected = this.folderCandidates.filter(c => c.selected);
    if (selected.length === 0) {
      this.showToast('Selecciona al menos un archivo para subir');
      return;
    }
    if (!this.googleDrive.isLoggedIn()) {
      this.showToast('Conecta primero tu cuenta de Google Drive en el botón de la barra izquierda');
      return;
    }

    this.isUploadingFolderFiles = true;
    try {
      const rootDir = await this.ensureAppBaseDir();
      // Si hay externos seleccionados, guardarlos primero en json/gravity/
      for (const ext of selected.filter(c => c.source === 'external')) {
        await this.docApi.saveJsonDoc(ext.name, this.BASE_FOLDER, ext.content, rootDir);
      }
      await this.persistActiveProfileToDisk();

      const selectedKeys = new Set<string>();
      for (const item of selected) {
        selectedKeys.add(`json:gravity/${item.name}`);
      }
      const res = await this.googleDrive.uploadFullWorkspaceToDrive(selectedKeys);
      this.folderCandidates = this.folderCandidates.filter(c => c.source !== 'external' || !c.selected);
      await this.refreshProfileList();
      this.showToast(res.message);
    } catch (err: any) {
      this.showToast('Error al subir a Drive: ' + (err.message || err));
    } finally {
      this.isUploadingFolderFiles = false;
    }
  }

  // --- PERSISTENCIA LIMPIA ---

  private formatCanonicalFlowName(name: string): string {
    const clean = name.trim();
    if (!clean) return '';
    // Si tiene mezcla accidental de dos mayúsculas al inicio como "PEndo", normalizar a "Pendo"
    if (/^[A-Z]{2}[a-z]+$/.test(clean)) {
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }
    return clean;
  }

  private loadWorkspaceFromRaw(raw: string | null): boolean {
    if (!raw || !raw.trim()) {
      this.branches = [];
      this.releaseBlocks = [];
      this.availableDevs = [];
      this.availableFlows = [];
      return true;
    }

    try {
      // Limpiar BOM UTF-8 y comas finales accidentales al copiar/pegar JSON manualmente
      const sanitized = raw
        .replace(/^\uFEFF/, '')
        .trim()
        .replace(/,\s*([}\]])/g, '$1');

      const parsed: any = JSON.parse(sanitized);
      if (!parsed || typeof parsed !== 'object') {
        return false;
      }

      const rawBranches: any[] = Array.isArray(parsed.branches)
        ? parsed.branches
        : Array.isArray(parsed)
        ? parsed
        : [];
      this.releaseBlocks = Array.isArray(parsed.releaseBlocks) ? parsed.releaseBlocks : [];
      const rawDevs: string[] = Array.isArray(parsed.availableDevs) ? parsed.availableDevs : [];
      const rawFlows: string[] = Array.isArray(parsed.availableFlows) ? [...parsed.availableFlows] : [];

      // Soporte cruzado: si el usuario copió y pegó un JSON del módulo Repo Docs (json/rama/*.json)
      const folderNameById = new Map<string, string>();
      if (Array.isArray(parsed.folders)) {
        for (const folder of parsed.folders) {
          if (folder && folder.id !== undefined && folder.name) {
            const folderName = String(folder.name).trim();
            folderNameById.set(String(folder.id), folderName);
            if (folderName) rawFlows.push(folderName);
          }
        }
      }

      // 1. Limpiar categorías accidentales (números de fecha/ticket o prefijos truncados al escribir) y deduplicar sin importar mayúsculas/minúsculas
      const filteredFlows = rawFlows.filter(f => {
        const clean = (f || '').trim();
        if (!clean || clean.toLowerCase() === 'general' || /^\d+$/.test(clean)) return false;
        // Descartar si es un sub-prefijo exacto de otra categoría existente (ej. P, PE, PEn, PEnd -> Pendo)
        const isPrefixOfLonger = rawFlows.some(
          other =>
            other &&
            other.trim().length > clean.length &&
            other.trim().toLowerCase().startsWith(clean.toLowerCase())
        );
        return !isPrefixOfLonger;
      });

      const flowMap = new Map<string, string>();
      for (const fl of filteredFlows) {
        const normalized = this.formatCanonicalFlowName(fl);
        const key = normalized.toLowerCase();
        if (!flowMap.has(key)) {
          flowMap.set(key, normalized);
        }
      }
      this.availableFlows = Array.from(flowMap.values());

      // 2. Deduplicar catálogo de desarrolladores sin importar mayúsculas/minúsculas
      this.availableDevs = [];
      for (const d of rawDevs) {
        this.ensureGlobalDev(d);
      }

      // Mapa de sub-ramas por parentId (en caso de pegar un JSON de Repo Docs)
      const childrenByParentId = new Map<string, any[]>();
      for (const item of rawBranches) {
        if (item && item.parentId) {
          const pid = String(item.parentId);
          if (!childrenByParentId.has(pid)) childrenByParentId.set(pid, []);
          childrenByParentId.get(pid)!.push(item);
        }
      }

      // 3. Deduplicar ramas con el mismo nombre exacto y normalizar su categoría, campos y devs
      const branchByName = new Map<string, TrackedBranch>();
      for (const item of rawBranches) {
        if (!item || !item.name) continue;
        // Si proviene de Repo Docs y tiene parentId, se agregará como subBranch de su rama padre
        if (item.parentId && !item.moduleFlow && !item.featureTitle) continue;

        const cleanName = String(item.name).trim();
        if (!cleanName) continue;
        const nameKey = cleanName.toLowerCase();

        // Determinar categoría desde moduleFlow o folderId (si se pegó de Repo Docs)
        let candidateFlow = item.moduleFlow || '';
        if (!candidateFlow && item.folderId !== undefined) {
          candidateFlow = folderNameById.get(String(item.folderId)) || '';
        }
        let rawMod = String(candidateFlow || 'General').trim();
        let resolvedFlow = 'General';
        if (rawMod && !/^\d+$/.test(rawMod) && rawMod.toLowerCase() !== 'general') {
          resolvedFlow = this.ensureGlobalFlow(this.formatCanonicalFlowName(rawMod));
        }

        // Determinar estado válido
        let state: BranchLifecycleState = 'En desarrollo';
        if (item.state === 'QA' || item.state === 'Certificada' || item.state === 'En desarrollo') {
          state = item.state;
        } else if (Array.isArray(item.tags)) {
          const tagsUpper = item.tags.map((t: any) => String(t).toUpperCase());
          if (tagsUpper.some((t: string) => t.includes('PROD') || t.includes('CERT'))) {
            state = 'Certificada';
          } else if (tagsUpper.some((t: string) => t.includes('QA'))) {
            state = 'QA';
          }
        }

        // Deduplicar devs y versiones dentro de la rama
        const uniqueDevs: string[] = [];
        const sourceDevs = Array.isArray(item.devs) ? item.devs : [];
        for (const d of sourceDevs) {
          const canonicalDev = this.ensureGlobalDev(String(d));
          if (canonicalDev && !uniqueDevs.some(ud => ud.toLowerCase() === canonicalDev.toLowerCase())) {
            uniqueDevs.push(canonicalDev);
          }
        }

        const qaVersions: string[] = Array.isArray(item.qaVersions)
          ? Array.from(new Set(item.qaVersions.map((v: any) => String(v).trim()).filter(Boolean)))
          : [];

        // Construir subBranches (nativas o convertidas desde parentId de Repo Docs)
        const subBranches: SubBranchContext[] = Array.isArray(item.subBranches)
          ? item.subBranches.map((sb: any, idx: number) => ({
              id: sb.id || 'sub-' + Date.now() + '-' + idx,
              branchName: String(sb.branchName || sb.name || '').trim(),
              devName: String(sb.devName || sb.dev || 'Por asignar').trim(),
              notesOrCommits: String(sb.notesOrCommits || sb.summary || sb.desc || '').trim(),
              linkedBranchId: sb.linkedBranchId || sb.sourceBranchId
            }))
          : [];

        if (item.id !== undefined && childrenByParentId.has(String(item.id))) {
          for (const child of childrenByParentId.get(String(item.id))!) {
            const childName = String(child.name || '').trim();
            if (childName && !subBranches.some(s => s.branchName.toLowerCase() === childName.toLowerCase())) {
              subBranches.push({
                id: String(child.id || 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
                branchName: childName,
                devName: 'Por asignar',
                notesOrCommits: String(child.desc || '').trim()
              });
            }
          }
        }

        // Construir enlaces o carpetas guardadas de compilados (Drive, nube, red)
        const folderLinks: BranchFolderLink[] = Array.isArray(item.folderLinks)
          ? item.folderLinks
              .map((fl: any, idx: number) => ({
                id: fl.id || 'fl_' + Date.now() + '_' + idx,
                label: String(fl.label || '').trim(),
                url: String(fl.url || '').trim(),
                isPrimary: !!fl.isPrimary
              }))
              .filter((fl: BranchFolderLink) => !!fl.url)
          : [];

        let buildFolderUrl = String(item.buildFolderUrl || '').trim();
        if (!buildFolderUrl && folderLinks.length > 0) {
          const primary = folderLinks.find(f => f.isPrimary) || folderLinks[0];
          buildFolderUrl = primary.url;
        }
        if (buildFolderUrl && folderLinks.length === 0) {
          folderLinks.push({
            id: 'fl_' + Date.now(),
            label: this.inferFolderLabel(buildFolderUrl),
            url: buildFolderUrl,
            isPrimary: true
          });
        }

        const normalizedBranch: TrackedBranch = {
          id: String(item.id || 'br-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
          name: cleanName,
          moduleFlow: resolvedFlow,
          featureTitle: String(item.featureTitle || item.desc || cleanName).trim(),
          state,
          qaVersions,
          devs: uniqueDevs,
          subBranches,
          buildFolderUrl,
          folderLinks,
          objectivesSummary: String(item.objectivesSummary ?? item.desc ?? ''),
          rawCommitsOrDiff: String(item.rawCommitsOrDiff ?? ''),
          createdAt: String(item.createdAt || new Date().toISOString().slice(0, 10)),
          updatedAt: String(item.updatedAt || new Date().toISOString().slice(0, 10))
        };

        if (!branchByName.has(nameKey)) {
          branchByName.set(nameKey, normalizedBranch);
        } else {
          // Si había una rama duplicada con el mismo nombre, fusionar su información sin perder nada
          const existing = branchByName.get(nameKey)!;
          if (!existing.buildFolderUrl && normalizedBranch.buildFolderUrl) {
            existing.buildFolderUrl = normalizedBranch.buildFolderUrl;
          }
          if (normalizedBranch.folderLinks && normalizedBranch.folderLinks.length > 0) {
            existing.folderLinks = existing.folderLinks || [];
            for (const fl of normalizedBranch.folderLinks) {
              if (!existing.folderLinks.some(efl => efl.url.toLowerCase() === fl.url.toLowerCase())) {
                existing.folderLinks.push(fl);
              }
            }
          }
          for (const v of normalizedBranch.qaVersions) {
            if (!existing.qaVersions.includes(v)) existing.qaVersions.push(v);
          }
          for (const d of normalizedBranch.devs) {
            if (!existing.devs.some(ed => ed.toLowerCase() === d.toLowerCase())) {
              existing.devs.push(d);
            }
          }
          if (!existing.objectivesSummary && normalizedBranch.objectivesSummary) {
            existing.objectivesSummary = normalizedBranch.objectivesSummary;
          }
          if (!existing.rawCommitsOrDiff && normalizedBranch.rawCommitsOrDiff) {
            existing.rawCommitsOrDiff = normalizedBranch.rawCommitsOrDiff;
          }
          if (existing.moduleFlow === 'General' && normalizedBranch.moduleFlow !== 'General') {
            existing.moduleFlow = normalizedBranch.moduleFlow;
          }
        }
      }

      this.branches = Array.from(branchByName.values());

      if (Array.isArray(parsed.savedEmailContacts) && parsed.savedEmailContacts.length > 0) {
        this.savedEmailContacts = parsed.savedEmailContacts;
      } else {
        this.loadSavedEmailContacts();
      }

      // Actualizar únicamente caché local en navegador (NUNCA sobrescribir el disco al leer)
      try {
        const payload: GravityLeadWorkspace = {
          branches: this.branches,
          releaseBlocks: this.releaseBlocks,
          availableDevs: this.availableDevs,
          availableFlows: this.availableFlows,
          savedEmailContacts: this.savedEmailContacts
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignorar errores de cuota
      }

      return true;
    } catch (err) {
      console.error('Error al parsear el JSON del perfil Gravity:', err);
      return false;
    }
  }

  saveWorkspace(): void {
    try {
      const payload: GravityLeadWorkspace = {
        branches: this.branches,
        releaseBlocks: this.releaseBlocks,
        availableDevs: this.availableDevs,
        availableFlows: this.availableFlows,
        savedEmailContacts: this.savedEmailContacts
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      this.persistActiveProfileToDisk();

      if (this.autoSyncExcelToDrive && this.googleDrive.isLoggedIn()) {
        this.scheduleDriveExcelSync();
      }
    } catch {
      // Ignorar errores de cuota
    }
  }

  private async persistActiveProfileToDisk(): Promise<void> {
    try {
      const rootDir = await this.ensureAppBaseDir();
      const payload: GravityLeadWorkspace = {
        branches: this.branches,
        releaseBlocks: this.releaseBlocks,
        availableDevs: this.availableDevs,
        availableFlows: this.availableFlows,
        savedEmailContacts: this.savedEmailContacts
      };
      await this.docApi.saveJsonDoc(
        this.activeProfileFile,
        this.BASE_FOLDER,
        JSON.stringify(payload, null, 2),
        rootDir
      );
    } catch {
      // Ignorar si está offline
    }
  }

  private ensureGlobalDev(name: string): string {
    const clean = (name || '').trim();
    if (!clean) return '';
    const existing = this.availableDevs.find(d => d.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    this.availableDevs.push(clean);
    return clean;
  }

  private ensureGlobalFlow(flow: string): string {
    const clean = this.formatCanonicalFlowName(flow || '');
    if (!clean || clean.toLowerCase() === 'general' || /^\d+$/.test(clean)) return 'General';
    const existing = this.availableFlows.find(f => f.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    this.availableFlows.push(clean);
    return clean;
  }

  // --- GETTERS Y FILTROS ---

  get selectedBranch(): TrackedBranch | null {
    if (!this.selectedBranchId) return null;
    return this.branches.find(b => b.id === this.selectedBranchId) || null;
  }

  get filteredBranches(): TrackedBranch[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.branches.filter(b => {
      if (this.stateFilter !== 'ALL' && b.state !== this.stateFilter) {
        return false;
      }
      if (
        this.categoryFilter !== 'ALL' &&
        (b.moduleFlow || 'General').toLowerCase() !== this.categoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (!q) return true;
      const matchName = b.name.toLowerCase().includes(q);
      const matchFlow = (b.moduleFlow || '').toLowerCase().includes(q);
      const matchTitle = (b.featureTitle || '').toLowerCase().includes(q);
      const matchVersion = (b.qaVersions || []).some(v => v.toLowerCase().includes(q));
      const matchDev = (b.devs || []).some(d => d.toLowerCase().includes(q));
      return matchName || matchFlow || matchTitle || matchVersion || matchDev;
    });
  }

  get groupedFilteredBranches(): { category: string; branches: TrackedBranch[] }[] {
    const groupsMap = new Map<string, TrackedBranch[]>();

    for (const b of this.filteredBranches) {
      const cat = (b.moduleFlow || 'General').trim() || 'General';
      const existingKey = Array.from(groupsMap.keys()).find(k => k.toLowerCase() === cat.toLowerCase()) || cat;
      if (!groupsMap.has(existingKey)) {
        groupsMap.set(existingKey, []);
      }
      groupsMap.get(existingKey)!.push(b);
    }

    return Array.from(groupsMap.entries()).map(([category, branches]) => ({
      category,
      branches
    }));
  }

  trackByCategory(_index: number, group: { category: string; branches: TrackedBranch[] }): string {
    return group.category.toLowerCase();
  }

  trackByBranchId(_index: number, branch: TrackedBranch): string {
    return branch.id;
  }

  toggleCategoryCollapse(category: string): void {
    const key = category.toLowerCase();
    if (this.collapsedCategories.has(key)) {
      this.collapsedCategories.delete(key);
    } else {
      this.collapsedCategories.add(key);
    }
    this.lucide.refresh();
  }

  isCategoryCollapsed(category: string): boolean {
    return this.collapsedCategories.has(category.toLowerCase());
  }

  // --- GESTIÓN DE CATEGORÍAS (MÓDULO / FLUJO) ---

  getCategoryBranchCount(category: string): number {
    const target = (category || '').trim().toLowerCase();
    if (!target) return 0;
    return this.branches.filter(
      b => (b.moduleFlow || 'General').trim().toLowerCase() === target
    ).length;
  }

  createCategoryFromSidebar(): void {
    const raw = this.sidebarCategoryInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    let lastCanonical = '';
    for (const p of parts) {
      lastCanonical = this.ensureGlobalFlow(p);
    }
    this.sidebarCategoryInput = '';
    this.showAddCategorySidebar = false;
    this.saveWorkspace();
    if (lastCanonical && lastCanonical !== 'General') {
      this.showToast(`Categoría "${lastCanonical}" lista`);
    }
    this.lucide.refresh();
  }

  createAndSelectCategory(branch?: TrackedBranch): void {
    const raw = this.categoryInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    let lastCanonical = '';
    for (const p of parts) {
      lastCanonical = this.ensureGlobalFlow(p);
    }
    if (branch && lastCanonical) {
      branch.moduleFlow = lastCanonical;
      branch.updatedAt = new Date().toISOString();
    }
    this.categoryInput = '';
    this.showAddCategoryInput = false;
    this.saveWorkspace();
    this.showToast(`Categoría "${lastCanonical}" asignada`);
    this.lucide.refresh();
  }

  selectCategoryForBranch(branch: TrackedBranch, category: string): void {
    const current = (branch.moduleFlow || 'General').trim().toLowerCase();
    const target = (category || '').trim().toLowerCase();
    if (current === target && target !== 'general') {
      // Clic en la categoría activa la desasocia de la rama (vuelve a General)
      branch.moduleFlow = 'General';
      branch.updatedAt = new Date().toISOString();
      this.saveWorkspace();
      this.showToast(`Categoría "${category}" desasociada de la rama`);
      this.lucide.refresh();
      return;
    }
    branch.moduleFlow = category;
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  deleteGlobalCategory(category: string, event: Event): void {
    event.stopPropagation();
    const associatedCount = this.getCategoryBranchCount(category);
    if (associatedCount > 0) {
      this.showToast(
        `No puedes eliminar "${category}" porque está asociada a ${associatedCount} rama(s)`
      );
      return;
    }
    this.availableFlows = this.availableFlows.filter(
      f => f.toLowerCase() !== category.toLowerCase()
    );
    if (this.categoryFilter.toLowerCase() === category.toLowerCase()) {
      this.categoryFilter = 'ALL';
    }
    this.saveWorkspace();
    this.showToast(`Categoría "${category}" eliminada`);
    this.lucide.refresh();
  }

  // Diccionario de Mapeo de Versiones QA -> Rama y Flujo
  get versionDictionary(): {
    version: string;
    branch: TrackedBranch;
  }[] {
    const q = this.searchQuery.trim().toLowerCase();
    const entries: { version: string; branch: TrackedBranch }[] = [];
    for (const b of this.branches) {
      for (const v of b.qaVersions || []) {
        if (
          !q ||
          v.toLowerCase().includes(q) ||
          b.name.toLowerCase().includes(q) ||
          (b.moduleFlow || '').toLowerCase().includes(q)
        ) {
          entries.push({ version: v, branch: b });
        }
      }
    }
    return entries;
  }

  get totalVersionMappings(): number {
    return this.branches.reduce((acc, b) => acc + (b.qaVersions?.length || 0), 0);
  }

  get certifiedCount(): number {
    return this.branches.filter(b => b.state === 'Certificada').length;
  }

  // --- GESTIÓN DE TAGS DE DESARROLLADORES (UN SOLO CLIC) ---

  getDevBranchCount(dev: string): number {
    return this.branches.filter(b => this.isDevSelectedInBranch(b, dev)).length;
  }

  isDevSelectedInBranch(branch: TrackedBranch, dev: string): boolean {
    return (branch.devs || []).some(d => d.toLowerCase() === dev.toLowerCase());
  }

  toggleDevTagInBranch(branch: TrackedBranch, dev: string): void {
    const exists = this.isDevSelectedInBranch(branch, dev);
    if (exists) {
      branch.devs = branch.devs.filter(d => d.toLowerCase() !== dev.toLowerCase());
    } else {
      branch.devs.push(dev);
    }
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  createAndSelectDevTag(branch?: TrackedBranch): void {
    const raw = this.devInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      const canonical = this.ensureGlobalDev(p);
      if (branch && canonical && !this.isDevSelectedInBranch(branch, canonical)) {
        branch.devs.push(canonical);
      }
    }
    if (branch) {
      branch.updatedAt = new Date().toISOString();
    }
    this.devInput = '';
    this.showAddDevInput = false;
    this.saveWorkspace();
    this.lucide.refresh();
  }

  deleteGlobalDevTag(dev: string, event: Event): void {
    event.stopPropagation();
    const associatedCount = this.getDevBranchCount(dev);
    if (associatedCount > 0) {
      this.showToast(
        `No puedes eliminar "${dev}" porque está asociado a ${associatedCount} rama(s)`
      );
      return;
    }
    this.availableDevs = this.availableDevs.filter(d => d.toLowerCase() !== dev.toLowerCase());
    this.newBranchSelectedDevs = this.newBranchSelectedDevs.filter(d => d.toLowerCase() !== dev.toLowerCase());
    this.saveWorkspace();
    this.showToast(`Tag "${dev}" eliminado`);
    this.lucide.refresh();
  }

  // En el modal de Nueva Rama: clic en tag de dev
  isDevSelectedInModal(dev: string): boolean {
    return this.newBranchSelectedDevs.some(d => d.toLowerCase() === dev.toLowerCase());
  }

  toggleDevTagInModal(dev: string): void {
    if (this.isDevSelectedInModal(dev)) {
      this.newBranchSelectedDevs = this.newBranchSelectedDevs.filter(
        d => d.toLowerCase() !== dev.toLowerCase()
      );
    } else {
      this.newBranchSelectedDevs.push(dev);
    }
  }

  addCustomDevInModal(): void {
    const raw = this.newBranchCustomDevInput.trim();
    if (!raw) return;
    const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
    for (const p of parts) {
      const canonical = this.ensureGlobalDev(p);
      if (canonical && !this.isDevSelectedInModal(canonical)) {
        this.newBranchSelectedDevs.push(canonical);
      }
    }
    this.newBranchCustomDevInput = '';
    this.saveWorkspace();
  }

  // --- CREACIÓN Y AUTOCOMPLETADO DE FORMATO feature/[fecha]/[flujo]/[desarrollo] ---

  openNewBranchModal(): void {
    this.newBranchName = '';
    this.newBranchFlow = '';
    this.newBranchTitle = '';
    this.newBranchState = 'En desarrollo';
    this.newBranchVersionInput = '';
    this.newBranchSelectedDevs = [];
    this.newBranchCustomDevInput = '';
    this.newBranchLinkedBranchIds = [];
    this.showNewBranchModal = true;
    this.lucide.refresh();
  }

  isBranchLinkedInNewModal(branchId: string): boolean {
    return this.newBranchLinkedBranchIds.includes(branchId);
  }

  toggleLinkedBranchInNewModal(sourceBranch: TrackedBranch): void {
    const idx = this.newBranchLinkedBranchIds.indexOf(sourceBranch.id);
    if (idx >= 0) {
      this.newBranchLinkedBranchIds.splice(idx, 1);
    } else {
      this.newBranchLinkedBranchIds.push(sourceBranch.id);
      // Sumar automáticamente los devs de la rama jalada al modal
      for (const dev of sourceBranch.devs || []) {
        if (!this.isDevSelectedInModal(dev)) {
          this.newBranchSelectedDevs.push(dev);
        }
      }
      if (!this.newBranchFlow && sourceBranch.moduleFlow && sourceBranch.moduleFlow !== 'General') {
        this.newBranchFlow = sourceBranch.moduleFlow;
      }
    }
  }

  onNewBranchNameChange(value: string): void {
    this.newBranchName = value;
    // Autodetectar título descriptivo a partir del último segmento de la rama
    const parts = value.trim().split('/').filter(Boolean);
    if (parts.length >= 2) {
      const lastSegment = parts[parts.length - 1];
      if (!this.newBranchTitle && lastSegment && !/^\d+$/.test(lastSegment)) {
        const cleanTitle = lastSegment.replace(/[-_]+/g, ' ').trim();
        this.newBranchTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
      }
      // Si algún segmento coincide con una categoría ya existente, seleccionarla automáticamente
      if (!this.newBranchFlow) {
        const matchedFlow = this.availableFlows.find(fl =>
          parts.some(p => p.toLowerCase().includes(fl.toLowerCase()))
        );
        if (matchedFlow) {
          this.newBranchFlow = matchedFlow;
        }
      }
    }
  }

  createBranch(): void {
    const cleanName = this.newBranchName.trim();
    if (!cleanName) {
      this.showToast('Ingresa el nombre de la rama');
      return;
    }

    // Evitar duplicados con el mismo nombre de rama
    const existingBranch = this.branches.find(
      b => b.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingBranch) {
      this.selectedBranchId = existingBranch.id;
      this.showNewBranchModal = false;
      this.showToast('Esta rama ya existe; se seleccionó el registro existente');
      this.lucide.refresh();
      return;
    }

    // Si escribió algún dev en el input sin presionar "+", sumarlo también
    if (this.newBranchCustomDevInput.trim()) {
      this.addCustomDevInModal();
    }

    const versions = this.newBranchVersionInput
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    const rawFlow = this.newBranchFlow.trim();
    const canonicalFlow = rawFlow ? this.ensureGlobalFlow(rawFlow) : 'General';

    const now = new Date().toISOString();
    const initialSubBranches: SubBranchContext[] = [];
    for (const linkedId of this.newBranchLinkedBranchIds) {
      const src = this.branches.find(b => b.id === linkedId);
      if (src) {
        initialSubBranches.push({
          id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          branchName: src.name,
          devName: (src.devs || []).join(', '),
          notesOrCommits: src.featureTitle || (src.objectivesSummary || '').split(/\r?\n/)[0] || '',
          linkedBranchId: src.id
        });
        for (const d of src.devs || []) {
          if (!this.newBranchSelectedDevs.some(nd => nd.toLowerCase() === d.toLowerCase())) {
            this.newBranchSelectedDevs.push(d);
          }
        }
      }
    }

    const branch: TrackedBranch = {
      id: 'gbr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      moduleFlow: canonicalFlow,
      featureTitle: this.newBranchTitle.trim() || cleanName,
      state: this.newBranchState,
      qaVersions: Array.from(new Set(versions)),
      devs: [...this.newBranchSelectedDevs],
      objectivesSummary: '',
      rawCommitsOrDiff: '',
      subBranches: initialSubBranches,
      createdAt: now,
      updatedAt: now
    };

    this.branches.unshift(branch);
    this.selectedBranchId = branch.id;
    this.generatedSingleMr = '';
    this.showNewBranchModal = false;
    this.saveWorkspace();
    this.showToast('Rama registrada');
    this.lucide.refresh();
  }

  selectBranch(branchId: string): void {
    this.selectedBranchId = branchId;
    this.generatedSingleMr = '';
    this.activeSection = 'branches';
    this.lucide.refresh();
  }

  deleteBranch(branchId: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.branches = this.branches.filter(b => b.id !== branchId);
    this.selectedBlockBranchIds.delete(branchId);
    if (this.selectedBranchId === branchId) {
      this.selectedBranchId = this.branches[0]?.id || null;
      this.generatedSingleMr = '';
    }
    this.saveWorkspace();
    this.showToast('Rama eliminada');
    this.lucide.refresh();
  }

  // --- TRAZABILIDAD DE RAMAS UNIFICADAS (PADRE <-> SUB-RAMA EXISTENTE) ---

  /**
   * Devuelve las ramas "Padre" (ej. ramaUnion) donde esta rama (ej. rama1) fue jalada como sub-rama.
   */
  getParentBranches(branch: TrackedBranch): TrackedBranch[] {
    if (!branch) return [];
    const targetName = (branch.name || '').trim().toLowerCase();
    return this.branches.filter(
      parent =>
        parent.id !== branch.id &&
        (parent.subBranches || []).some(
          sub =>
            sub.linkedBranchId === branch.id ||
            (sub.branchName || '').trim().toLowerCase() === targetName
        )
    );
  }

  /**
   * Si una sub-rama corresponde a una rama registrada en el workspace, la retorna.
   */
  getLinkedBranch(sub: SubBranchContext): TrackedBranch | null {
    if (!sub) return null;
    if (sub.linkedBranchId) {
      const byId = this.branches.find(b => b.id === sub.linkedBranchId);
      if (byId) return byId;
    }
    const cleanName = (sub.branchName || '').trim().toLowerCase();
    if (!cleanName) return null;
    return this.branches.find(b => b.name.trim().toLowerCase() === cleanName) || null;
  }

  getAvailableBranchesToPull(currentBranch: TrackedBranch): TrackedBranch[] {
    if (!currentBranch) return [];
    const q = this.pullBranchSearchQuery.trim().toLowerCase();
    return this.branches.filter(b => {
      if (b.id === currentBranch.id) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        (b.featureTitle || '').toLowerCase().includes(q) ||
        (b.moduleFlow || '').toLowerCase().includes(q)
      );
    });
  }

  isBranchPulledIn(parentBranch: TrackedBranch, candidate: TrackedBranch): boolean {
    if (!parentBranch || !candidate) return false;
    const candName = candidate.name.trim().toLowerCase();
    return (parentBranch.subBranches || []).some(
      s =>
        s.linkedBranchId === candidate.id ||
        (s.branchName || '').trim().toLowerCase() === candName
    );
  }

  togglePullExistingBranch(parentBranch: TrackedBranch, sourceBranch: TrackedBranch): void {
    if (!parentBranch || !sourceBranch || parentBranch.id === sourceBranch.id) return;

    if (this.isBranchPulledIn(parentBranch, sourceBranch)) {
      const candName = sourceBranch.name.trim().toLowerCase();
      parentBranch.subBranches = (parentBranch.subBranches || []).filter(
        s =>
          s.linkedBranchId !== sourceBranch.id &&
          (s.branchName || '').trim().toLowerCase() !== candName
      );
      parentBranch.updatedAt = new Date().toISOString();
      this.saveWorkspace();
      this.showToast(`Rama desvinculada de ${parentBranch.name}`);
      this.lucide.refresh();
      return;
    }

    const sub: SubBranchContext = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      branchName: sourceBranch.name,
      devName: (sourceBranch.devs || []).join(', '),
      notesOrCommits:
        sourceBranch.featureTitle ||
        (sourceBranch.objectivesSummary || '').split(/\r?\n/)[0] ||
        '',
      linkedBranchId: sourceBranch.id
    };
    parentBranch.subBranches.push(sub);

    // Sincronizar desarrolladores de la rama jalada hacia la rama padre
    for (const d of sourceBranch.devs || []) {
      if (!this.isDevSelectedInBranch(parentBranch, d)) {
        parentBranch.devs.push(d);
      }
    }

    parentBranch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.showToast(`Rama "${sourceBranch.name}" jalada como sub-rama`);
    this.lucide.refresh();
  }

  // --- MÓDULO 1: CONTROL ESTRICTO DE ESTADOS Y VERSIONES QA ---

  setBranchState(branch: TrackedBranch, targetState: BranchLifecycleState): void {
    branch.state = targetState;
    branch.updatedAt = new Date().toISOString();
    if (branch.state !== 'Certificada') {
      this.generatedSingleMr = '';
    }
    this.saveWorkspace();
    this.showToast(`Estado actualizado: ${targetState}`);
    this.lucide.refresh();
  }

  advanceBranchState(branch: TrackedBranch): void {
    const idx = this.lifecycleStates.indexOf(branch.state);
    if (idx < this.lifecycleStates.length - 1) {
      this.setBranchState(branch, this.lifecycleStates[idx + 1]);
    }
  }

  addQaVersion(branch: TrackedBranch): void {
    const clean = this.versionInput.trim();
    if (!clean) return;
    if (!branch.qaVersions.includes(clean)) {
      branch.qaVersions.push(clean);
      branch.updatedAt = new Date().toISOString();
      this.saveWorkspace();
      this.showToast(`Versión QA ${clean} vinculada a ${branch.name}`);
    }
    this.versionInput = '';
    this.lucide.refresh();
  }

  removeQaVersion(branch: TrackedBranch, version: string): void {
    branch.qaVersions = branch.qaVersions.filter(v => v !== version);
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  addSubBranch(branch: TrackedBranch): void {
    const name = this.subBranchNameInput.trim();
    const dev = this.subBranchDevInput.trim();
    const notes = this.subBranchNotesInput.trim();
    if (!name && !notes) return;

    const canonicalDev = dev ? this.ensureGlobalDev(dev) : '';
    const matchedExisting = name
      ? this.branches.find(
          b => b.id !== branch.id && b.name.trim().toLowerCase() === name.toLowerCase()
        )
      : undefined;

    const sub: SubBranchContext = {
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      branchName: matchedExisting ? matchedExisting.name : name || 'sub-rama',
      devName: canonicalDev || (matchedExisting ? (matchedExisting.devs || []).join(', ') : ''),
      notesOrCommits: notes || (matchedExisting ? matchedExisting.featureTitle : ''),
      linkedBranchId: matchedExisting?.id
    };
    branch.subBranches.push(sub);

    if (canonicalDev && !this.isDevSelectedInBranch(branch, canonicalDev)) {
      branch.devs.push(canonicalDev);
    }
    if (matchedExisting) {
      for (const d of matchedExisting.devs || []) {
        if (!this.isDevSelectedInBranch(branch, d)) {
          branch.devs.push(d);
        }
      }
    }

    this.subBranchNameInput = '';
    this.subBranchDevInput = '';
    this.subBranchNotesInput = '';
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  startEditSubBranch(sub: SubBranchContext): void {
    this.editingSubBranchId = sub.id;
    this.editSubBranchName = sub.branchName || '';
    this.editSubBranchDev = sub.devName || '';
    this.editSubBranchNotes = sub.notesOrCommits || '';
    this.lucide.refresh();
  }

  saveEditSubBranch(branch: TrackedBranch, sub: SubBranchContext): void {
    const cleanName = this.editSubBranchName.trim() || 'sub-rama';
    const cleanDev = this.editSubBranchDev.trim();
    const cleanNotes = this.editSubBranchNotes.trim();

    const canonicalDev = cleanDev ? this.ensureGlobalDev(cleanDev) : '';
    const matchedExisting = this.branches.find(
      b => b.id !== branch.id && b.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    sub.branchName = matchedExisting ? matchedExisting.name : cleanName;
    sub.devName = canonicalDev;
    sub.notesOrCommits = cleanNotes;
    sub.linkedBranchId = matchedExisting?.id;

    if (canonicalDev && !this.isDevSelectedInBranch(branch, canonicalDev)) {
      branch.devs.push(canonicalDev);
    }

    this.editingSubBranchId = null;
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.showToast('Sub-rama actualizada');
    this.lucide.refresh();
  }

  cancelEditSubBranch(): void {
    this.editingSubBranchId = null;
    this.lucide.refresh();
  }

  removeSubBranch(branch: TrackedBranch, subId: string): void {
    branch.subBranches = branch.subBranches.filter(s => s.id !== subId);
    if (this.editingSubBranchId === subId) {
      this.editingSubBranchId = null;
    }
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.lucide.refresh();
  }

  onBranchFieldChange(branch: TrackedBranch): void {
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
  }

  // --- MÓDULO 2: ANÁLISIS DE CONTEXTO Y GENERACIÓN DE MR ESTRICTO ---

  private extractBulletPointsFromBranch(branch: TrackedBranch, visited = new Set<string>()): string[] {
    if (!branch || visited.has(branch.id)) return [];
    visited.add(branch.id);

    const bullets: string[] = [];
    const seen = new Set<string>();

    const pushUnique = (line: string) => {
      const cleaned = line
        .replace(/^[•\-\*]+\s*/, '')
        .replace(/^[0-9a-f]{7,40}\s+/i, '')
        .replace(/^(feat|fix|chore|refactor|docs|style|test)(\([^)]+\))?:\s*/i, '')
        .trim();
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        bullets.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    };

    if (branch.objectivesSummary?.trim()) {
      for (const line of branch.objectivesSummary.split(/\r?\n/)) {
        pushUnique(line);
      }
    }

    for (const sub of branch.subBranches || []) {
      if (sub.notesOrCommits?.trim()) {
        for (const line of sub.notesOrCommits.split(/\r?\n/)) {
          pushUnique(line);
        }
      }
      // Si la sub-rama es una rama existente jalada, incorporar también sus objetivos y commits
      const linked = this.getLinkedBranch(sub);
      if (linked && !visited.has(linked.id)) {
        for (const childBullet of this.extractBulletPointsFromBranch(linked, visited)) {
          pushUnique(childBullet);
        }
      }
    }

    if (branch.rawCommitsOrDiff?.trim()) {
      for (const line of branch.rawCommitsOrDiff.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Merge ') || trimmed.startsWith('Author:') || trimmed.startsWith('Date:')) {
          continue;
        }
        pushUnique(trimmed);
      }
    }

    return bullets;
  }

  private collectUniqueDevs(branches: TrackedBranch[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    const addDevName = (name: string) => {
      for (const part of name.split(',')) {
        const clean = part.trim();
        if (!clean) continue;
        const key = clean.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          result.push(clean);
        }
      }
    };

    for (const b of branches) {
      for (const d of b.devs || []) {
        addDevName(d);
      }
      for (const sub of b.subBranches || []) {
        if (sub.devName) addDevName(sub.devName);
        const linked = this.getLinkedBranch(sub);
        if (linked) {
          for (const ld of linked.devs || []) {
            addDevName(ld);
          }
        }
      }
    }

    return result;
  }

  generateSingleBranchMr(branch: TrackedBranch): void {
    if (branch.state !== 'Certificada') {
      this.showToast('Bloqueado: La rama debe estar en estado Certificada para generar el MR');
      return;
    }

    const moduleName = (branch.moduleFlow || 'General').trim();
    const titleDesc = (branch.featureTitle || branch.name).trim();
    const bullets = this.extractBulletPointsFromBranch(branch);
    const bodyText =
      bullets.length > 0
        ? bullets.map(b => `- ${b}`).join('\n')
        : `- Implementación y validación correspondiente a la rama ${branch.name}.`;

    const devs = this.collectUniqueDevs([branch]);
    const devsText = devs.length > 0 ? devs.join(', ') : 'Por definir';

    this.generatedSingleMr =
      `Título: feat(${moduleName}): ${titleDesc}\n\n` +
      `Descripción general del desarrollo u objetivos:\n` +
      `${bodyText}\n\n` +
      `Devs involucrados:\n` +
      `${devsText}`;

    this.showToast('MR generado con plantilla estricta');
    this.lucide.refresh();
  }

  // --- MÓDULO 3: CONSOLIDACIÓN DE RAMAS (RELEASE BLOCKS) ---

  toggleBranchInBlock(branchId: string): void {
    if (this.selectedBlockBranchIds.has(branchId)) {
      this.selectedBlockBranchIds.delete(branchId);
    } else {
      this.selectedBlockBranchIds.add(branchId);
    }
    this.generatedBlockMr = '';
    this.autoFillBlockMetadata();
    this.lucide.refresh();
  }

  private autoFillBlockMetadata(): void {
    const selected = this.selectedBlockBranches;
    if (selected.length === 0) return;
    const uniqueFlows = Array.from(new Set(selected.map(b => b.moduleFlow).filter(Boolean)));
    if (!this.blockModuleFlow && uniqueFlows.length > 0) {
      this.blockModuleFlow = uniqueFlows.join(' / ');
    }
  }

  get selectedBlockBranches(): TrackedBranch[] {
    return this.branches.filter(b => this.selectedBlockBranchIds.has(b.id));
  }

  get uncertifiedBlockBranches(): TrackedBranch[] {
    return this.selectedBlockBranches.filter(b => b.state !== 'Certificada');
  }

  get canGenerateBlockMr(): boolean {
    const selected = this.selectedBlockBranches;
    return selected.length > 0 && selected.every(b => b.state === 'Certificada');
  }

  generateReleaseBlockMr(): void {
    const selected = this.selectedBlockBranches;
    if (selected.length === 0) {
      this.showToast('Selecciona al menos una rama para el bloque');
      return;
    }

    if (this.uncertifiedBlockBranches.length > 0) {
      this.showToast('Bloqueado: Todas las ramas seleccionadas deben estar en estado Certificada');
      return;
    }

    const uniqueFlows = Array.from(new Set(selected.map(b => b.moduleFlow).filter(Boolean)));
    const moduleName = (this.blockModuleFlow || uniqueFlows.join('/') || 'General').trim();
    const titleDesc = (
      this.blockFeatureTitle ||
      selected.map(b => b.featureTitle || b.name).join(' + ')
    ).trim();

    const globalSeen = new Set<string>();
    const sections: string[] = [];

    for (const b of selected) {
      const branchBullets = this.extractBulletPointsFromBranch(b).filter(item => {
        const k = item.toLowerCase();
        if (globalSeen.has(k)) return false;
        globalSeen.add(k);
        return true;
      });

      const headerLabel = b.featureTitle ? `${b.featureTitle} (${b.name})` : b.name;
      if (branchBullets.length > 0) {
        sections.push(
          `• ${headerLabel}:\n` + branchBullets.map(point => `  - ${point}`).join('\n')
        );
      } else {
        sections.push(`• ${headerLabel}: Integración certificada lista para develop.`);
      }
    }

    const devs = this.collectUniqueDevs(selected);
    const devsText = devs.length > 0 ? devs.join(', ') : 'Por definir';

    this.generatedBlockMr =
      `Título: feat(${moduleName}): ${titleDesc}\n\n` +
      `Descripción general del desarrollo u objetivos:\n` +
      `${sections.join('\n\n')}\n\n` +
      `Devs involucrados:\n` +
      `${devsText}`;

    const record: ReleaseBlockRecord = {
      id: 'blk_' + Date.now(),
      name: titleDesc,
      moduleFlow: moduleName,
      branchIds: selected.map(b => b.id),
      generatedMrText: this.generatedBlockMr,
      createdAt: new Date().toISOString()
    };
    this.releaseBlocks.unshift(record);
    this.saveWorkspace();
    this.showToast('Release Block consolidado');
    this.lucide.refresh();
  }

  deleteReleaseBlock(blockId: string): void {
    this.releaseBlocks = this.releaseBlocks.filter(b => b.id !== blockId);
    this.saveWorkspace();
    this.lucide.refresh();
  }

  // --- EXPORTACIÓN PDF POR RAMA (PERSONALIZABLE) Y EXCEL GLOBAL ---

  exportBranchPdf(branch: TrackedBranch, event?: Event): void {
    if (event) event.stopPropagation();
    if (!branch) return;

    this.pdfTargetBranch = branch;
    this.pdfCustomHeaderTitle = (branch.featureTitle || branch.name || '').trim();
    const rawBullets = this.extractBulletPointsFromBranch(branch);
    this.pdfSelectableObjectives = rawBullets.map(text => ({ text, selected: true }));
    this.pdfSelectableSubBranches = (branch.subBranches || []).map(sub => ({
      sub,
      selected: true
    }));
    this.showPdfConfigModal = true;
    this.lucide.refresh();
  }

  selectAllPdfOptions(): void {
    this.pdfOptions = {
      includeHeader: true,
      includeTechSheet: true,
      fieldBranch: true,
      fieldCategory: true,
      fieldFeature: true,
      fieldState: true,
      fieldQaVersions: true,
      fieldDevs: true,
      fieldUpdatedAt: true,
      includeObjectives: true,
      includeSubBranches: true,
      includeMrPreview: true
    };
    this.pdfSelectableObjectives.forEach(o => (o.selected = true));
    this.pdfSelectableSubBranches.forEach(s => (s.selected = true));
  }

  selectMinimalPdfOptions(): void {
    this.pdfOptions = {
      includeHeader: true,
      includeTechSheet: true,
      fieldBranch: true,
      fieldCategory: true,
      fieldFeature: true,
      fieldState: true,
      fieldQaVersions: true,
      fieldDevs: true,
      fieldUpdatedAt: false,
      includeObjectives: true,
      includeSubBranches: false,
      includeMrPreview: false
    };
  }

  confirmExportBranchPdf(): void {
    const branch = this.pdfTargetBranch;
    if (!branch) return;

    try {
      const jsPDFCtor =
        typeof jspdf !== 'undefined' && jspdf.jsPDF ? jspdf.jsPDF : (window as any).jsPDF;
      if (!jsPDFCtor) {
        this.showToast('Librería PDF no disponible');
        return;
      }

      const doc = new jsPDFCtor({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 14;

      // Encabezado con el título descriptivo (si está activado)
      if (this.pdfOptions.includeHeader) {
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, pageWidth, 22, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(255, 255, 255);
        const cleanTitle = (this.pdfCustomHeaderTitle || branch.featureTitle || branch.name || '').trim();
        const splitTitle = doc.splitTextToSize(cleanTitle, pageWidth - 28);
        doc.text(splitTitle[0] || cleanTitle, 14, 13.5);
        currentY = 28;
      }

      const devsList = this.collectUniqueDevs([branch]);
      const qaVersionsText = branch.qaVersions?.length
        ? branch.qaVersions.map(v => `v${v}`).join(', ')
        : 'Sin asignar';
      const formattedDate = new Date(branch.updatedAt || branch.createdAt).toLocaleString('es-ES');

      // 1. Tabla de Ficha Técnica (según los campos marcados)
      if (this.pdfOptions.includeTechSheet) {
        const parents = this.getParentBranches(branch);
        const techRows: [string, string][] = [];
        if (this.pdfOptions.fieldBranch) techRows.push(['Rama', branch.name]);
        if (parents.length > 0) {
          techRows.push(['Rama Padre (Unificada en)', parents.map(p => p.name).join(', ')]);
        }
        if (this.pdfOptions.fieldCategory) techRows.push(['Módulo / Flujo', branch.moduleFlow || 'General']);
        if (this.pdfOptions.fieldFeature) techRows.push(['Feature / Validación', branch.featureTitle || '-']);
        if (this.pdfOptions.fieldState) techRows.push(['Estado Actual', branch.state]);
        if (this.pdfOptions.fieldQaVersions) techRows.push(['Versiones Compilación QA', qaVersionsText]);
        if (this.pdfOptions.fieldDevs) {
          techRows.push(['Devs Involucrados', devsList.length ? devsList.join(', ') : 'Por definir']);
        }
        if (this.pdfOptions.fieldUpdatedAt) techRows.push(['Última Actualización', formattedDate]);

        if (techRows.length > 0) {
          (doc as any).autoTable({
            startY: currentY,
            head: [['Campo', 'Detalle de Trazabilidad']],
            body: techRows,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59], cellPadding: 3 },
            columnStyles: {
              0: { cellWidth: 48, fontStyle: 'bold', fillColor: [248, 250, 252] },
              1: { cellWidth: 'auto' }
            }
          });
          currentY = (doc as any).lastAutoTable.finalY + 8;
        }
      }

      // 2. Objetivos e Integraciones (solo los marcados por el usuario)
      const activeBullets = this.pdfSelectableObjectives
        .filter(o => o.selected)
        .map(o => o.text);

      if (this.pdfOptions.includeObjectives) {
        const objectivesRows = activeBullets.length
          ? activeBullets.map((b, i) => [`${i + 1}`, b])
          : [['-', 'Sin objetivos o commits detallados seleccionados.']];

        (doc as any).autoTable({
          startY: currentY,
          head: [['#', 'Objetivos Cumplidos, Integraciones y Control de Errores']],
          body: objectivesRows,
          theme: 'grid',
          headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59], cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 'auto' }
          }
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // 3. Sub-ramas seleccionadas
      const activeSubBranches = this.pdfSelectableSubBranches
        .filter(s => s.selected)
        .map(s => s.sub);

      if (this.pdfOptions.includeSubBranches && activeSubBranches.length > 0) {
        (doc as any).autoTable({
          startY: currentY,
          head: [['Sub-rama', 'Desarrollador', 'Aporte / Notas']],
          body: activeSubBranches.map(s => [
            s.branchName,
            s.devName || '-',
            s.notesOrCommits || '-'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8, textColor: [30, 41, 59], cellPadding: 2.5 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }

      // 4. Bloque de Plantilla Estricta de MR (si está activado)
      if (this.pdfOptions.includeMrPreview) {
        const moduleName = (branch.moduleFlow || 'General').trim();
        const titleDesc = (branch.featureTitle || branch.name).trim();
        const bodyText =
          activeBullets.length > 0
            ? activeBullets.map(b => `- ${b}`).join('\n')
            : `- Implementación y validación correspondiente a la rama ${branch.name}.`;
        const devsText = devsList.length > 0 ? devsList.join(', ') : 'Por definir';

        const mrPreview =
          `Título: feat(${moduleName}): ${titleDesc}\n\n` +
          `Descripción general del desarrollo u objetivos:\n${bodyText}\n\n` +
          `Devs involucrados:\n${devsText}`;

        (doc as any).autoTable({
          startY: currentY,
          head: [[
            branch.state === 'Certificada'
              ? 'MERGE REQUEST GENERADO (ESTADO: CERTIFICADA)'
              : `PREVISUALIZACIÓN DE MR (PENDIENTE CERTIFICAR — ESTADO ACTUAL: ${branch.state.toUpperCase()})`
          ]],
          body: [[mrPreview]],
          theme: 'grid',
          headStyles: {
            fillColor: branch.state === 'Certificada' ? [5, 150, 105] : [180, 83, 9],
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: 'bold'
          },
          bodyStyles: {
            font: 'courier',
            fontSize: 8,
            textColor: [15, 23, 42],
            fillColor: [248, 250, 252],
            cellPadding: 4
          }
        });
      }

      const safeFile = branch.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Reporte_Rama_${safeFile}.pdf`;
      const pdfArrayBuffer = doc.output('arraybuffer');

      this.showPdfConfigModal = false;
      this.saveFileAndShowNotification(
        fileName,
        new Uint8Array(pdfArrayBuffer),
        'application/pdf'
      );
    } catch (e: any) {
      this.showToast('Error al generar PDF: ' + (e.message || e));
    }
  }

  // --- GESTIÓN DE DISEÑO Y PERSONALIZACIÓN DE EXCEL (exceljs) ---

  openExcelDesignModal(): void {
    this.showExcelDesignModal = true;
    this.showToolsMenu = false;
    setTimeout(() => this.lucide.refresh(), 50);
  }

  closeExcelDesignModal(): void {
    this.showExcelDesignModal = false;
  }

  applyExcelDesignPreset(preset: ExcelDesignPreset): void {
    this.excelDesign.presetId = preset.id;
    this.excelDesign.titleBgColor = preset.titleBgColor;
    this.excelDesign.titleTextColor = preset.titleTextColor;
    this.excelDesign.tableTheme = preset.tableTheme;
  }

  onCustomColorChange(): void {
    const matched = this.excelDesignPresets.find(
      p =>
        p.id !== 'custom' &&
        p.titleBgColor.toLowerCase() === (this.excelDesign.titleBgColor || '').toLowerCase() &&
        p.titleTextColor.toLowerCase() === (this.excelDesign.titleTextColor || '').toLowerCase() &&
        p.tableTheme === this.excelDesign.tableTheme
    );
    this.excelDesign.presetId = matched ? matched.id : 'custom';
  }

  saveExcelDesign(): void {
    try {
      localStorage.setItem(EXCEL_DESIGN_KEY, JSON.stringify(this.excelDesign));
      this.showToast('¡Diseño de Excel guardado correctamente!');
    } catch {}
  }

  resetExcelDesign(): void {
    const defaultPreset = this.excelDesignPresets[0];
    this.applyExcelDesignPreset(defaultPreset);
    this.saveExcelDesign();
  }

  loadExcelDesign(): void {
    try {
      const raw = localStorage.getItem(EXCEL_DESIGN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.titleBgColor && parsed.tableTheme) {
          this.excelDesign = {
            presetId: parsed.presetId || 'indigo',
            titleBgColor: parsed.titleBgColor,
            titleTextColor: parsed.titleTextColor || '#ffffff',
            tableTheme: parsed.tableTheme
          };
        }
      }
    } catch {}
  }

  // --- GENERACIÓN DEL LIBRO EXCEL (.XLSX) PROFESIONAL CON EXCELJS ---

  async buildExcelWorkbookBytes(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ConsoleFlow / Workspace-Hub';
    workbook.lastModifiedBy = 'Tech Lead';
    workbook.created = new Date();
    workbook.modified = new Date();

    const hexToArgb = (hex: string, defaultArgb = 'FF1E1B4B'): string => {
      if (!hex) return defaultArgb;
      let clean = hex.replace('#', '').trim();
      if (clean.length === 3) {
        clean = clean.split('').map(c => c + c).join('');
      }
      if (clean.length === 6) {
        return 'FF' + clean.toUpperCase();
      }
      if (clean.length === 8) {
        return clean.toUpperCase();
      }
      return defaultArgb;
    };

    const titleBgArgb = hexToArgb(this.excelDesign.titleBgColor, 'FF1E1B4B');
    const titleTextArgb = hexToArgb(this.excelDesign.titleTextColor, 'FFFFFFFF');
    const tableTheme = this.excelDesign.tableTheme || 'TableStyleMedium9';
    const profileName = this.activeProfileDisplayName.toUpperCase();

    // =========================================================================
    // HOJA 1: CONTROL DE RAMAS Y TRAZABILIDAD
    // =========================================================================
    const ws1 = workbook.addWorksheet('Control de Ramas', {
      views: [{ state: 'frozen', ySplit: 2 }]
    });

    // Fila 1: Título unificado (12 columnas: A a L)
    ws1.mergeCells('A1:L1');
    const title1 = ws1.getCell('A1');
    title1.value = `CONTROL DE RAMAS, CATEGORÍAS Y VERSIONES QA - ${profileName}`;
    title1.font = { name: 'Calibri', size: 13, bold: true, color: { argb: titleTextArgb } };
    title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: titleBgArgb } };
    title1.alignment = { vertical: 'middle', horizontal: 'center' };
    ws1.getRow(1).height = 32;

    // Ancho de columnas (12 columnas)
    ws1.columns = [
      { key: 'num', width: 6 },
      { key: 'id', width: 28 },
      { key: 'cat', width: 24 },
      { key: 'name', width: 48 },
      { key: 'title', width: 36 },
      { key: 'state', width: 18 },
      { key: 'versions', width: 18 },
      { key: 'devs', width: 26 },
      { key: 'objectives', width: 54 },
      { key: 'subbranches', width: 42 },
      { key: 'folders', width: 36 },
      { key: 'updated', width: 16 }
    ];

    const headers1 = [
      '#',
      'ID de Rama',
      'Categoría (Módulo / Flujo)',
      'Nombre de Rama',
      'Título / Desarrollo',
      'Estado',
      'Versiones QA',
      'Devs Involucrados',
      'Objetivos y Descripción',
      'Sub-ramas Asociadas',
      'Carpeta / Enlace Cloud',
      'Última Actualización'
    ];

    const rows1: any[][] = [];
    if (this.branches.length === 0) {
      rows1.push([
        '-', '-', 'Sin ramas registradas', '-', '-', '-', '-', '-', '-', '-', '-', '-'
      ]);
    } else {
      this.branches.forEach((b, idx) => {
        const bullets = this.extractBulletPointsFromBranch(b);
        const objectivesText = bullets.length
          ? bullets.map(item => `• ${item}`).join('\n')
          : b.objectivesSummary || '-';
        const subBranchesText = (b.subBranches || []).length
          ? b.subBranches
              .map(s => `• ${s.branchName} (${s.devName || 'Dev'}): ${s.notesOrCommits || ''}`)
              .join('\n')
          : '-';
        const devsText = this.collectUniqueDevs([b]).join(', ') || '-';
        const versionsText = (b.qaVersions || []).length
          ? b.qaVersions.map(v => `v${v}`).join(', ')
          : '-';
        const updatedText = new Date(b.updatedAt || b.createdAt).toLocaleDateString('es-ES');
        const folderLinkText = (b.folderLinks || []).length
          ? b.folderLinks.map(fl => `${fl.label ? fl.label + ': ' : ''}${fl.url}`).join('\n')
          : (b.buildFolderUrl || '-');

        rows1.push([
          idx + 1,
          b.id,
          b.moduleFlow || 'General',
          b.name,
          b.featureTitle || '-',
          b.state,
          versionsText,
          devsText,
          objectivesText,
          subBranchesText,
          folderLinkText,
          updatedText
        ]);
      });
    }

    ws1.addTable({
      name: 'TablaControlRamas',
      ref: 'A2',
      headerRow: true,
      totalsRow: false,
      style: {
        theme: (tableTheme as any) || 'TableStyleMedium9',
        showRowStripes: true
      },
      columns: headers1.map(h => ({ name: h, filterButton: true })),
      rows: rows1
    });

    // Formato de celdas para Hoja 1
    ws1.eachRow((row, rowNumber) => {
      if (rowNumber > 2) {
        row.alignment = { vertical: 'middle', wrapText: true };
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(2).font = { name: 'Consolas', size: 9, color: { argb: 'FF64748B' } };
        row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(12).alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    // =========================================================================
    // HOJA 2: DICCIONARIO VERSIONES QA
    // =========================================================================
    const ws2 = workbook.addWorksheet('Diccionario Versiones QA', {
      views: [{ state: 'frozen', ySplit: 2 }]
    });

    // Fila 1: Título unificado
    ws2.mergeCells('A1:F1');
    const title2 = ws2.getCell('A1');
    title2.value = `DICCIONARIO DE VERSIONES QA Y COMPILADOS - ${profileName}`;
    title2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: titleTextArgb } };
    title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: titleBgArgb } };
    title2.alignment = { vertical: 'middle', horizontal: 'center' };
    ws2.getRow(1).height = 32;

    ws2.columns = [
      { key: 'ver', width: 18 },
      { key: 'branch', width: 48 },
      { key: 'cat', width: 24 },
      { key: 'state', width: 18 },
      { key: 'devs', width: 30 },
      { key: 'folder', width: 36 }
    ];

    const headers2 = [
      'Versión QA',
      'Rama Asociada',
      'Categoría (Módulo / Flujo)',
      'Estado Actual',
      'Devs Involucrados',
      'Carpeta / Enlace Cloud'
    ];

    const rows2: any[][] = [];
    if (this.versionDictionary.length === 0) {
      rows2.push(['Sin versiones registradas', '-', '-', '-', '-', '-']);
    } else {
      for (const item of this.versionDictionary) {
        const branchFolder = (item.branch.folderLinks && item.branch.folderLinks.length > 0)
          ? (item.branch.folderLinks.find(fl => fl.isPrimary)?.url || item.branch.folderLinks[0].url)
          : (item.branch.buildFolderUrl || '-');

        rows2.push([
          `v${item.version}`,
          item.branch.name,
          item.branch.moduleFlow || 'General',
          item.branch.state,
          this.collectUniqueDevs([item.branch]).join(', ') || '-',
          branchFolder
        ]);
      }
    }

    ws2.addTable({
      name: 'TablaVersionesQA',
      ref: 'A2',
      headerRow: true,
      totalsRow: false,
      style: {
        theme: (tableTheme as any) || 'TableStyleMedium9',
        showRowStripes: true
      },
      columns: headers2.map(h => ({ name: h, filterButton: true })),
      rows: rows2
    });

    ws2.eachRow((row, rowNumber) => {
      if (rowNumber > 2) {
        row.alignment = { vertical: 'middle', wrapText: true };
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new Uint8Array(buffer);
  }

  async exportAllBranchesExcel(): Promise<void> {
    try {
      const zipBytes = await this.buildExcelWorkbookBytes();
      const fileName = this.driveExcelFileName;
      this.saveFileAndShowNotification(
        fileName,
        zipBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    } catch (e: any) {
      this.showToast('Error al exportar Excel: ' + (e.message || e));
    }
  }

  // --- MENÚ SELECTOR DE HERRAMIENTAS Y OPCIONES ---

  toggleToolsMenu(): void {
    this.showToolsMenu = !this.showToolsMenu;
    if (this.showToolsMenu) {
      setTimeout(() => this.lucide.refresh(), 50);
    }
  }

  // --- SINCRONIZACIÓN Y EXPORTACIÓN DE EXCEL A GOOGLE DRIVE ---

  getDefaultExcelFileName(): string {
    const cleanProfile = (this.activeProfileFile || 'default')
      .replace(/\.json$/i, '')
      .replace(/^gravity[_-]/i, '');
    return `Control_de_Ramas_${cleanProfile || 'default'}.xlsx`;
  }

  get driveExcelFileName(): string {
    let name = (this.customExcelFileName || '').trim();
    if (!name) {
      name = this.getDefaultExcelFileName();
    }
    if (!name.toLowerCase().endsWith('.xlsx')) {
      name += '.xlsx';
    }
    return name;
  }

  loadDriveExcelMetadataForActiveProfile(): void {
    try {
      const profileSlug = (this.activeProfileFile || 'default').replace(/\.json$/i, '');
      const raw = localStorage.getItem(`gravity_drive_excel_${profileSlug}`);
      if (raw) {
        const data = JSON.parse(raw);
        this.driveExcelFileId = data.fileId || null;
        this.driveExcelWebViewLink = data.webViewLink || null;
        this.driveExcelLastSyncTime = data.lastSync || null;
        this.customExcelFileName = data.fileName || this.getDefaultExcelFileName();
      } else {
        this.driveExcelFileId = null;
        this.driveExcelWebViewLink = null;
        this.driveExcelLastSyncTime = null;
        this.customExcelFileName = this.getDefaultExcelFileName();
      }
    } catch {
      this.driveExcelFileId = null;
      this.driveExcelWebViewLink = null;
      this.driveExcelLastSyncTime = null;
      this.customExcelFileName = this.getDefaultExcelFileName();
    }
  }

  async updateExcelFileName(): Promise<void> {
    const name = this.driveExcelFileName;
    this.customExcelFileName = name;
    const profileSlug = (this.activeProfileFile || 'default').replace(/\.json$/i, '');
    localStorage.setItem(
      `gravity_drive_excel_${profileSlug}`,
      JSON.stringify({
        fileId: this.driveExcelFileId,
        webViewLink: this.driveExcelWebViewLink,
        lastSync: this.driveExcelLastSyncTime,
        fileName: name
      })
    );

    if (this.driveExcelFileId && this.googleDrive.isLoggedIn()) {
      try {
        await this.googleDrive.renameDriveFile(this.driveExcelFileId, name);
        this.showToast(`Nombre actualizado en Google Drive: ${name}`);
      } catch {
        this.showToast(`Nombre guardado: ${name}`);
      }
    } else {
      this.showToast(`Nombre guardado: ${name}`);
    }
    setTimeout(() => this.lucide.refresh(), 50);
  }

  async syncExcelToDrive(notifyUser = true): Promise<void> {
    if (!this.googleDrive.isLoggedIn()) {
      if (notifyUser) {
        this.showToast('Conecta primero tu cuenta de Google Drive');
      }
      return;
    }

    if (this.driveExcelSyncing) return;
    this.driveExcelSyncing = true;

    try {
      const rootFolderId = await this.googleDrive.getOrCreateAppFolder();
      const excelFolderId = await this.googleDrive.getOrCreateSubfolder(rootFolderId, 'Excel');
      const fileName = this.driveExcelFileName;

      let fileId = this.driveExcelFileId;
      if (!fileId) {
        const found = await this.googleDrive.findFileInFolder(excelFolderId, fileName);
        if (found) {
          fileId = found.id;
          this.driveExcelFileId = found.id;
        }
      }

      // Construir el Excel con todas las ramas actuales de la app y sus IDs únicos
      const zipBytes = await this.buildExcelWorkbookBytes();

      const result = await this.googleDrive.uploadOrUpdateBinaryFile(
        excelFolderId,
        fileName,
        zipBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      this.driveExcelFileId = result.fileId;
      this.driveExcelWebViewLink =
        result.webViewLink ||
        (result.fileId ? `https://drive.google.com/file/d/${result.fileId}/view` : null);
      this.driveExcelLastSyncTime = Date.now();

      const profileSlug = (this.activeProfileFile || 'default').replace(/\.json$/i, '');
      localStorage.setItem(
        `gravity_drive_excel_${profileSlug}`,
        JSON.stringify({
          fileId: this.driveExcelFileId,
          webViewLink: this.driveExcelWebViewLink,
          lastSync: this.driveExcelLastSyncTime,
          fileName
        })
      );

      if (notifyUser) {
        this.showToast(`Excel sincronizado en Google Drive: ${fileName}`);
      }
    } catch (err: any) {
      console.error('Error sincronizando Excel con Google Drive:', err);
      if (notifyUser) {
        this.showToast('Error al sincronizar con Google Drive: ' + (err.message || err));
      }
    } finally {
      this.driveExcelSyncing = false;
      setTimeout(() => this.lucide.refresh(), 100);
    }
  }

  scheduleDriveExcelSync(): void {
    if (this.driveExcelDebounceTimer) {
      clearTimeout(this.driveExcelDebounceTimer);
    }
    // Debounce de 2 segundos para no sobrecargar Google Drive al teclear cambios rápidos
    this.driveExcelDebounceTimer = setTimeout(() => {
      this.syncExcelToDrive(false);
    }, 2000);
  }

  toggleAutoSyncExcel(): void {
    this.autoSyncExcelToDrive = !this.autoSyncExcelToDrive;
    localStorage.setItem('gravity_auto_sync_excel', String(this.autoSyncExcelToDrive));
    if (this.autoSyncExcelToDrive) {
      this.showToast('Auto-sincronización activada. Se actualizará en Drive al realizar cambios.');
      if (this.googleDrive.isLoggedIn()) {
        this.syncExcelToDrive(true);
      }
    } else {
      this.showToast('Auto-sincronización con Drive desactivada.');
    }
    setTimeout(() => this.lucide.refresh(), 50);
  }

  async openDriveExcelFile(): Promise<void> {
    const url =
      this.driveExcelWebViewLink ||
      (this.driveExcelFileId ? `https://drive.google.com/file/d/${this.driveExcelFileId}/view` : '');
    if (!url) {
      this.showToast('Aún no se ha subido el archivo a Google Drive');
      return;
    }
    await this.electronService.openExternal(url);
  }

  async connectGoogleDrive(): Promise<void> {
    try {
      this.showToast('Iniciando autenticación con Google en tu navegador...');
      await this.googleDrive.login();
      this.showToast('Google Drive conectado exitosamente');
      if (this.autoSyncExcelToDrive) {
        this.syncExcelToDrive(true);
      }
    } catch (e: any) {
      this.showToast(e.message || 'Error conectando a Google Drive');
    }
  }

  // --- IMPORTACIÓN / SINCRONIZACIÓN BIDIRECCIONAL (EXCEL -> APP) ---

  private slugify(text: string): string {
    return (text || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }

  /**
   * Lee un archivo Excel (.xlsx en ArrayBuffer), detecta filas nuevas o modificadas
   * y las fusiona inteligentemente con el workspace de la aplicación.
   * Diseñado con soporte de ID único y reconciliación de eliminaciones bidireccional.
   */
  async parseAndMergeExcelWorkbook(
    buffer: ArrayBuffer
  ): Promise<{ imported: number; updated: number; deleted: number; totalRows: number }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const getCellString = (cell: ExcelJS.Cell | undefined): string => {
      if (!cell || cell.value === null || cell.value === undefined) return '';
      const val = cell.value;
      if (typeof val === 'string') return val.trim();
      if (typeof val === 'number') return String(val);
      if (typeof val === 'object') {
        if ('text' in val) return String((val as any).text || (val as any).hyperlink || '').trim();
        if ('richText' in val && Array.isArray((val as any).richText)) {
          return (val as any).richText.map((r: any) => r.text || '').join('').trim();
        }
        if ('result' in val) return String((val as any).result || '').trim();
      }
      return String(val).trim();
    };

    const ws1 = workbook.getWorksheet('Control de Ramas') || workbook.worksheets[0];
    if (!ws1) {
      throw new Error('El archivo Excel no contiene hojas válidas.');
    }

    // Detección dinámica de índices de columna por encabezado
    let colId = -1;
    let colBranch = 4;
    let colFlow = 3;
    let colTitle = 5;
    let colState = 6;
    let colVersions = 7;
    let colDevs = 8;
    let colObjectives = 9;
    let colSubBranches = 10;
    let colFolders = 11;

    const headerRow = ws1.getRow(2);
    if (headerRow && headerRow.cellCount > 0) {
      headerRow.eachCell((cell, colNumber) => {
        const h = getCellString(cell).toLowerCase();
        if (h.includes('id') || h.includes('identificador')) colId = colNumber;
        else if (h.includes('nombre') && h.includes('rama')) colBranch = colNumber;
        else if (h.includes('categor') || h.includes('flujo') || h.includes('módulo')) colFlow = colNumber;
        else if (h.includes('título') || h.includes('desarrollo')) colTitle = colNumber;
        else if (h.includes('estado')) colState = colNumber;
        else if (h.includes('versiones')) colVersions = colNumber;
        else if (h.includes('devs') || h.includes('desarrollador')) colDevs = colNumber;
        else if (h.includes('objetivo') || h.includes('descrip')) colObjectives = colNumber;
        else if (h.includes('sub-rama') || h.includes('subrama')) colSubBranches = colNumber;
        else if (h.includes('carpeta') || h.includes('enlace') || h.includes('cloud')) colFolders = colNumber;
      });
    }

    let importedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    let totalDataRows = 0;
    const seenExcelBranchIds = new Set<string>();

    ws1.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return; // Omitir banner y cabecera

      // Extraer todas las celdas de la fila (1 a 16)
      const cellTexts: string[] = [];
      let rowHasContent = false;
      for (let c = 1; c <= 16; c++) {
        const val = getCellString(row.getCell(c));
        cellTexts[c] = val;
        if (val && val !== '-' && !val.toLowerCase().includes('sin ramas registradas')) {
          rowHasContent = true;
        }
      }

      if (!rowHasContent) return; // Fila vacía o dummy

      totalDataRows++;

      // 0. Detectar ID explícito de la fila si existe
      let rowId = '';
      if (colId !== -1) {
        if (cellTexts[colId]) {
          const candidate = cellTexts[colId].trim();
          const candLower = candidate.toLowerCase();
          if (
            candidate &&
            candidate !== '-' &&
            candLower !== 'sin id' &&
            candLower !== 'nuevo' &&
            candLower !== 'new' &&
            candLower !== 'none' &&
            candLower !== 'n/a'
          ) {
            rowId = candidate;
          }
        }
      } else {
        // Fallback solo para archivos legados antiguos que no tenían columna de ID:
        const idCandidate = cellTexts.find(c => c && (c.startsWith('branch_') || c.startsWith('gbr_')));
        if (idCandidate) {
          rowId = idCandidate.trim();
        }
      }

      // 1. Detectar nombre de la rama
      let branchName = cellTexts[colBranch] || '';
      // Buscar si alguna otra celda contiene una rama git explícita
      const branchCandidate = cellTexts.find(
        c => c && (c.includes('/') || /^feature|^bugfix|^hotfix|^release|^fix/i.test(c))
      );
      if (branchCandidate) {
        branchName = branchCandidate;
      }

      // Si no hay branchName explícito, derivarlo del título, categoría o número de fila
      if (!branchName || branchName === '-') {
        const titleVal = cellTexts[colTitle] || cellTexts[5] || cellTexts[4] || '';
        const flowVal = cellTexts[colFlow] || cellTexts[3] || cellTexts[2] || '';
        const numVal = cellTexts[1] || '';
        if (titleVal && titleVal !== '-') {
          branchName = 'feature/' + this.slugify(titleVal);
        } else if (flowVal && flowVal !== '-' && flowVal !== 'General') {
          branchName = 'feature/' + this.slugify(flowVal) + (numVal ? '-' + numVal : '');
        } else if (numVal && numVal !== '-') {
          branchName = 'feature/item-' + numVal;
        } else {
          branchName = 'feature/item-fila-' + rowNumber;
        }
      }
      branchName = branchName.trim();

      // 2. Detectar título del desarrollo
      let featureTitle = cellTexts[colTitle] || cellTexts[5] || cellTexts[4] || '';
      if (!featureTitle || featureTitle === '-' || featureTitle === branchName) {
        featureTitle = branchName.replace(/^feature\//i, '').replace(/[-_/]/g, ' ');
        if (featureTitle.length > 0) {
          featureTitle = featureTitle.charAt(0).toUpperCase() + featureTitle.slice(1);
        }
      }

      // 3. Detectar categoría / flujo
      let moduleFlow = cellTexts[colFlow] || cellTexts[3] || cellTexts[2] || 'General';
      if (!moduleFlow || moduleFlow === '-' || moduleFlow === branchName) {
        moduleFlow = 'General';
      }

      // 4. Detectar estado
      let state: BranchLifecycleState = 'En desarrollo';
      const stateCandidate =
        cellTexts.find(c => c && /certif|qa|desarr|prueb|prod|list/i.test(c)) ||
        cellTexts[colState] ||
        '';
      const stLower = stateCandidate.toLowerCase();
      if (stLower.includes('cert') || stLower.includes('prod') || stLower.includes('list')) {
        state = 'Certificada';
      } else if (stLower.includes('qa') || stLower.includes('prueb')) {
        state = 'QA';
      }

      // 5. Parsear versiones QA
      const rawVersions = cellTexts[colVersions] || cellTexts[7] || cellTexts[6] || '';
      const qaVersions: string[] = [];
      if (rawVersions && rawVersions !== '-') {
        const vTokens = rawVersions
          .split(/[,;\n]+/)
          .map(v => v.replace(/^v/i, '').trim())
          .filter(Boolean);
        qaVersions.push(...Array.from(new Set(vTokens)));
      }
      // Escaneo secundario de versiones en otras celdas
      cellTexts.forEach(c => {
        if (c && /v?\d+\.\d+(\.\d+)?/i.test(c)) {
          const match = c.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
          if (match && match[1] && !qaVersions.includes(match[1])) {
            qaVersions.push(match[1]);
          }
        }
      });

      // 6. Parsear desarrolladores
      const rawDevs = cellTexts[colDevs] || cellTexts[8] || cellTexts[7] || '';
      const devs: string[] = [];
      if (rawDevs && rawDevs !== '-') {
        const dTokens = rawDevs
          .split(/[,;\n]+/)
          .map(d => d.trim())
          .filter(Boolean);
        devs.push(...Array.from(new Set(dTokens)));
      }

      // 7. Parsear objetivos / observaciones
      const rawObjectives = cellTexts[colObjectives] || cellTexts[9] || cellTexts[8] || '';
      const objectivesSummary = rawObjectives === '-' ? '' : rawObjectives;

      // 8. Parsear carpetas y enlaces
      const rawFolders = cellTexts[colFolders] || cellTexts[11] || cellTexts[10] || '';
      let buildFolderUrl = '';
      const folderLinks: BranchFolderLink[] = [];
      if (rawFolders && rawFolders !== '-') {
        const lines = rawFolders.split('\n').map(l => l.trim()).filter(Boolean);
        lines.forEach((line, idx) => {
          let label = 'Cloud';
          let url = line;
          if (line.includes(': http')) {
            const parts = line.split(': http');
            label = parts[0].trim();
            url = 'http' + parts[1].trim();
          } else if (line.includes(': https')) {
            const parts = line.split(': https');
            label = parts[0].trim();
            url = 'https' + parts[1].trim();
          }
          folderLinks.push({
            id: 'fl_' + Date.now() + '_' + idx,
            label,
            url,
            isPrimary: idx === 0
          });
        });
        if (folderLinks.length > 0) {
          buildFolderUrl = folderLinks[0].url;
        }
      }

      // 9. Parsear sub-ramas
      const rawSubBranches = cellTexts[colSubBranches] || cellTexts[10] || cellTexts[9] || '';
      const subBranches: SubBranchContext[] = [];
      if (rawSubBranches && rawSubBranches !== '-') {
        const sLines = rawSubBranches
          .split('\n')
          .map(l => l.replace(/^[•\-\*]\s*/, '').trim())
          .filter(Boolean);
        sLines.forEach((sLine, sIdx) => {
          let sName = sLine;
          let sDev = '';
          let sNotes = '';
          const match = sLine.match(/^([^\(\:]+)(?:\((.*?)\))?(?:\:\s*(.*))?$/);
          if (match) {
            sName = (match[1] || '').trim();
            sDev = (match[2] || '').trim();
            sNotes = (match[3] || '').trim();
          }
          if (sName) {
            subBranches.push({
              id: 'sub_' + Date.now() + '_' + sIdx,
              branchName: sName,
              devName: sDev,
              notesOrCommits: sNotes
            });
          }
        });
      }

      // 10. Buscar si la rama ya existe en el espacio de trabajo
      let existingBranch: TrackedBranch | undefined;
      if (rowId) {
        // Si la fila tiene ID único, buscar la rama exacta por ID
        existingBranch = this.branches.find(b => b.id === rowId);
      } else if (colId === -1 && branchName && branchName !== '-') {
        // Solo para archivos antiguos sin columna de ID: buscar por nombre de rama
        existingBranch = this.branches.find(
          b => b.name.trim().toLowerCase() === branchName.toLowerCase()
        );
      }
      // NOTA: Si el Excel tiene columna de ID y esta fila no tiene ID (está vacía o es nueva),
      // existingBranch queda undefined y el sistema la toma automáticamente como un ITEM NUEVO.

      if (existingBranch) {
        seenExcelBranchIds.add(existingBranch.id);
        let changed = false;

        if (branchName && branchName !== '-' && existingBranch.name !== branchName) {
          existingBranch.name = branchName;
          changed = true;
        }
        if (moduleFlow && moduleFlow !== 'General' && existingBranch.moduleFlow !== moduleFlow) {
          existingBranch.moduleFlow = moduleFlow;
          changed = true;
        }
        if (featureTitle && featureTitle !== '-' && existingBranch.featureTitle !== featureTitle) {
          existingBranch.featureTitle = featureTitle;
          changed = true;
        }
        if (stateCandidate && existingBranch.state !== state) {
          existingBranch.state = state;
          changed = true;
        }
        if (qaVersions.length > 0) {
          const merged = Array.from(new Set([...(existingBranch.qaVersions || []), ...qaVersions]));
          if (merged.length !== (existingBranch.qaVersions || []).length) {
            existingBranch.qaVersions = merged;
            changed = true;
          }
        }
        if (devs.length > 0) {
          const mergedDevs = Array.from(new Set([...(existingBranch.devs || []), ...devs]));
          if (mergedDevs.length !== (existingBranch.devs || []).length) {
            existingBranch.devs = mergedDevs;
            changed = true;
          }
        }
        if (objectivesSummary && objectivesSummary !== '-' && existingBranch.objectivesSummary !== objectivesSummary) {
          existingBranch.objectivesSummary = objectivesSummary;
          changed = true;
        }
        if (folderLinks.length > 0 && (!existingBranch.folderLinks || existingBranch.folderLinks.length === 0)) {
          existingBranch.folderLinks = folderLinks;
          existingBranch.buildFolderUrl = buildFolderUrl;
          changed = true;
        }
        if (subBranches.length > 0 && (!existingBranch.subBranches || existingBranch.subBranches.length === 0)) {
          existingBranch.subBranches = subBranches;
          changed = true;
        }
        if (changed) {
          existingBranch.updatedAt = new Date().toISOString();
          updatedCount++;
        }
      } else {
        // NUEVA RAMA AGREGADA EN EXCEL
        const finalId = rowId || ('branch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
        const newBranch: TrackedBranch = {
          id: finalId,
          name: branchName,
          moduleFlow: moduleFlow || 'General',
          featureTitle: featureTitle || branchName,
          state: state,
          qaVersions: qaVersions,
          devs: devs,
          objectivesSummary: objectivesSummary,
          rawCommitsOrDiff: '',
          subBranches: subBranches,
          buildFolderUrl: buildFolderUrl,
          folderLinks: folderLinks,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        this.branches.unshift(newBranch);
        seenExcelBranchIds.add(finalId);
        importedCount++;
      }

      // Auto-registro en catálogos disponibles para autocompletado
      devs.forEach(d => {
        if (d && !this.availableDevs.includes(d)) this.availableDevs.push(d);
      });
      if (moduleFlow && moduleFlow !== 'General' && !this.availableFlows.includes(moduleFlow)) {
        this.availableFlows.push(moduleFlow);
      }
    });

    // Reconciliación de eliminaciones:
    // Si el Excel tiene columna de ID y al menos 1 fila de datos, cualquier rama que existía
    // en la app pero ya NO existe en el Excel ha sido eliminada intencionalmente por el usuario en Excel.
    if (colId !== -1 && totalDataRows > 0 && seenExcelBranchIds.size > 0) {
      const initialCount = this.branches.length;
      const branchesToKeep = this.branches.filter(b => seenExcelBranchIds.has(b.id));
      deletedCount = initialCount - branchesToKeep.length;
      if (deletedCount > 0) {
        this.branches = branchesToKeep;
      }
    }

    // Sincronizar también Sheet 2 (Diccionario Versiones QA) si existe
    const ws2 = workbook.getWorksheet('Diccionario Versiones QA');
    if (ws2) {
      ws2.eachRow((row, rowNumber) => {
        if (rowNumber <= 2) return;
        const rawVer = getCellString(row.getCell(1)).replace(/^v/i, '').trim();
        const rawBranch = getCellString(row.getCell(2)).trim();
        if (rawVer && rawBranch) {
          const target = this.branches.find(b => b.name.trim().toLowerCase() === rawBranch.toLowerCase());
          if (target) {
            if (!target.qaVersions) target.qaVersions = [];
            if (!target.qaVersions.includes(rawVer)) {
              target.qaVersions.push(rawVer);
              target.updatedAt = new Date().toISOString();
            }
          }
        }
      });
    }

    if (importedCount > 0 || updatedCount > 0 || deletedCount > 0) {
      await this.persistActiveProfileToDisk();
      if (this.branches.length > 0) {
        if (!this.selectedBranchId || !this.branches.find(b => b.id === this.selectedBranchId)) {
          this.selectBranch(this.branches[0].id);
        }
      } else {
        this.selectedBranchId = null;
      }
      this.syncDiskFolderCandidates();
    }

    return { imported: importedCount, updated: updatedCount, deleted: deletedCount, totalRows: totalDataRows };
  }

  /**
   * Descarga el archivo Excel desde Google Drive y fusiona los cambios con la app.
   */
  async importExcelFromDrive(): Promise<void> {
    if (!this.googleDrive.isLoggedIn()) {
      this.showToast('Conecta primero tu cuenta de Google Drive');
      return;
    }

    this.driveExcelImporting = true;
    try {
      let fileId = this.driveExcelFileId;
      if (!fileId) {
        const rootFolderId = await this.googleDrive.getOrCreateAppFolder();
        const excelFolderId = await this.googleDrive.getOrCreateSubfolder(rootFolderId, 'Excel');
        const found = await this.googleDrive.findFileInFolder(excelFolderId, this.driveExcelFileName);
        if (found) {
          fileId = found.id;
          this.driveExcelFileId = found.id;
        }
      }

      if (!fileId) {
        this.showToast(`No se encontró el archivo ${this.driveExcelFileName} en Google Drive.`);
        return;
      }

      const buffer = await this.googleDrive.readBinaryFile(fileId);
      const res = await this.parseAndMergeExcelWorkbook(buffer);

      if (res.imported > 0 || res.updated > 0 || res.deleted > 0) {
        const parts: string[] = [];
        if (res.imported > 0) parts.push(`${res.imported} nuevas`);
        if (res.updated > 0) parts.push(`${res.updated} actualizadas`);
        if (res.deleted > 0) parts.push(`${res.deleted} eliminadas`);
        this.showToast(
          `¡Sincronización exitosa! Se procesaron: ${parts.join(', ')} desde Google Drive.`
        );
      } else {
        this.showToast(`El espacio de trabajo ya está al día con Google Drive (${res.totalRows} ramas analizadas).`);
      }
    } catch (e: any) {
      this.showToast('Error al importar desde Google Drive: ' + (e.message || e));
    } finally {
      this.driveExcelImporting = false;
      this.showToolsMenu = false;
      setTimeout(() => this.lucide.refresh(), 50);
    }
  }

  /**
   * Carga un archivo Excel local seleccionado por el usuario y fusiona los cambios.
   */
  async onLocalExcelFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    this.localExcelImporting = true;
    try {
      const buffer = await file.arrayBuffer();
      const res = await this.parseAndMergeExcelWorkbook(buffer);

      if (res.imported > 0 || res.updated > 0 || res.deleted > 0) {
        const parts: string[] = [];
        if (res.imported > 0) parts.push(`${res.imported} nuevas`);
        if (res.updated > 0) parts.push(`${res.updated} actualizadas`);
        if (res.deleted > 0) parts.push(`${res.deleted} eliminadas`);
        this.showToast(
          `¡Importación exitosa! Se procesaron: ${parts.join(', ')} desde "${file.name}".`
        );
      } else {
        this.showToast(`No se encontraron cambios en "${file.name}" (${res.totalRows} ramas analizadas).`);
      }
    } catch (e: any) {
      this.showToast('Error al leer el archivo Excel: ' + (e.message || e));
    } finally {
      this.localExcelImporting = false;
      input.value = '';
      this.showToolsMenu = false;
      setTimeout(() => this.lucide.refresh(), 50);
    }
  }

  getFormattedLastSyncTime(): string {
    if (!this.driveExcelLastSyncTime) return 'Nunca sincronizado';
    const diff = Date.now() - this.driveExcelLastSyncTime;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hace unos segundos';
    if (mins === 1) return 'Hace 1 minuto';
    if (mins < 60) return `Hace ${mins} minutos`;
    return new Date(this.driveExcelLastSyncTime).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private saveFileAndShowNotification(
    fileName: string,
    bytes: Uint8Array,
    mimeType: string
  ): void {
    let savedFullPath = '';
    try {
      const win = window as any;
      if (win.require) {
        const fs = win.require('fs');
        const path = win.require('path');
        const os = win.require('os');
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        if (fs.existsSync(downloadsDir)) {
          savedFullPath = path.join(downloadsDir, fileName);
          fs.writeFileSync(savedFullPath, win.Buffer ? win.Buffer.from(bytes) : bytes);
        }
      }
    } catch {
      savedFullPath = '';
    }

    if (!savedFullPath) {
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    this.showDownloadNotification(fileName, savedFullPath);
  }

  showDownloadNotification(fileName: string, fullPath = ''): void {
    this.downloadFileName = fileName;
    this.downloadFilePath = fullPath;
    this.downloadNotificationVisible = true;
    if (this.downloadTimer) clearTimeout(this.downloadTimer);
    this.downloadTimer = setTimeout(() => {
      this.downloadNotificationVisible = false;
    }, 9000);
    this.lucide.refresh();
  }

  closeDownloadNotification(event?: Event): void {
    if (event) event.stopPropagation();
    this.downloadNotificationVisible = false;
    if (this.downloadTimer) clearTimeout(this.downloadTimer);
  }

  openDownloadedFileFolder(): void {
    try {
      const win = window as any;
      if (win.require) {
        const electron = win.require('electron');
        const path = win.require('path');
        const os = win.require('os');
        const fs = win.require('fs');
        const targetPath =
          this.downloadFilePath ||
          path.join(os.homedir(), 'Downloads', this.downloadFileName || '');

        if (electron?.shell) {
          if (targetPath && fs.existsSync(targetPath)) {
            electron.shell.showItemInFolder(targetPath);
          } else {
            electron.shell.openPath(path.join(os.homedir(), 'Downloads'));
          }
          this.downloadNotificationVisible = false;
          return;
        }
      }
    } catch {
      // Fallback al endpoint del servidor local
    }

    fetch('/api/system/open-downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: this.downloadFileName })
    }).catch(() => {});
    this.downloadNotificationVisible = false;
  }

  // --- UTILIDADES ---

  async copyBranchName(branchName: string, key = '', event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    const clean = (branchName || '').trim();
    if (!clean) return;
    try {
      await navigator.clipboard.writeText(clean);
      if (key) {
        this.copiedKey = key;
        if (this.copiedTimer) clearTimeout(this.copiedTimer);
        this.copiedTimer = setTimeout(() => {
          this.copiedKey = null;
        }, 1600);
      }
      this.showToast(`Rama copiada: ${clean}`);
    } catch {
      this.showToast('No se pudo copiar automáticamente');
    }
  }

  async copySelectedBlockBranchNames(): Promise<void> {
    const names = this.selectedBlockBranches.map(b => b.name).join('\n');
    if (!names) return;
    await this.copyText(names);
  }

  async copyText(text: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copiado al portapapeles');
    } catch {
      this.showToast('No se pudo copiar automáticamente');
    }
  }

  getStateBadgeClass(state: BranchLifecycleState): string {
    switch (state) {
      case 'Certificada':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'QA':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      default:
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    }
  }

  getStateDotClass(state: BranchLifecycleState): string {
    switch (state) {
      case 'Certificada':
        return 'bg-emerald-400';
      case 'QA':
        return 'bg-amber-400';
      default:
        return 'bg-indigo-400';
    }
  }

  showToast(msg: string): void {
    this.toastMsg = msg;
    this.toastVisible = true;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
    }, 2800);
  }

  // --- GENERADOR DE PLANTILLA DE CORREO DE LIBERACIÓN POR VERSIÓN ---

  openEmailTemplateModal(branch?: TrackedBranch | null, targetVersion?: string): void {
    const target = branch || this.selectedBranch || (this.branches.length > 0 ? this.branches[0] : null);
    this.emailTargetBranch = target;

    // 1. Saludo automático según la hora local actual (días < 12h, tardes < 19h, noches >= 19h)
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) {
      this.emailGreetingTime = 'dias';
    } else if (currentHour >= 12 && currentHour < 19) {
      this.emailGreetingTime = 'tardes';
    } else {
      this.emailGreetingTime = 'noches';
    }
    this.emailCustomGreeting = '';

    // 2. Versión de compilación: por defecto la última vinculada a la rama
    this.emailBranchVersions = target?.qaVersions ? [...target.qaVersions] : [];
    if (targetVersion) {
      this.emailVersion = targetVersion;
    } else if (this.emailBranchVersions.length > 0) {
      this.emailVersion = this.emailBranchVersions[this.emailBranchVersions.length - 1];
    } else if (this.versionDictionary.length > 0) {
      this.emailVersion = this.versionDictionary[0].version;
    } else {
      this.emailVersion = '';
    }

    // 3. Plataformas por defecto
    this.emailPlatforms = 'IOS y Android';

    // 4. Contenido del desarrollo (prellenar de forma amigable a partir del featureTitle)
    const rawTitle = (target?.featureTitle || target?.name || '').trim();
    if (rawTitle) {
      const lower = rawTitle.toLowerCase();
      if (lower.startsWith('el desarrollo de ') || lower.startsWith('desarrollo de ')) {
        this.emailContent = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
      } else if (lower.startsWith('el desarrollo ')) {
        this.emailContent = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
      } else {
        this.emailContent = `El desarrollo de ${rawTitle}`;
      }
    } else {
      this.emailContent = 'El desarrollo de ';
    }

    // 5. Carpeta de compilados (prioridad: carpeta guardada en la rama activa > última ingresada)
    const branchFolder = target?.buildFolderUrl || (target?.folderLinks && target.folderLinks.length > 0 ? target.folderLinks[0].url : '');
    this.emailBuildFolder = branchFolder || localStorage.getItem(EMAIL_LAST_BUILD_FOLDER_KEY) || '';

    // 6. Asunto del correo
    this.updateEmailSubject();

    // 7. Cargar lista de contactos guardados
    this.loadSavedEmailContacts();

    this.emailModalTab = 'preview';
    this.showEmailTemplateModal = true;
    setTimeout(() => this.lucide.refresh(), 50);
  }

  saveEmailBuildFolderToBranch(): void {
    if (!this.emailTargetBranch) return;
    const cleanUrl = (this.emailBuildFolder || '').trim();
    if (!cleanUrl) return;

    this.emailTargetBranch.buildFolderUrl = cleanUrl;
    this.emailTargetBranch.folderLinks = this.emailTargetBranch.folderLinks || [];
    const exists = this.emailTargetBranch.folderLinks.find(f => f.url.toLowerCase() === cleanUrl.toLowerCase());
    if (!exists) {
      this.emailTargetBranch.folderLinks.unshift({
        id: 'fl_' + Date.now(),
        label: this.inferFolderLabel(cleanUrl),
        url: cleanUrl,
        isPrimary: true
      });
    }
    this.emailTargetBranch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.showToast('Dirección de carpeta guardada en esta rama');
  }

  // --- GESTIÓN DE ENLACES / CARPETAS EN LA NUBE POR RAMA (DRIVE, RED, ONEDRIVE) ---

  inferFolderLabel(url: string): string {
    if (!url) return 'Carpeta en la nube';
    const lower = url.toLowerCase();
    if (lower.includes('drive.google.com')) return 'Google Drive';
    if (lower.includes('onedrive') || lower.includes('sharepoint')) return 'OneDrive / SharePoint';
    if (lower.includes('dropbox.com')) return 'Dropbox';
    if (lower.includes('icloud.com')) return 'iCloud';
    if (lower.startsWith('\\\\') || /^[a-zA-Z]:\\/.test(url)) return 'Carpeta Red / Local';
    return 'Carpeta en la nube';
  }

  addFolderLinkToBranch(branch: TrackedBranch): void {
    const rawUrl = this.branchFolderUrlInput.trim();
    if (!rawUrl) {
      this.showToast('Ingresa el link o ruta de la carpeta');
      return;
    }

    branch.folderLinks = branch.folderLinks || [];
    const label = this.branchFolderLabelInput.trim() || this.inferFolderLabel(rawUrl);
    const isFirst = branch.folderLinks.length === 0;

    const newLink: BranchFolderLink = {
      id: 'fl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      label,
      url: rawUrl,
      isPrimary: isFirst || !branch.buildFolderUrl
    };

    branch.folderLinks.push(newLink);
    if (isFirst || !branch.buildFolderUrl) {
      branch.buildFolderUrl = rawUrl;
    }

    this.branchFolderUrlInput = '';
    this.branchFolderLabelInput = '';
    this.showAddFolderLinkInput = false;
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.showToast(`Dirección de carpeta guardada: ${label}`);
    setTimeout(() => this.lucide.refresh(), 50);
  }

  removeFolderLinkFromBranch(branch: TrackedBranch, linkId: string, event?: Event): void {
    if (event) event.stopPropagation();
    branch.folderLinks = (branch.folderLinks || []).filter(fl => fl.id !== linkId);
    if (branch.folderLinks.length > 0) {
      if (!branch.folderLinks.some(fl => fl.isPrimary)) {
        branch.folderLinks[0].isPrimary = true;
        branch.buildFolderUrl = branch.folderLinks[0].url;
      }
    } else {
      branch.buildFolderUrl = '';
    }
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.showToast('Dirección de carpeta eliminada de la rama');
    setTimeout(() => this.lucide.refresh(), 50);
  }

  setPrimaryFolderLink(branch: TrackedBranch, linkId: string, event?: Event): void {
    if (event) event.stopPropagation();
    branch.folderLinks = branch.folderLinks || [];
    for (const fl of branch.folderLinks) {
      fl.isPrimary = fl.id === linkId;
      if (fl.isPrimary) {
        branch.buildFolderUrl = fl.url;
      }
    }
    branch.updatedAt = new Date().toISOString();
    this.saveWorkspace();
    this.showToast('Carpeta establecida como principal para envíos');
  }

  openFolderLink(url: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!url) return;
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      this.electronService.openExternal(trimmed);
    } else {
      this.copyText(trimmed);
      this.showToast('Ruta de carpeta copiada al portapapeles');
    }
  }

  async copyFolderLink(url: string, key?: string, event?: Event): Promise<void> {
    if (event) event.stopPropagation();
    if (!url) return;
    await this.copyText(url);
    if (key) {
      this.copiedKey = key;
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => (this.copiedKey = null), 2000);
    }
    this.showToast('Enlace copiado al portapapeles');
  }

  closeEmailTemplateModal(): void {
    this.showEmailTemplateModal = false;
  }

  setEmailGreetingTime(time: 'tardes' | 'dias' | 'noches'): void {
    this.emailGreetingTime = time;
    this.emailCustomGreeting = '';
  }

  setEmailVersion(ver: string): void {
    this.emailVersion = (ver || '').trim();
    this.updateEmailSubject();
  }

  setEmailPlatforms(plat: string): void {
    this.emailPlatforms = plat;
    this.updateEmailSubject();
  }

  onEmailBuildFolderChange(): void {
    try {
      localStorage.setItem(EMAIL_LAST_BUILD_FOLDER_KEY, this.emailBuildFolder || '');
    } catch {}
  }

  updateEmailSubject(): void {
    const ver = this.emailVersion.trim() ? `v${this.emailVersion.trim()} ` : '';
    const plat = this.emailPlatforms.trim() ? `${this.emailPlatforms.trim()} - ` : '';
    let featureDesc = this.emailContent.trim();
    if (featureDesc.toLowerCase().startsWith('el desarrollo de ')) {
      featureDesc = featureDesc.substring(17);
    }
    const cleanFeature = featureDesc.slice(0, 50).trim();
    this.emailSubject = `Compilado Liberado ${ver}${plat}${cleanFeature || 'Entrega QA'}`.trim();
  }

  get emailGreetingText(): string {
    if (this.emailCustomGreeting && this.emailCustomGreeting.trim()) {
      return this.emailCustomGreeting.trim();
    }
    if (this.emailGreetingTime === 'dias') {
      return 'Buenos días, estimados un gusto saludarles,';
    }
    if (this.emailGreetingTime === 'noches') {
      return 'Buenas noches, estimados un gusto saludarles,';
    }
    return 'Buenas tardes, estimados un gusto saludarles,';
  }

  get emailBuildPlatformHeader(): string {
    const p = (this.emailPlatforms || '').toLowerCase();
    if (p.includes('ios') && !p.includes('android')) {
      return 'Compilados iOS';
    }
    return 'Compilados Android';
  }

  get formattedEmailBody(): string {
    const greeting = this.emailGreetingText;
    const version = this.emailVersion.trim() || '[versión]';
    const platforms = this.emailPlatforms.trim();
    const versionLine = platforms
      ? `La versión es la ${version} ${platforms}`
      : `La versión es la ${version}`;
    const content = this.emailContent.trim() || '[desarrollo incluido]';
    const folder = this.emailBuildFolder.trim() || '[carpeta de compilados]';
    const headerCompilados = this.emailBuildPlatformHeader;

    return `${greeting}

Para comentar que ya se encuentra liberado el compilado con 

 
${versionLine} 

Contiene
${content} 

${headerCompilados} 
En la siguiente carpeta encontraran los compilados correspondientes
${folder}



Cualquier inquietud quedo a la orden

Saludos`;
  }

  // --- GESTIÓN DE CONTACTOS / CORREOS DESTINATARIOS GUARDADOS ---

  loadSavedEmailContacts(): void {
    try {
      const raw = localStorage.getItem(EMAIL_CONTACTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.savedEmailContacts = parsed
            .map(c => ({
              id: c.id || 'cnt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              email: String(c.email || '').trim(),
              name: c.name ? String(c.name).trim() : '',
              type: (c.type === 'cc' ? 'cc' : 'to') as ('to' | 'cc'),
              selected: c.selected !== false
            }))
            .filter(c => !!c.email);
          return;
        }
      }
    } catch {}

    if (!this.savedEmailContacts) {
      this.savedEmailContacts = [];
    }
  }

  saveEmailContactsToStorage(): void {
    try {
      localStorage.setItem(EMAIL_CONTACTS_KEY, JSON.stringify(this.savedEmailContacts));
      this.saveWorkspace();
    } catch {}
  }

  addEmailContact(): void {
    const email = this.newContactEmail.trim();
    if (!email) {
      this.showToast('Ingresa un correo electrónico');
      return;
    }
    if (!email.includes('@')) {
      this.showToast('El formato del correo debe contener @');
      return;
    }
    const name = this.newContactName.trim();
    const type = this.newContactType;

    const exists = this.savedEmailContacts.some(
      c => c.email.toLowerCase() === email.toLowerCase() && c.type === type
    );
    if (exists) {
      this.showToast(`El correo ${email} ya existe en ${type.toUpperCase()}`);
      return;
    }

    this.savedEmailContacts.push({
      id: 'cnt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      email,
      name,
      type,
      selected: true
    });

    this.newContactEmail = '';
    this.newContactName = '';
    this.saveEmailContactsToStorage();
    this.showToast(`Correo ${email} guardado`);
    setTimeout(() => this.lucide.refresh(), 40);
  }

  removeEmailContact(id: string): void {
    this.savedEmailContacts = this.savedEmailContacts.filter(c => c.id !== id);
    this.saveEmailContactsToStorage();
    this.showToast('Correo eliminado');
    setTimeout(() => this.lucide.refresh(), 40);
  }

  toggleContactSelection(contact: ReleaseEmailContact): void {
    contact.selected = !contact.selected;
    this.saveEmailContactsToStorage();
  }

  toggleContactType(contact: ReleaseEmailContact): void {
    contact.type = contact.type === 'to' ? 'cc' : 'to';
    this.saveEmailContactsToStorage();
  }

  selectAllContacts(selected: boolean): void {
    for (const c of this.savedEmailContacts) {
      c.selected = selected;
    }
    this.saveEmailContactsToStorage();
  }

  get toEmailsList(): string[] {
    return this.savedEmailContacts
      .filter(c => c.type === 'to' && c.selected && c.email)
      .map(c => c.email.trim());
  }

  get ccEmailsList(): string[] {
    return this.savedEmailContacts
      .filter(c => c.type === 'cc' && c.selected && c.email)
      .map(c => c.email.trim());
  }

  get toEmailsString(): string {
    return this.toEmailsList.join(', ');
  }

  get ccEmailsString(): string {
    return this.ccEmailsList.join(', ');
  }

  get allSelectedEmailsString(): string {
    const list = [...this.toEmailsList, ...this.ccEmailsList];
    return Array.from(new Set(list)).join(', ');
  }

  async copyEmailSubject(): Promise<void> {
    await this.copyText(this.emailSubject);
    this.showToast('Asunto copiado');
  }

  async copyEmailRecipients(mode: 'to' | 'cc' | 'all'): Promise<void> {
    let text = '';
    if (mode === 'to') text = this.toEmailsString;
    else if (mode === 'cc') text = this.ccEmailsString;
    else text = this.allSelectedEmailsString;

    if (!text) {
      this.showToast(`No hay correos seleccionados en ${mode.toUpperCase()}`);
      return;
    }
    await this.copyText(text);
    this.showToast(`Destinatarios (${mode.toUpperCase()}) copiados`);
  }

  async copyEmailBody(): Promise<void> {
    await this.copyText(this.formattedEmailBody);
    this.showToast('Cuerpo del correo copiado');
  }

  async copyEntireEmailBundle(): Promise<void> {
    const to = this.toEmailsString ? `Para: ${this.toEmailsString}\n` : '';
    const cc = this.ccEmailsString ? `CC: ${this.ccEmailsString}\n` : '';
    const subject = this.emailSubject ? `Asunto: ${this.emailSubject}\n\n` : '';
    const full = `${to}${cc}${subject}${this.formattedEmailBody}`;
    await this.copyText(full);
    this.showToast('Correo completo (Destinatarios + Asunto + Cuerpo) copiado');
  }

  openInEmailClient(): void {
    const to = encodeURIComponent(this.toEmailsString);
    const cc = encodeURIComponent(this.ccEmailsString);
    const subject = encodeURIComponent(this.emailSubject);
    const body = encodeURIComponent(this.formattedEmailBody);

    let mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;
    if (cc) {
      mailtoUrl += `&cc=${cc}`;
    }
    window.open(mailtoUrl, '_blank');
  }
}

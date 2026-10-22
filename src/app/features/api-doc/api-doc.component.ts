import { Component, OnInit, AfterViewInit, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DocApiService, DocExplorerItem } from '../../core/services/doc-api.service';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { ElectronService } from '../../core/services/electron.service';
import { ConsoleFlowApiService } from '../../core/services/console-flow-api.service';
import { ApiExplorerSidebarComponent } from './components/api-explorer-sidebar/api-explorer-sidebar.component';
import { ApiDocEditorComponent } from './components/api-doc-editor/api-doc-editor.component';
import { ApiFolderModalComponent } from './components/api-folder-modal/api-folder-modal.component';
import { NoteTab } from './models/api-doc.models';

@Component({
  selector: 'app-api-doc',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ApiExplorerSidebarComponent,
    ApiDocEditorComponent,
    ApiFolderModalComponent
  ],
  templateUrl: './api-doc.component.html',
  styleUrls: ['./api-doc.component.css']
})
export class ApiDocComponent implements OnInit, AfterViewInit, AfterViewChecked {
  // Pestañas (Estilo Bloc de notas de Windows)
  tabs: NoteTab[] = [];
  activeTabId = '';
  private tabCounter = 1;

  // Responsividad y Sidebar
  sidebarOpen = true;

  // Directorios de Windows
  currentRoot = ''; // Carpeta base personalizada (o vacía para carpeta api_docs de la app)
  defaultDocsDir = ''; // Directorio por defecto de la app
  currentFolder = ''; // Subcarpeta relativa a la carpeta raíz
  items: DocExplorerItem[] = [];

  saving = false;

  // Modales y Notificaciones
  showFolderModal = false;
  showFileModal = false;
  showRenameModal = false;
  renameTargetItem: DocExplorerItem | null = null;

  showConfirmModal = false;
  confirmTitle = '';
  confirmText = '';
  private confirmCallback: (() => void) | null = null;

  toastVisible = false;
  toastMsg = 'Acción completada';
  toastIcon = 'check-circle';
  toastColor = 'text-indigo-400';
  private toastTimeout: any;

  constructor(
    private docApi: DocApiService,
    private lucide: LucideIconService,
    private electronService: ElectronService,
    private consoleApi: ConsoleFlowApiService
  ) {}

  async ngOnInit(): Promise<void> {
    // En pantallas pequeñas, iniciar con el panel lateral colapsado
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.sidebarOpen = false;
    }

    // Recuperar carpeta personalizada si el usuario la configuró previamente
    this.currentRoot = localStorage.getItem('apiDoc_customRoot') || '';

    try {
      const info = await this.docApi.getDocInfo();
      this.defaultDocsDir = info.defaultDocsDir;
    } catch {}

    // Inicializar con una primera pestaña si está vacío
    if (this.tabs.length === 0) {
      this.createNewTab();
    }

    await this.refreshExplorer('');
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

  ngAfterViewChecked(): void {
    this.lucide.refresh();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    this.lucide.refresh();
  }

  // Atajos de teclado estilo Bloc de Notas
  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.saveActiveTab();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
      event.preventDefault();
      this.createNewTab();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      if (this.activeTab) {
        this.closeTab(this.activeTab.id);
      }
    }
  }

  get activeTab(): NoteTab | null {
    if (!this.tabs || this.tabs.length === 0) return null;
    return this.tabs.find(t => t.id === this.activeTabId) || this.tabs[0];
  }

  get activeFilePath(): string {
    return this.activeTab?.path || '';
  }

  // --- GESTIÓN DE PESTAÑAS (TABS) ---

  createNewTab(name?: string, content = '', path?: string, isNew = true): NoteTab {
    const defaultName = name || `Sin título ${this.tabCounter++}.txt`;
    const lower = defaultName.toLowerCase();
    let fileType: 'json' | 'txt' | 'md' | 'other' = 'txt';
    if (lower.endsWith('.json')) fileType = 'json';
    else if (lower.endsWith('.md')) fileType = 'md';

    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTab: NoteTab = {
      id: tabId,
      name: defaultName,
      path,
      content,
      savedContent: isNew ? '' : content,
      fileType,
      isDirty: isNew && content.length > 0,
      isNew
    };

    this.tabs.push(newTab);
    this.activeTabId = newTab.id;
    this.lucide.refresh();
    return newTab;
  }

  selectTab(id: string): void {
    this.activeTabId = id;
    this.lucide.refresh();
  }

  closeTab(tabId: string): void {
    const idx = this.tabs.findIndex(t => t.id === tabId);
    if (idx === -1) return;

    const targetTab = this.tabs[idx];

    // Si tiene cambios sin guardar, solicitar confirmación
    if (targetTab.isDirty) {
      this.showConfirm(
        'Cerrar sin guardar',
        `¿Deseas cerrar "${targetTab.name}"? Los cambios no guardados se perderán.`,
        () => {
          this.doCloseTab(idx);
        }
      );
    } else {
      this.doCloseTab(idx);
    }
  }

  private doCloseTab(idx: number): void {
    const closedTab = this.tabs[idx];
    this.tabs.splice(idx, 1);

    if (this.tabs.length === 0) {
      this.createNewTab();
      return;
    }

    if (this.activeTabId === closedTab.id) {
      const nextIdx = Math.min(idx, this.tabs.length - 1);
      this.activeTabId = this.tabs[nextIdx].id;
    }
    this.lucide.refresh();
  }

  // --- EXPLORADOR Y ARCHIVOS ---

  async refreshExplorer(folder = ''): Promise<void> {
    this.currentFolder = folder;
    try {
      this.items = await this.docApi.listDocs(folder, this.currentRoot);
    } catch (e) {
      console.error('Error listando archivos:', e);
      this.items = [];
    }
    this.lucide.refresh();
  }

  goBack(): void {
    const parts = this.currentFolder.split('/').filter(Boolean);
    parts.pop();
    this.refreshExplorer(parts.join('/'));
  }

  async loadFile(itemPath: string): Promise<void> {
    // Si ya existe una pestaña abierta con este archivo, simplemente seleccionarla
    const existing = this.tabs.find(t => t.path === itemPath);
    if (existing) {
      this.selectTab(existing.id);
      this.showToast('Pestaña activa: ' + existing.name, 'file-text');
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        this.sidebarOpen = false;
      }
      return;
    }

    try {
      const res = await this.docApi.readFile(itemPath, this.currentRoot);
      const fileName = res.fileName || itemPath.split('/').pop() || 'nota.txt';

      // Si solo hay una pestaña que está vacía y sin guardar, reemplazarla
      if (
        this.tabs.length === 1 &&
        this.tabs[0].isNew &&
        !this.tabs[0].content &&
        !this.tabs[0].isDirty
      ) {
        this.tabs[0].name = fileName;
        this.tabs[0].content = res.content || '';
        this.tabs[0].savedContent = res.content || '';
        this.tabs[0].path = itemPath;
        this.tabs[0].fullPath = res.fullPath;
        this.tabs[0].isNew = false;
        this.tabs[0].isDirty = false;
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.json')) this.tabs[0].fileType = 'json';
        else if (lower.endsWith('.md')) this.tabs[0].fileType = 'md';
        else this.tabs[0].fileType = 'txt';
        this.activeTabId = this.tabs[0].id;
      } else {
        this.createNewTab(fileName, res.content || '', itemPath, false);
      }

      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        this.sidebarOpen = false;
      }

      this.showToast('Archivo abierto en nueva pestaña', 'file-text');
      this.lucide.refresh();
    } catch (err: any) {
      this.showToast('Error al abrir archivo: ' + (err.message || err), 'alert-circle', 'text-rose-400');
    }
  }

  async saveActiveTab(): Promise<void> {
    const tab = this.activeTab;
    if (!tab) return;

    let fileName = tab.name.trim();
    if (!fileName) {
      fileName = `nota_${Date.now()}.txt`;
      tab.name = fileName;
    }

    this.saving = true;
    try {
      const res = await this.docApi.saveDoc(
        fileName,
        this.currentFolder,
        tab.content,
        this.currentRoot
      );

      if (res && res.status === 'success') {
        tab.name = res.fileName;
        tab.path = res.path;
        tab.fullPath = res.fullPath;
        tab.savedContent = tab.content;
        tab.isDirty = false;
        tab.isNew = false;

        this.showToast(`Guardado en Windows: ${tab.name}`, 'check-circle', 'text-emerald-400');
        await this.refreshExplorer(this.currentFolder);
      } else {
        throw new Error(res?.error || 'Error desconocido');
      }
    } catch (err: any) {
      this.showToast('Error al guardar: ' + (err.message || err), 'alert-triangle', 'text-rose-400');
    } finally {
      this.saving = false;
      this.lucide.refresh();
    }
  }

  downloadActiveTab(): void {
    const tab = this.activeTab;
    if (!tab) return;

    const content = tab.content;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tab.name || 'documento.txt';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    this.showToast('Descargado: ' + tab.name, 'download');
  }

  async copyContent(): Promise<void> {
    const tab = this.activeTab;
    if (!tab || !tab.content) {
      this.showToast('Nota vacía', 'alert-circle', 'text-amber-400');
      return;
    }
    try {
      await navigator.clipboard.writeText(tab.content);
      this.showToast('Copiado al portapapeles', 'copy', 'text-emerald-400');
    } catch {
      this.showToast('No se pudo copiar', 'alert-circle', 'text-rose-400');
    }
  }

  clearActiveContent(): void {
    const tab = this.activeTab;
    if (!tab) return;
    this.showConfirm(
      'Limpiar nota',
      `¿Deseas vaciar el contenido de "${tab.name}"?`,
      () => {
        tab.content = '';
        tab.isDirty = tab.savedContent !== '';
        this.showToast('Contenido limpio', 'eraser');
      }
    );
  }

  formatContent(type: 'json' | 'minify' | 'txt'): void {
    const tab = this.activeTab;
    if (!tab || !tab.content.trim()) {
      this.showToast('El editor está vacío', 'alert-circle', 'text-amber-400');
      return;
    }

    if (type === 'json') {
      try {
        const parsed = JSON.parse(tab.content);
        tab.content = JSON.stringify(parsed, null, 2);
        tab.fileType = 'json';
        tab.isDirty = tab.content !== tab.savedContent;
        this.showToast('JSON Formateado con sangría', 'check', 'text-amber-400');
      } catch (e: any) {
        this.showToast('JSON Inválido: ' + e.message, 'alert-triangle', 'text-rose-400');
      }
    } else if (type === 'minify') {
      try {
        const parsed = JSON.parse(tab.content);
        tab.content = JSON.stringify(parsed);
        tab.fileType = 'json';
        tab.isDirty = tab.content !== tab.savedContent;
        this.showToast('JSON Minificado en 1 línea', 'check', 'text-amber-400');
      } catch (e: any) {
        this.showToast('JSON Inválido: ' + e.message, 'alert-triangle', 'text-rose-400');
      }
    } else if (type === 'txt') {
      tab.content = tab.content
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n');
      tab.isDirty = tab.content !== tab.savedContent;
      this.showToast('Texto Normalizado', 'check', 'text-indigo-400');
    }
  }

  // --- SELECCIÓN DE DIRECTORIO DE WINDOWS ---

  async selectRootDirectory(): Promise<void> {
    let selected: string | null = null;

    if (this.electronService.isElectron) {
      selected = await this.electronService.selectDirectory(this.currentRoot || this.defaultDocsDir);
    } else {
      try {
        const res = await this.consoleApi.selectDirectoryDialog();
        if (res && res.selectedPath) {
          selected = res.selectedPath;
        }
      } catch {}
    }

    if (selected) {
      this.currentRoot = selected;
      localStorage.setItem('apiDoc_customRoot', selected);
      this.currentFolder = '';
      await this.refreshExplorer('');
      this.showToast('Carpeta activa: ' + selected, 'folder');
    }
  }

  async resetRootDirectory(): Promise<void> {
    this.currentRoot = '';
    localStorage.removeItem('apiDoc_customRoot');
    this.currentFolder = '';
    await this.refreshExplorer('');
    this.showToast('Restablecido a carpeta interna de la app (api_docs)', 'rotate-ccw');
  }

  async openInWindowsExplorer(): Promise<void> {
    try {
      await this.docApi.openInExplorer(this.currentFolder, this.currentRoot);
      this.showToast('Abierto en Explorador de Windows', 'folder-open');
    } catch {
      this.showToast('Error al abrir explorador de archivos', 'alert-circle', 'text-rose-400');
    }
  }

  // --- CREACIÓN / RENOMBRADO / BORRADO ---

  createFolder(): void {
    this.showFolderModal = true;
  }

  async confirmCreateFolder(rawName: string): Promise<void> {
    const name = (rawName || '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
    if (!name) {
      this.showToast('Nombre de carpeta inválido', 'alert-circle', 'text-rose-400');
      return;
    }

    this.showFolderModal = false;
    const targetFolder = this.currentFolder ? `${this.currentFolder}/${name}` : name;

    try {
      // Guardar archivo inicializador en la subcarpeta
      await this.docApi.saveDoc(
        '_init.txt',
        targetFolder,
        'Directorio creado por ConsoleFlow Doc Manager',
        this.currentRoot
      );
      this.showToast(`Carpeta "${name}" creada`, 'folder-plus');
      await this.refreshExplorer(this.currentFolder);
    } catch (e: any) {
      this.showToast('Error creando carpeta: ' + (e.message || e), 'alert-circle', 'text-rose-400');
    }
  }

  createFile(): void {
    this.showFileModal = true;
  }

  async confirmCreateFile(payload: { name: string; type: string }): Promise<void> {
    this.showFileModal = false;
    const name = payload.name;
    const initialContent = payload.type === 'json' ? '{\n  \n}\n' : '';

    try {
      const res = await this.docApi.saveDoc(
        name,
        this.currentFolder,
        initialContent,
        this.currentRoot
      );

      this.showToast(`Archivo "${res.fileName}" creado`, 'file-plus');
      await this.refreshExplorer(this.currentFolder);
      // Abrir en nueva pestaña
      this.createNewTab(res.fileName, initialContent, res.path, false);
    } catch (e: any) {
      this.showToast('Error creando archivo: ' + (e.message || e), 'alert-circle', 'text-rose-400');
    }
  }

  renameItem(item: DocExplorerItem): void {
    this.renameTargetItem = item;
    this.showRenameModal = true;
  }

  async confirmRename(newName: string): Promise<void> {
    if (!this.renameTargetItem || !newName.trim()) return;
    const oldPath = this.renameTargetItem.path;
    this.showRenameModal = false;

    try {
      const res = await this.docApi.renameItem(oldPath, newName.trim(), this.currentRoot);
      if (res && res.status === 'success') {
        // Actualizar pestañas que apunten al archivo renombrado
        this.tabs.forEach(t => {
          if (t.path === oldPath) {
            t.name = res.newName;
            t.path = (this.currentFolder ? this.currentFolder + '/' : '') + res.newName;
            const lower = res.newName.toLowerCase();
            if (lower.endsWith('.json')) t.fileType = 'json';
            else if (lower.endsWith('.md')) t.fileType = 'md';
            else t.fileType = 'txt';
          }
        });

        this.showToast(`Renombrado a "${res.newName}"`, 'pencil');
        await this.refreshExplorer(this.currentFolder);
      }
    } catch (e: any) {
      this.showToast('Error al renombrar: ' + (e.message || e), 'alert-circle', 'text-rose-400');
    } finally {
      this.renameTargetItem = null;
    }
  }

  deleteItem(path: string): void {
    const isFolder = this.items.find(i => i.path === path)?.isFolder;
    const label = isFolder ? 'esta carpeta y su contenido' : 'este archivo';

    this.showConfirm(
      'Eliminar Elemento',
      `¿Deseas eliminar permanentemente ${label} en Windows?`,
      async () => {
        try {
          await this.docApi.deleteItem(path, this.currentRoot);
          this.showToast('Eliminado de Windows', 'trash-2');

          // Cerrar pestañas asociadas
          const openTab = this.tabs.find(t => t.path === path);
          if (openTab) {
            this.closeTab(openTab.id);
          }

          await this.refreshExplorer(this.currentFolder);
        } catch (e: any) {
          this.showToast('Error al eliminar: ' + (e.message || e), 'alert-circle', 'text-rose-400');
        }
      }
    );
  }

  // --- MODALES & TOASTS ---

  showToast(msg: string, icon = 'check-circle', color = 'text-indigo-400'): void {
    this.toastMsg = msg;
    this.toastIcon = icon;
    this.toastColor = color;
    this.toastVisible = true;
    this.lucide.refresh();

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastVisible = false;
    }, 3000);
  }

  showConfirm(title: string, text: string, callback: () => void): void {
    this.confirmTitle = title;
    this.confirmText = text;
    this.confirmCallback = callback;
    this.showConfirmModal = true;
    this.lucide.refresh();
  }

  closeConfirmModal(): void {
    this.showConfirmModal = false;
    this.confirmCallback = null;
  }

  onConfirmAction(): void {
    if (this.confirmCallback) {
      this.confirmCallback();
    }
    this.closeConfirmModal();
  }
}

import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DocApiService, DocExplorerItem } from '../../core/services/doc-api.service';
import { LucideIconService } from '../../core/services/lucide-icon.service';
import { ApiExplorerSidebarComponent } from './components/api-explorer-sidebar/api-explorer-sidebar.component';
import { ApiDocEditorComponent } from './components/api-doc-editor/api-doc-editor.component';
import { ApiFolderModalComponent } from './components/api-folder-modal/api-folder-modal.component';

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
export class ApiDocComponent implements OnInit, AfterViewInit {
  currentFolder = '';
  currentDocType: 'req' | 'res' = 'req';
  items: DocExplorerItem[] = [];
  activeFile = '';

  docName = '';
  docContent = '';
  saving = false;

  // Modals & Toast
  showFolderModal = false;
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
    private lucide: LucideIconService
  ) {}

  ngOnInit(): void {
    this.refreshExplorer('');
  }

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }

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

  async refreshExplorer(folder = ''): Promise<void> {
    this.currentFolder = folder;
    try {
      this.items = await this.docApi.listDocs(folder);
    } catch (e) {
      console.error('Error explorador:', e);
      if (this.items.length === 0) this.items = [];
    }
    this.lucide.refresh();
  }

  goBack(): void {
    const parts = this.currentFolder.split('/').filter(Boolean);
    parts.pop();
    this.refreshExplorer(parts.join('/'));
  }

  async loadFile(path: string): Promise<void> {
    try {
      const data = await this.docApi.readFile(path);
      this.docContent = data.content;

      const fileName = path.split('/').pop() || '';
      const baseName = fileName.replace('.txt', '').replace(/_(req|res)$/, '');
      this.docName = baseName;

      if (fileName.includes('_res')) this.currentDocType = 'res';
      else if (fileName.includes('_req')) this.currentDocType = 'req';

      this.activeFile = path;
      this.showToast('Archivo cargado');
    } catch {
      this.showToast('Error al abrir', 'alert-circle', 'text-red-400');
    }
  }

  async saveToProject(): Promise<void> {
    const name = this.docName.trim();
    const content = this.docContent.trim();

    if (!name) {
      this.showToast('Falta nombre', 'alert-circle', 'text-red-400');
      return;
    }
    if (!content) {
      this.showToast('Contenido vacío', 'alert-circle', 'text-red-400');
      return;
    }

    const finalName = `${name}_${this.currentDocType}`;
    this.saving = true;

    try {
      const data = await this.docApi.saveDoc(finalName, this.currentFolder, content);
      if (data.status === 'success') {
        this.showToast('Guardado en servidor');
        this.activeFile = (this.currentFolder ? this.currentFolder + '/' : '') + finalName + '.txt';
        await this.refreshExplorer(this.currentFolder);
      } else {
        throw new Error(data.error);
      }
    } catch {
      this.showToast('Error de conexión', 'alert-circle', 'text-red-400');
    } finally {
      this.saving = false;
    }
  }

  downloadAsTxt(): void {
    const name = this.docName.trim() || 'servicio_doc';
    const content = this.docContent.trim();

    if (!content) {
      this.showToast('Nada que exportar', 'alert-circle', 'text-red-400');
      return;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}_${this.currentDocType}.txt`;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    this.showToast('Exportado a descargas');
  }

  createFolder(): void {
    this.showFolderModal = true;
  }

  async confirmCreateFolder(rawName: string): Promise<void> {
    const name = (rawName || '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
    if (!name) {
      this.showToast('Nombre inválido', 'alert-circle', 'text-red-400');
      return;
    }

    this.showFolderModal = false;

    const targetFolder = this.currentFolder ? `${this.currentFolder}/${name}` : name;
    this.items = [{ name, isFolder: true, path: targetFolder }, ...this.items];
    this.lucide.refresh();

    try {
      const data = await this.docApi.saveDoc('_init.txt', targetFolder, 'Directorio inicializado por ConsoleFlow');
      if (data.status === 'success') {
        this.showToast('Carpeta creada');
        setTimeout(() => this.refreshExplorer(this.currentFolder), 250);
      } else {
        throw new Error(data.error || 'Error del servidor');
      }
    } catch (e) {
      console.error('Error al crear carpeta:', e);
      this.showToast('Error de servidor', 'alert-circle', 'text-red-400');
      this.refreshExplorer(this.currentFolder);
    }
  }

  deleteItem(path: string): void {
    this.showConfirm('Eliminar Elemento', '¿Borrar este archivo/carpeta permanentemente?', async () => {
      try {
        await this.docApi.deleteItem(path);
        this.showToast('Eliminado');
        if (this.activeFile === path) {
          this.docContent = '';
          this.docName = '';
          this.activeFile = '';
        }
        await this.refreshExplorer(this.currentFolder);
      } catch {
        this.showToast('Error al eliminar', 'alert-circle', 'text-red-400');
      }
    });
  }

  clearEditor(): void {
    this.showConfirm('Limpiar Editor', '¿Deseas borrar todo el texto que estás escribiendo?', () => {
      this.docContent = '';
      this.docName = '';
      this.activeFile = '';
      this.showToast('Editor limpio', 'eraser');
    });
  }

  formatContent(type: 'json' | 'txt'): void {
    const content = this.docContent;
    if (!content.trim()) {
      this.showToast('El editor está vacío', 'alert-circle', 'text-amber-400');
      return;
    }

    if (type === 'json') {
      try {
        const toParse = content.replace(/'/g, '"');
        const obj = JSON.parse(toParse);
        this.docContent = JSON.stringify(obj, null, 4);
        this.showToast('JSON Formateado', 'check', 'text-indigo-400');
      } catch {
        this.showToast('Sintaxis JSON Inválida', 'alert-triangle', 'text-red-400');
      }
    } else if (type === 'txt') {
      this.docContent = content
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map(line => line.trim())
        .join('\n');
      this.showToast('Texto Formateado', 'check', 'text-emerald-400');
    }
  }
}

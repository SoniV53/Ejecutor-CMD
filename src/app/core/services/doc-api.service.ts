import { Injectable } from '@angular/core';

export interface DocExplorerItem {
  name: string;
  isFolder: boolean;
  path: string;
}

export interface GitScannedBranch {
  name: string;
  lastCommitHash: string;
  lastCommitMsg: string;
  lastCommitDate: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface GitAnalysisResponse {
  status: string;
  repoPath: string;
  currentBranch: string;
  branches: GitScannedBranch[];
}

export interface DirectoryEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
}

export interface BrowseDirectoriesResponse {
  currentPath: string;
  parentPath: string | null;
  isCurrentGitRepo: boolean;
  drives: string[];
  directories: DirectoryEntry[];
}

@Injectable({ providedIn: 'root' })
export class DocApiService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl =
      window.location.protocol === 'file:' || window.location.port === '4200'
        ? 'http://localhost:3000'
        : window.location.origin;
  }

  async listDocs(folder = ''): Promise<DocExplorerItem[]> {
    const res = await fetch(`${this.baseUrl}/api/doc/list?path=${encodeURIComponent(folder)}&_t=${Date.now()}`);
    if (!res.ok) throw new Error('Error al listar directorio');
    return res.json();
  }

  async readFile(path: string): Promise<{ content: string }> {
    const res = await fetch(`${this.baseUrl}/api/doc/read?path=${encodeURIComponent(path)}&_t=${Date.now()}`);
    if (!res.ok) throw new Error('No se pudo leer el archivo');
    return res.json();
  }

  async saveDoc(fileName: string, folder: string, content: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/doc/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, folder, content })
    });
    if (!res.ok) throw new Error('Error guardando documento');
    return res.json();
  }

  async saveJsonDoc(fileName: string, folder: string, content: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/doc/saveJsonDoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, folder, content })
    });
    if (!res.ok) throw new Error('Error guardando JSON');
    return res.json();
  }

  async deleteItem(itemPath: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/doc/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemPath })
    });
    if (!res.ok) throw new Error('Error eliminando elemento');
    return res.json();
  }

  async analyzeGitRepository(repoPath: string, includeRemote = false): Promise<GitAnalysisResponse> {
    const res = await fetch(`${this.baseUrl}/api/doc/analyze-git`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, includeRemote })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al analizar el repositorio Git');
    }
    return data;
  }

  async browseDirectories(dirPath = ''): Promise<BrowseDirectoriesResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/doc/browse-dirs?path=${encodeURIComponent(dirPath)}&_t=${Date.now()}`
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al explorar directorios');
    }
    return data;
  }
}




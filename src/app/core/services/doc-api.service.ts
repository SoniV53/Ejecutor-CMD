import { Injectable } from '@angular/core';

export interface DocExplorerItem {
  name: string;
  isFolder: boolean;
  path: string;
  fullPath?: string;
  extension?: string;
  children?: DocExplorerItem[];
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

export interface GitScannedCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface GitBranchCommitsResponse {
  status: string;
  branchName: string;
  commits: GitScannedCommit[];
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

  async getDocInfo(): Promise<{ defaultDocsDir: string; baseDir: string }> {
    const res = await fetch(`${this.baseUrl}/api/doc/info?_t=${Date.now()}`);
    if (!res.ok) throw new Error('Error al obtener info de directorios');
    return res.json();
  }

  async listDocs(folder = '', root = ''): Promise<DocExplorerItem[]> {
    const params = new URLSearchParams();
    if (folder) params.set('path', folder);
    if (root) params.set('root', root);
    params.set('_t', Date.now().toString());

    const res = await fetch(`${this.baseUrl}/api/doc/list?${params.toString()}`);
    if (!res.ok) throw new Error('Error al listar directorio');
    return res.json();
  }

  async getDocTree(root = ''): Promise<DocExplorerItem[]> {
    const params = new URLSearchParams();
    if (root) params.set('root', root);
    params.set('_t', Date.now().toString());

    const res = await fetch(`${this.baseUrl}/api/doc/tree?${params.toString()}`);
    if (!res.ok) throw new Error('Error al obtener árbol de directorios');
    return res.json();
  }

  async readFile(
    path: string,
    root = ''
  ): Promise<{ content: string; fileName?: string; fullPath?: string; path?: string }> {
    const params = new URLSearchParams();
    params.set('path', path);
    if (root) params.set('root', root);
    params.set('_t', Date.now().toString());

    const res = await fetch(`${this.baseUrl}/api/doc/read?${params.toString()}`);
    if (!res.ok) throw new Error('No se pudo leer el archivo');
    return res.json();
  }

  async saveDoc(fileName: string, folder: string, content: string, root = ''): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/doc/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, folder, content, root })
    });
    if (!res.ok) throw new Error('Error guardando documento');
    return res.json();
  }

  async saveJsonDoc(fileName: string, folder: string, content: string, root = ''): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/doc/saveJsonDoc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, folder, content, root })
    });
    if (!res.ok) throw new Error('Error guardando JSON');
    return res.json();
  }

  async renameItem(oldPath: string, newName: string, root = ''): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/doc/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newName, root })
    });
    if (!res.ok) throw new Error('Error al renombrar');
    return res.json();
  }

  async deleteItem(itemPath: string, root = ''): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/doc/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemPath, root })
    });
    if (!res.ok) throw new Error('Error eliminando elemento');
    return res.json();
  }

  async openInExplorer(folder = '', root = ''): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/doc/open-explorer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, root })
    });
    if (!res.ok) throw new Error('Error abriendo carpeta en explorador');
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

  async getBranchCommits(repoPath: string, branchName: string, limit = 150): Promise<GitBranchCommitsResponse> {
    const res = await fetch(`${this.baseUrl}/api/doc/branch-commits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath, branchName, limit })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al obtener los commits de la rama');
    }
    return data;
  }
}





import { Injectable } from '@angular/core';
import { CmdWorkspaceData, CmdStreamEvent } from '../../features/dashboard-cmd/models/cmd.models';

@Injectable({ providedIn: 'root' })
export class ConsoleFlowApiService {
  readonly serverUrl: string;

  constructor() {
    this.serverUrl =
      window.location.protocol === 'file:' || window.location.port === '4200'
        ? 'http://localhost:3000'
        : window.location.origin;
  }

  async getData(): Promise<CmdWorkspaceData> {
    const response = await fetch(`${this.serverUrl}/data`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  }

  async saveData(payload: CmdWorkspaceData): Promise<void> {
    const response = await fetch(`${this.serverUrl}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`Error al guardar datos: ${response.status}`);
    }
  }

  async executeCommandStream(
    command: string,
    cwdPath: string,
    background: boolean,
    onEvent: (event: CmdStreamEvent) => void
  ): Promise<void> {
    const response = await fetch(`${this.serverUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, path: cwdPath, background })
    });

    if (!response.ok || !response.body) {
      throw new Error(`Error al ejecutar comando: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event: CmdStreamEvent = JSON.parse(trimmed);
          onEvent(event);
        } catch {
          // Ignorar líneas malformadas
        }
      }
    }

    if (buffer.trim()) {
      try {
        const event: CmdStreamEvent = JSON.parse(buffer.trim());
        onEvent(event);
      } catch {
        // Ignorar
      }
    }
  }

  async killProcess(processId: string): Promise<void> {
    await fetch(`${this.serverUrl}/execute/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId })
    });
  }

  async killAllProcesses(): Promise<void> {
    await fetch(`${this.serverUrl}/execute/kill-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
  }

  killAllProcessesBeacon(): void {
    try {
      if (navigator && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(`${this.serverUrl}/execute/kill-all`, '{}');
      } else {
        fetch(`${this.serverUrl}/execute/kill-all`, {
          method: 'POST',
          keepalive: true,
          body: '{}'
        }).catch(() => {});
      }
    } catch {
      // Ignorar al cerrar ventana
    }
  }

  async sendProcessInput(processId: string, input: string): Promise<void> {
    await fetch(`${this.serverUrl}/execute/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ processId, input })
    });
  }

  async getBatInfo(): Promise<{ status: string; batDir: string; baseDir: string }> {
    const response = await fetch(`${this.serverUrl}/api/bat/info`);
    if (!response.ok) {
      throw new Error(`Error al obtener info de bats: ${response.status}`);
    }
    return response.json();
  }

  async saveBatFile(
    dirPath: string,
    fileName: string,
    content: string
  ): Promise<{
    status: string;
    message: string;
    fileName: string;
    dirPath: string;
    fullPath: string;
    scriptCommand: string;
  }> {
    const response = await fetch(`${this.serverUrl}/api/bat/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dirPath, fileName, content })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error al guardar archivo .bat: ${response.status}`);
    }
    return response.json();
  }

  async readBatFile(filePath: string): Promise<{
    status: string;
    fileName: string;
    filePath: string;
    content: string;
  }> {
    const response = await fetch(`${this.serverUrl}/api/bat/read?path=${encodeURIComponent(filePath)}`);
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Error al leer archivo .bat: ${response.status}`);
    }
    return response.json();
  }

  async listBatFiles(dirPath?: string): Promise<{
    status: string;
    batDir: string;
    files: { name: string; fullPath: string }[];
  }> {
    const q = dirPath ? `?dir=${encodeURIComponent(dirPath)}` : '';
    const response = await fetch(`${this.serverUrl}/api/bat/list${q}`);
    if (!response.ok) {
      throw new Error(`Error al listar archivos .bat: ${response.status}`);
    }
    return response.json();
  }

  async deleteBatFile(filePath: string): Promise<void> {
    await fetch(`${this.serverUrl}/api/bat/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath })
    });
  }

  async selectDirectoryDialog(): Promise<{ selectedPath: string | null }> {
    try {
      const response = await fetch(`${this.serverUrl}/api/system/select-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('Error en selectDirectoryDialog backend:', e);
    }
    return { selectedPath: null };
  }

  downloadBatFile(fileName: string, content: string): void {
    let clean = (fileName || 'script').trim();
    if (!clean.toLowerCase().endsWith('.bat') && !clean.toLowerCase().endsWith('.cmd')) {
      clean += '.bat';
    }
    const blob = new Blob([content || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = clean;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

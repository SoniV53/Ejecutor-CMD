import { Injectable } from '@angular/core';
import { CmdWorkspaceData } from '../../features/dashboard-cmd/models/cmd.models';

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

  async executeCommand(command: string, cwdPath: string, background: boolean): Promise<any> {
    const response = await fetch(`${this.serverUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, path: cwdPath, background })
    });
    if (!response.ok) {
      throw new Error(`Error al ejecutar comando: ${response.status}`);
    }
    return response.json();
  }
}


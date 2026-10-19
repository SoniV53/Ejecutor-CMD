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
}



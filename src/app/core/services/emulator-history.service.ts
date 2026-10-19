import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class EmulatorHistoryService {
  private readonly baseUrl: string;
  private readonly fallbackKey = 'temp_history';

  constructor() {
    this.baseUrl =
      window.location.protocol === 'file:' || window.location.port === '4200'
        ? 'http://localhost:3000'
        : window.location.origin;
  }

  async getFullData(): Promise<{ history: string[]; [key: string]: any }> {
    try {
      const response = await fetch(`${this.baseUrl}/dataEmulador`);
      if (!response.ok) throw new Error('Error en servidor');
      const data = await response.json();
      if (!data.history) data.history = [];
      return data;
    } catch {
      const localHistory = JSON.parse(localStorage.getItem(this.fallbackKey) || '["https://www.wikipedia.org"]');
      return { history: localHistory };
    }
  }

  async getHistory(): Promise<string[]> {
    const data = await this.getFullData();
    return data.history;
  }

  async saveUrl(newUrl: string): Promise<string[]> {
    try {
      const fullData = await this.getFullData();
      let history = fullData.history || [];
      history = history.filter((item: string) => item !== newUrl);
      history.unshift(newUrl);
      if (history.length > 15) history.pop();
      fullData.history = history;

      await fetch(`${this.baseUrl}/dataEmulador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullData)
      });
      return history;
    } catch {
      let local = JSON.parse(localStorage.getItem(this.fallbackKey) || '[]');
      local = [newUrl, ...local.filter((u: string) => u !== newUrl)].slice(0, 15);
      localStorage.setItem(this.fallbackKey, JSON.stringify(local));
      return local;
    }
  }

  async clearHistory(): Promise<void> {
    try {
      const fullData = await this.getFullData();
      fullData.history = [];
      await fetch(`${this.baseUrl}/dataEmulador`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullData)
      });
    } catch {
      localStorage.removeItem(this.fallbackKey);
    }
  }
}


import { Component, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolCardComponent, HubToolCard } from './components/tool-card/tool-card.component';
import { LucideIconService } from '../../core/services/lucide-icon.service';

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [CommonModule, ToolCardComponent],
  templateUrl: './hub.component.html',
  styleUrls: ['./hub.component.css']
})
export class HubComponent implements AfterViewInit {
  tools: HubToolCard[] = [
    {
      route: '/dashboard-cmd',
      title: 'Panel Local',
      description: 'Administra tus proyectos y ejecuta scripts en tu máquina local.',
      icon: 'terminal',
      color: 'indigo'
    },
    {
      route: '/doc-generator',
      title: 'Doc Generator',
      description: 'Genera documentación estructurada automáticamente.',
      icon: 'file-text',
      color: 'purple'
    },
    {
      route: '/redes',
      title: 'Redes',
      description: 'Generador y simulador de redes.',
      icon: 'network',
      color: 'orange'
    },
    {
      route: '/api-doc',
      title: 'API Doc Manager',
      description: 'Gestiona, visualiza y documenta tus tramas API.',
      icon: 'file-json',
      color: 'sky'
    },
    {
      route: '/repo-doc',
      title: 'Repo Docs',
      description: 'Documentador de ramas y commits guardado en tus archivos.',
      icon: 'git-branch',
      color: 'emerald'
    },
    {
      route: '/emulador',
      title: 'Emulador de Dispositivos',
      description: 'Previsualiza y ajusta interfaces móviles de forma nativa.',
      icon: 'smartphone',
      color: 'blue'
    }
  ];

  constructor(private lucide: LucideIconService) {}

  ngAfterViewInit(): void {
    this.lucide.refresh();
  }
}


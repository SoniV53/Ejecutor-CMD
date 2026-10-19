import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { RedesCliConsoleComponent } from './components/redes-cli-console/redes-cli-console.component';
import { RedesInterfacesEditorComponent } from './components/redes-interfaces-editor/redes-interfaces-editor.component';
import { RedesRoutingEditorComponent } from './components/redes-routing-editor/redes-routing-editor.component';
import { RedesServicesEditorComponent } from './components/redes-services-editor/redes-services-editor.component';
import { RedesSidebarComponent } from './components/redes-sidebar/redes-sidebar.component';
import {
  NetworkNode,
  NodeType,
  TopologyTemplateType
} from './models/redes.models';
import { CiscoCliService } from './services/cisco-cli.service';

@Component({
  selector: 'app-redes',
  standalone: true,
  imports: [
    CommonModule,
    RedesSidebarComponent,
    RedesInterfacesEditorComponent,
    RedesRoutingEditorComponent,
    RedesServicesEditorComponent,
    RedesCliConsoleComponent
  ],
  templateUrl: './redes.component.html',
  styleUrls: ['./redes.component.css']
})
export class RedesComponent {
  nodes: NetworkNode[] = [];
  selectedNodeId: string | null = null;
  showCli = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  showSidebar = false;

  constructor(private readonly cliService: CiscoCliService) {}

  @HostListener('window:resize')
  onResize(): void {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      this.showSidebar = false;
    }
  }

  get selectedNode(): NetworkNode | undefined {
    return this.nodes.find(n => n.id === this.selectedNodeId);
  }

  get currentCliConfig(): string {
    return this.cliService.generateConfig(this.selectedNode, this.nodes);
  }

  loadTemplate(type: TopologyTemplateType): void {
    const templateNodes = this.cliService.getTemplate(type);
    this.nodes = templateNodes;
    this.selectedNodeId = templateNodes[0]?.id || null;
    this.showSidebar = false;
  }

  addNode(type: NodeType): void {
    const newNode = this.cliService.createDefaultNode(type, this.nodes.length);
    this.nodes = [...this.nodes, newNode];
    this.selectedNodeId = newNode.id;
    this.showSidebar = false;
  }

  selectNode(id: string): void {
    this.selectedNodeId = id;
    this.showSidebar = false;
  }

  deleteNode(id: string): void {
    this.nodes = this.nodes.filter(n => n.id !== id);
    if (this.selectedNodeId === id) {
      this.selectedNodeId = null;
    }
  }

  onNodeChange(updatedNode: NetworkNode): void {
    this.nodes = this.nodes.map(n => (n.id === updatedNode.id ? { ...updatedNode } : n));
  }

  toggleCli(): void {
    this.showCli = !this.showCli;
  }

  downloadJSON(): void {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.nodes, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', 'topologia_cisco.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  handleImport(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const result = e.target?.result;
        if (typeof result === 'string') {
          const importedNodes = JSON.parse(result);
          if (Array.isArray(importedNodes)) {
            this.nodes = importedNodes;
            this.selectedNodeId = importedNodes.length > 0 ? importedNodes[0].id : null;
          }
        }
      } catch {
        alert('Error al leer JSON');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  print(): void {
    window.print();
  }
}

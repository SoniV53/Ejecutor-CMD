import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  NetworkNode,
  NodeType,
  TopologyTemplateType
} from '../../models/redes.models';

@Component({
  selector: 'app-redes-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './redes-sidebar.component.html',
  styleUrls: ['./redes-sidebar.component.css']
})
export class RedesSidebarComponent {
  @Input() nodes: NetworkNode[] = [];
  @Input() selectedNodeId: string | null = null;
  @Input() showSidebar = false;

  @Output() closeSidebar = new EventEmitter<void>();
  @Output() selectTemplate = new EventEmitter<TopologyTemplateType>();
  @Output() addNode = new EventEmitter<NodeType>();
  @Output() selectNode = new EventEmitter<string>();
  @Output() deleteNode = new EventEmitter<string>();
  @Output() saveJson = new EventEmitter<void>();
  @Output() importJson = new EventEmitter<Event>();
  @Output() printPdf = new EventEmitter<void>();

  onNodeClick(id: string): void {
    this.selectNode.emit(id);
    this.closeSidebar.emit();
  }

  onDeleteClick(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.deleteNode.emit(id);
  }

  onFileSelected(event: Event): void {
    this.importJson.emit(event);
  }
}

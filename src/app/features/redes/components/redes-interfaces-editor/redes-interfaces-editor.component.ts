import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NetworkNode,
  NodeInterface,
  NodeSubinterface,
  SwitchTrunk,
  SwitchVlan
} from '../../models/redes.models';
import { CiscoCliService } from '../../services/cisco-cli.service';

@Component({
  selector: 'app-redes-interfaces-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './redes-interfaces-editor.component.html',
  styleUrls: ['./redes-interfaces-editor.component.css']
})
export class RedesInterfacesEditorComponent {
  @Input({ required: true }) node!: NetworkNode;
  @Input() allNodes: NetworkNode[] = [];
  @Input() showCli = true;

  @Output() nodeChange = new EventEmitter<NetworkNode>();
  @Output() toggleCli = new EventEmitter<void>();

  constructor(private readonly cliService: CiscoCliService) {}

  get otherNodes(): NetworkNode[] {
    return (this.allNodes || []).filter(n => n.id !== this.node?.id);
  }

  onHostnameChange(value: string): void {
    this.node.name = value.replace(/\s+/g, '_');
    this.emitChange();
  }

  onGatewayChange(value: string): void {
    this.node.properties.gateway = value;
    this.emitChange();
  }

  addInterface(): void {
    const interfaces = this.node.properties.interfaces || [];
    let nextIntName: string;
    if (this.node.type === 'switch') {
      const faCount = interfaces.filter(i => i.name.toLowerCase().startsWith('fa')).length;
      nextIntName = `Fa0/${faCount + 1}`;
    } else {
      nextIntName = `G0/${interfaces.length}`;
    }

    const newInt: NodeInterface = {
      id: this.cliService.generateId(),
      name: nextIntName,
      ip: '',
      mask: '255.255.255.0',
      connectedTo: null,
      showInCli: true
    };
    this.node.properties.interfaces = [...interfaces, newInt];
    this.emitChange();
  }

  removeInterface(id: string): void {
    this.node.properties.interfaces = (this.node.properties.interfaces || []).filter(
      i => i.id !== id
    );
    this.emitChange();
  }

  toggleInterfaceCli(int: NodeInterface): void {
    int.showInCli = int.showInCli === false ? true : false;
    this.emitChange();
  }

  addSubinterface(): void {
    const interfaces = this.node.properties.interfaces || [];
    const baseInt = interfaces.length > 0 ? interfaces[0].name : '';
    const newSub: NodeSubinterface = {
      id: this.cliService.generateId(),
      vlan: '',
      ip: '',
      mask: '255.255.255.0',
      baseInterface: baseInt
    };
    this.node.properties.subinterfaces = [...(this.node.properties.subinterfaces || []), newSub];
    this.emitChange();
  }

  removeSubinterface(idx: number): void {
    this.node.properties.subinterfaces = (this.node.properties.subinterfaces || []).filter(
      (_, i) => i !== idx
    );
    this.emitChange();
  }

  addVlan(): void {
    const currentVlans = this.node.properties.vlans || [];
    let nextStart = '';
    let lastPrefix = 'Fa0/';

    if (currentVlans.length > 0) {
      const lastVlan = currentVlans[currentVlans.length - 1];
      lastPrefix = lastVlan.portPrefix !== undefined ? lastVlan.portPrefix : 'Fa0/';

      if (lastVlan.endPort) {
        const endNum = parseInt(lastVlan.endPort, 10);
        if (!isNaN(endNum)) nextStart = (endNum + 1).toString();
      } else if (lastVlan.startPort) {
        const startNum = parseInt(lastVlan.startPort, 10);
        if (!isNaN(startNum)) nextStart = (startNum + 1).toString();
      }
    }

    const isFirstVlan = currentVlans.length === 0;
    const newVlan: SwitchVlan = {
      id: '',
      name: '',
      portPrefix: lastPrefix,
      startPort: nextStart,
      endPort: '',
      isNative: isFirstVlan
    };
    this.node.properties.vlans = [...currentVlans, newVlan];
    this.emitChange();
  }

  onVlanIdChange(vlan: SwitchVlan, value: string): void {
    vlan.id = value;
    if (vlan.isNative) {
      this.node.properties.nativeVlan = value;
    }
    this.emitChange();
  }

  setNativeVlan(idx: number): void {
    const vlans = this.node.properties.vlans || [];
    vlans.forEach((v, i) => {
      v.isNative = i === idx;
    });
    this.node.properties.nativeVlan = vlans[idx]?.id || '';
    this.emitChange();
  }

  removeVlan(idx: number): void {
    this.node.properties.vlans = (this.node.properties.vlans || []).filter((_, i) => i !== idx);
    this.emitChange();
  }

  addTrunk(): void {
    const currentVlans = this.node.properties.vlans || [];
    const vlanIds = currentVlans.map(v => v.id).filter(Boolean);
    const nativeId =
      currentVlans.find(v => v.isNative)?.id || this.node.properties.nativeVlan || '';
    const allowedVlansStr = [...new Set([...vlanIds, nativeId].filter(Boolean))].join(',');

    const newTrunk: SwitchTrunk = {
      id: this.cliService.generateId(),
      interface: 'G0/1',
      nativeVlan: nativeId,
      allowedVlans: allowedVlansStr
    };
    this.node.properties.trunks = [...(this.node.properties.trunks || []), newTrunk];
    this.emitChange();
  }

  removeTrunk(idx: number): void {
    this.node.properties.trunks = (this.node.properties.trunks || []).filter((_, i) => i !== idx);
    this.emitChange();
  }

  emitChange(): void {
    this.nodeChange.emit(this.node);
  }
}

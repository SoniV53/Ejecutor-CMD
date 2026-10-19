import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NetworkNode,
  RedistributionSourceType,
  RouterNetworkInfo,
  TranslatorProcess,
  TranslatorProtocolType
} from '../../models/redes.models';
import { CiscoCliService } from '../../services/cisco-cli.service';

interface RedistributionDraft {
  source: RedistributionSourceType;
  sourceId: string;
  metric: string;
  subnets: boolean;
}

@Component({
  selector: 'app-redes-routing-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './redes-routing-editor.component.html',
  styleUrls: ['./redes-routing-editor.component.css']
})
export class RedesRoutingEditorComponent {
  @Input({ required: true }) node!: NetworkNode;
  @Input() allNodes: NetworkNode[] = [];

  @Output() nodeChange = new EventEmitter<NetworkNode>();

  remoteRouterId = '';
  nextHopIp = '';
  bgpNeighborIp = '';
  bgpNeighborAs = '';

  redistDrafts: Record<string, RedistributionDraft> = {};

  constructor(private readonly cliService: CiscoCliService) {}

  get otherRouters(): NetworkNode[] {
    return (this.allNodes || []).filter(n => n.id !== this.node?.id && n.type === 'router');
  }

  get availableInterfaces(): RouterNetworkInfo[] {
    return this.cliService.getRouterNetworks(this.node);
  }

  captureRemoteLans(): void {
    const destNode = this.allNodes.find(n => n.id === this.remoteRouterId);
    if (destNode && this.nextHopIp) {
      const sourceNets = this.cliService.getRouterNetworks(this.node).map(n => n.network);
      const destNetsRaw = this.cliService.getRouterNetworks(destNode);
      const newRoutes = [...(this.node.properties.protocolData.staticRoutes || [])];
      let addedCount = 0;

      destNetsRaw.forEach(n => {
        const connectedNode = this.allNodes.find(node => node.id === n.connectedTo);
        const isTransitNetwork = connectedNode && connectedNode.type === 'router';
        if (!isTransitNetwork && !sourceNets.includes(n.network)) {
          newRoutes.push({
            network: n.network,
            mask: n.mask,
            nextHop: this.nextHopIp,
            label: `${destNode.name} | ${n.label}`
          });
          addedCount++;
        }
      });

      this.node.properties.protocolData.staticRoutes = newRoutes;
      this.emitChange();
      alert(`Añadidas ${addedCount} rutas.`);
    }
  }

  removeStaticRoute(idx: number): void {
    this.node.properties.protocolData.staticRoutes = (
      this.node.properties.protocolData.staticRoutes || []
    ).filter((_, i) => i !== idx);
    this.emitChange();
  }

  captureBgpNetworks(): void {
    const formattedNets = this.cliService.getRouterNetworks(this.node).map(n => ({
      network: n.network,
      mask: n.mask,
      label: n.label
    }));
    this.node.properties.protocolData.bgpNetworks = formattedNets;
    this.emitChange();
  }

  removeBgpNetwork(idx: number): void {
    this.node.properties.protocolData.bgpNetworks = (
      this.node.properties.protocolData.bgpNetworks || []
    ).filter((_, i) => i !== idx);
    this.emitChange();
  }

  addBgpNeighbor(): void {
    if (this.bgpNeighborIp && this.bgpNeighborAs) {
      this.node.properties.protocolData.bgpNeighbors = [
        ...(this.node.properties.protocolData.bgpNeighbors || []),
        {
          id: this.cliService.generateId(),
          ip: this.bgpNeighborIp,
          remoteAs: this.bgpNeighborAs
        }
      ];
      this.bgpNeighborIp = '';
      this.bgpNeighborAs = '';
      this.emitChange();
    }
  }

  removeBgpNeighbor(idx: number): void {
    this.node.properties.protocolData.bgpNeighbors = (
      this.node.properties.protocolData.bgpNeighbors || []
    ).filter((_, i) => i !== idx);
    this.emitChange();
  }

  captureOspfNetworks(): void {
    const defaultArea = this.node.properties.protocolData.ospfArea || '0';
    const formattedNets = this.cliService.getRouterNetworks(this.node).map(n => ({
      network: n.network,
      wildcard: n.wildcard,
      label: n.label,
      area: defaultArea
    }));
    this.node.properties.protocolData.ospfNetworks = formattedNets;
    this.emitChange();
  }

  removeOspfNetwork(idx: number): void {
    this.node.properties.protocolData.ospfNetworks = (
      this.node.properties.protocolData.ospfNetworks || []
    ).filter((_, i) => i !== idx);
    this.emitChange();
  }

  captureEigrpNetworks(): void {
    const formattedNets = this.cliService.getRouterNetworks(this.node).map(n => ({
      network: n.network,
      wildcard: n.wildcard,
      label: n.label
    }));
    this.node.properties.protocolData.eigrpNetworks = formattedNets;
    this.emitChange();
  }

  removeEigrpNetwork(idx: number): void {
    this.node.properties.protocolData.eigrpNetworks = (
      this.node.properties.protocolData.eigrpNetworks || []
    ).filter((_, i) => i !== idx);
    this.emitChange();
  }

  captureRipNetworks(): void {
    const formattedNets = this.cliService.getRouterNetworks(this.node).map(n => ({
      network: n.network,
      label: n.label
    }));
    this.node.properties.protocolData.ripNetworks = formattedNets;
    this.emitChange();
  }

  removeRipNetwork(idx: number): void {
    this.node.properties.protocolData.ripNetworks = (
      this.node.properties.protocolData.ripNetworks || []
    ).filter((_, i) => i !== idx);
    this.emitChange();
  }

  // --- Translator Processes ---
  getDraft(t: TranslatorProcess): RedistributionDraft {
    if (!this.redistDrafts[t.id]) {
      this.redistDrafts[t.id] = {
        source: 'ospf',
        sourceId: '',
        metric: this.getDefaultMetric(t.protocol),
        subnets: true
      };
    }
    return this.redistDrafts[t.id];
  }

  getDefaultMetric(protocol: TranslatorProtocolType): string {
    if (protocol === 'rip') return '5';
    if (protocol === 'eigrp') return '1544 2000 255 1 1500';
    return '';
  }

  getMetricPlaceholder(protocol: TranslatorProtocolType): string {
    if (protocol === 'rip') return '5';
    if (protocol === 'eigrp') return '1544 2000 255 1 1500';
    return 'Opcional (Ej: 20)';
  }

  addTranslatorProcess(): void {
    const id = this.cliService.generateId();
    const newTranslator: TranslatorProcess = {
      id,
      protocol: 'rip',
      processId: '1',
      networks: [],
      redistributions: []
    };
    this.redistDrafts[id] = {
      source: 'ospf',
      sourceId: '',
      metric: '5',
      subnets: true
    };
    this.node.properties.translators = [
      ...(this.node.properties.translators || []),
      newTranslator
    ];
    this.emitChange();
  }

  removeTranslatorProcess(idx: number): void {
    this.node.properties.translators = (this.node.properties.translators || []).filter(
      (_, i) => i !== idx
    );
    this.emitChange();
  }

  onTranslatorProtocolChange(t: TranslatorProcess, newProtocol: TranslatorProtocolType): void {
    t.protocol = newProtocol;
    const draft = this.getDraft(t);
    draft.metric = this.getDefaultMetric(newProtocol);
    this.emitChange();
  }

  isNetworkInTranslator(t: TranslatorProcess, networkAddr: string): boolean {
    return (t.networks || []).includes(networkAddr);
  }

  toggleTranslatorNetwork(t: TranslatorProcess, networkAddr: string): void {
    const current = t.networks || [];
    if (current.includes(networkAddr)) {
      t.networks = current.filter(n => n !== networkAddr);
    } else {
      t.networks = [...current, networkAddr];
    }
    this.emitChange();
  }

  addRedistribution(t: TranslatorProcess): void {
    const draft = this.getDraft(t);
    t.redistributions = [
      ...(t.redistributions || []),
      {
        id: this.cliService.generateId(),
        source: draft.source,
        sourceId: draft.sourceId,
        metric: draft.metric,
        subnets: t.protocol === 'ospf' ? draft.subnets : false
      }
    ];
    draft.sourceId = '';
    draft.metric = this.getDefaultMetric(t.protocol);
    this.emitChange();
  }

  removeRedistribution(t: TranslatorProcess, rIdx: number): void {
    t.redistributions = (t.redistributions || []).filter((_, i) => i !== rIdx);
    this.emitChange();
  }

  emitChange(): void {
    this.nodeChange.emit(this.node);
  }
}

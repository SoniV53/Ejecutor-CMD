import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DhcpConfig,
  NetworkNode,
  SecurityConfig
} from '../../models/redes.models';
import { CiscoCliService } from '../../services/cisco-cli.service';

@Component({
  selector: 'app-redes-services-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './redes-services-editor.component.html',
  styleUrls: ['./redes-services-editor.component.css']
})
export class RedesServicesEditorComponent {
  @Input({ required: true }) node!: NetworkNode;
  @Output() nodeChange = new EventEmitter<NetworkNode>();

  constructor(private readonly cliService: CiscoCliService) {}

  get security(): SecurityConfig {
    if (!this.node.properties.security) {
      this.node.properties.security = {
        enabled: false,
        enableSecret: '',
        consolePassword: '',
        vtyPassword: '',
        vtyLines: '0 2',
        adminVlan: { enabled: false, id: '900', ip: '', mask: '255.255.255.0' }
      };
    }
    if (!this.node.properties.security.adminVlan) {
      this.node.properties.security.adminVlan = {
        enabled: false,
        id: '900',
        ip: '',
        mask: '255.255.255.0'
      };
    }
    return this.node.properties.security;
  }

  get dhcp(): DhcpConfig {
    if (!this.node.properties.dhcp) {
      this.node.properties.dhcp = { pools: [], excludedAddresses: [] };
    }
    if (!this.node.properties.dhcp.pools) {
      this.node.properties.dhcp.pools = [];
    }
    if (!this.node.properties.dhcp.excludedAddresses) {
      this.node.properties.dhcp.excludedAddresses = [];
    }
    return this.node.properties.dhcp;
  }

  toggleSecurity(): void {
    const sec = this.security;
    sec.enabled = !sec.enabled;
    this.emitChange();
  }

  toggleAdminVlan(): void {
    const sec = this.security;
    sec.adminVlan.enabled = !sec.adminVlan.enabled;
    this.emitChange();
  }

  addDhcpExclusion(): void {
    const d = this.dhcp;
    d.excludedAddresses = [
      ...d.excludedAddresses,
      { id: this.cliService.generateId(), startIp: '', endIp: '' }
    ];
    this.emitChange();
  }

  removeDhcpExclusion(idx: number): void {
    const d = this.dhcp;
    d.excludedAddresses = d.excludedAddresses.filter((_, i) => i !== idx);
    this.emitChange();
  }

  addDhcpPool(): void {
    const d = this.dhcp;
    d.pools = [
      ...d.pools,
      {
        id: this.cliService.generateId(),
        name: '',
        networkIp: '',
        mask: '255.255.255.0',
        defaultRouter: '',
        dnsServer: ''
      }
    ];
    this.emitChange();
  }

  removeDhcpPool(idx: number): void {
    const d = this.dhcp;
    d.pools = d.pools.filter((_, i) => i !== idx);
    this.emitChange();
  }

  emitChange(): void {
    this.nodeChange.emit(this.node);
  }
}

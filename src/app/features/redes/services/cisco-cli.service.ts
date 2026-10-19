import { Injectable } from '@angular/core';
import {
  NetworkNode,
  NodeType,
  RouterNetworkInfo,
  TopologyTemplateType
} from '../models/redes.models';

@Injectable({
  providedIn: 'root'
})
export class CiscoCliService {
  generateId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  calculateWildcard(mask: string): string {
    if (!mask) return '0.0.0.255';
    return mask
      .split('.')
      .map(octet => 255 - (parseInt(octet, 10) || 0))
      .join('.');
  }

  getNetworkAddress(ip: string, mask: string): string {
    if (!ip || !mask) return '';
    const ipOctets = ip.split('.');
    const maskOctets = mask.split('.');
    if (ipOctets.length !== 4 || maskOctets.length !== 4) return '';
    return ipOctets
      .map((octet, i) => (parseInt(octet, 10) || 0) & (parseInt(maskOctets[i], 10) || 0))
      .join('.');
  }

  getRouterNetworks(router: NetworkNode | null | undefined): RouterNetworkInfo[] {
    if (!router) return [];
    const nets: RouterNetworkInfo[] = [];

    (router.properties.interfaces || []).forEach(i => {
      if (i.ip && i.mask && i.showInCli !== false) {
        nets.push({
          ip: i.ip,
          mask: i.mask,
          network: this.getNetworkAddress(i.ip, i.mask),
          wildcard: this.calculateWildcard(i.mask),
          label: `${i.name} (Física)`,
          connectedTo: i.connectedTo
        });
      }
    });

    (router.properties.subinterfaces || []).forEach(s => {
      const base = (router.properties.interfaces || []).find(i => i.name === s.baseInterface);
      if (base && base.showInCli === false) return;

      if (s.ip && s.mask) {
        nets.push({
          ip: s.ip,
          mask: s.mask,
          network: this.getNetworkAddress(s.ip, s.mask),
          wildcard: this.calculateWildcard(s.mask),
          label: `${s.baseInterface}.${s.vlan} (Subinterfaz)`,
          connectedTo: base ? base.connectedTo : null
        });
      }
    });

    return nets;
  }

  getTemplate(type: TopologyTemplateType): NetworkNode[] {
    if (type === 'subinterfaces') {
      const r0Id = this.generateId();
      const swId = this.generateId();
      return [
        {
          id: r0Id,
          type: 'router',
          name: 'R0_Subint',
          properties: {
            interfaces: [
              {
                id: this.generateId(),
                name: 'G0/0',
                ip: '192.168.10.1',
                mask: '255.255.255.0',
                connectedTo: swId
              }
            ],
            subinterfaces: [
              {
                id: this.generateId(),
                vlan: '100',
                ip: '192.168.50.1',
                mask: '255.255.255.0',
                baseInterface: 'G0/0'
              },
              {
                id: this.generateId(),
                vlan: '200',
                ip: '192.168.60.1',
                mask: '255.255.255.0',
                baseInterface: 'G0/0'
              }
            ],
            protocol: 'none',
            protocolData: {
              staticRoutes: [],
              eigrpAsn: '100',
              eigrpNetworks: [],
              ospfProcessId: '1',
              ospfArea: '0',
              ospfNetworks: [],
              ripNetworks: [],
              ripVersion: '2',
              bgpAsn: '100',
              bgpNeighbors: [],
              bgpNetworks: []
            },
            translators: [],
            dhcp: { pools: [], excludedAddresses: [] },
            security: {
              enabled: false,
              enableSecret: '',
              consolePassword: '',
              vtyPassword: '',
              vtyLines: '0 2',
              adminVlan: { enabled: false, id: '900', ip: '', mask: '255.255.255.0' }
            }
          }
        },
        {
          id: swId,
          type: 'switch',
          name: 'SW_Core',
          properties: {
            interfaces: [
              {
                id: this.generateId(),
                name: 'G0/1',
                ip: '',
                mask: '',
                connectedTo: r0Id
              }
            ],
            subinterfaces: [],
            vlans: [
              {
                id: '100',
                name: 'admin',
                portPrefix: 'Fa0/',
                startPort: '1',
                endPort: '10',
                isNative: true
              },
              {
                id: '200',
                name: 'mercadeo',
                portPrefix: 'Fa0/',
                startPort: '11',
                endPort: '20',
                isNative: false
              }
            ],
            trunks: [
              {
                id: this.generateId(),
                interface: 'G0/1',
                nativeVlan: '100',
                allowedVlans: '100,200,900'
              }
            ],
            nativeVlan: '100',
            protocol: 'none',
            protocolData: {
              staticRoutes: [],
              eigrpAsn: '1',
              eigrpNetworks: [],
              ospfProcessId: '1',
              ospfArea: '0',
              ospfNetworks: [],
              ripNetworks: [],
              ripVersion: '2',
              bgpAsn: '100',
              bgpNeighbors: [],
              bgpNetworks: []
            },
            translators: [],
            dhcp: { pools: [], excludedAddresses: [] },
            security: {
              enabled: false,
              enableSecret: '',
              consolePassword: '',
              vtyPassword: '',
              vtyLines: '0 2',
              adminVlan: { enabled: false, id: '900', ip: '', mask: '255.255.255.0' }
            }
          }
        }
      ];
    }

    if (type === 'static_rip') {
      const r1Id = this.generateId();
      const r2Id = this.generateId();
      return [
        {
          id: r1Id,
          type: 'router',
          name: 'Router_A',
          properties: {
            interfaces: [
              {
                id: this.generateId(),
                name: 'G0/0',
                ip: '50.1.15.1',
                mask: '255.255.255.0',
                connectedTo: r2Id
              },
              {
                id: this.generateId(),
                name: 'G0/1',
                ip: '192.168.10.1',
                mask: '255.255.255.0',
                connectedTo: null
              }
            ],
            subinterfaces: [],
            protocol: 'rip',
            protocolData: {
              networks: '',
              staticRoutes: [],
              eigrpAsn: '1',
              eigrpNetworks: [],
              ospfProcessId: '1',
              ospfArea: '0',
              ospfNetworks: [],
              ripVersion: '2',
              ripNetworks: [
                { network: '50.1.15.0', label: 'G0/0 (Física)' },
                { network: '192.168.10.0', label: 'G0/1 (Física)' }
              ],
              bgpAsn: '100',
              bgpNeighbors: [],
              bgpNetworks: []
            },
            translators: [],
            dhcp: { pools: [], excludedAddresses: [] },
            security: {
              enabled: false,
              enableSecret: '',
              consolePassword: '',
              vtyPassword: '',
              vtyLines: '0 2',
              adminVlan: { enabled: false, id: '900', ip: '', mask: '255.255.255.0' }
            }
          }
        },
        {
          id: r2Id,
          type: 'router',
          name: 'Router_B',
          properties: {
            interfaces: [
              {
                id: this.generateId(),
                name: 'G0/0',
                ip: '50.1.15.2',
                mask: '255.255.255.0',
                connectedTo: r1Id
              },
              {
                id: this.generateId(),
                name: 'G0/1',
                ip: '192.168.20.1',
                mask: '255.255.255.0',
                connectedTo: null
              }
            ],
            subinterfaces: [],
            protocol: 'rip',
            protocolData: {
              networks: '',
              staticRoutes: [],
              eigrpAsn: '1',
              eigrpNetworks: [],
              ospfProcessId: '1',
              ospfArea: '0',
              ospfNetworks: [],
              ripVersion: '2',
              ripNetworks: [
                { network: '50.1.15.0', label: 'G0/0 (Física)' },
                { network: '192.168.20.0', label: 'G0/1 (Física)' }
              ],
              bgpAsn: '200',
              bgpNeighbors: [],
              bgpNetworks: []
            },
            translators: [],
            dhcp: { pools: [], excludedAddresses: [] },
            security: {
              enabled: false,
              enableSecret: '',
              consolePassword: '',
              vtyPassword: '',
              vtyLines: '0 2',
              adminVlan: { enabled: false, id: '900', ip: '', mask: '255.255.255.0' }
            }
          }
        }
      ];
    }

    return [];
  }

  createDefaultNode(type: NodeType, count: number): NetworkNode {
    const defaultInt = type === 'router' ? 'G0/0' : type === 'switch' ? 'G0/1' : 'Fa0/1';
    return {
      id: this.generateId(),
      type,
      name: `${type.toUpperCase()}_${count + 1}`,
      properties: {
        gateway: '',
        interfaces: [
          {
            id: this.generateId(),
            name: defaultInt,
            ip: '',
            mask: '255.255.255.0',
            connectedTo: null
          }
        ],
        vlans: [],
        trunks: [],
        nativeVlan: '',
        protocol: 'none',
        protocolData: {
          networks: '',
          routes: '',
          processId: '1',
          area: '0',
          asn: '1',
          staticRoutes: [],
          eigrpAsn: '1',
          eigrpNetworks: [],
          ospfProcessId: '1',
          ospfArea: '0',
          ospfNetworks: [],
          ripVersion: '2',
          ripNetworks: [],
          bgpAsn: '100',
          bgpNeighbors: [],
          bgpNetworks: []
        },
        translators: [],
        subinterfaces: [],
        dhcp: { pools: [], excludedAddresses: [] },
        security: {
          enabled: false,
          enableSecret: '',
          consolePassword: '',
          vtyPassword: '',
          vtyLines: '0 2',
          adminVlan: { enabled: false, id: '900', ip: '', mask: '255.255.255.0' }
        }
      }
    };
  }

  generateConfig(node: NetworkNode | null | undefined, allNodes: NetworkNode[]): string {
    if (!node) return '';
    let config = `! --- Configuración para ${node.name} ---\n`;
    config += `hostname ${node.name}\n`;

    if (node.type === 'pc') {
      const primary = node.properties.interfaces?.[0];
      config += `! Configuración en terminal de PC:\n`;
      config += `ip address ${primary?.ip || 'DHCP'} ${primary?.mask || '255.255.255.0'}\n`;
      config += `ip default-gateway ${node.properties.gateway || '0.0.0.0'}\n`;
      return config;
    }

    config += `enable\nconf t\n`;

    const sec = node.properties.security;
    if (sec && sec.enabled) {
      config += `! --- Seguridad ---\n`;
      if (sec.enableSecret) config += `enable secret ${sec.enableSecret}\n`;
      config += `line console 0\n`;
      if (sec.consolePassword) config += ` password ${sec.consolePassword}\n`;
      config += ` login\nexit\n`;
      config += `line vty ${sec.vtyLines || '0 2'}\n`;
      if (sec.vtyPassword) config += ` password ${sec.vtyPassword}\n`;
      config += ` login\nexit\n`;

      if (node.type === 'switch' && sec.adminVlan && sec.adminVlan.enabled) {
        config += `interface Vlan${sec.adminVlan.id || '900'}\n ip address ${sec.adminVlan.ip || '192.168.70.2'} ${sec.adminVlan.mask || '255.255.255.0'}\n no shutdown\nexit\n`;
        if (sec.adminVlan.gateway) {
          config += `ip default-gateway ${sec.adminVlan.gateway}\n`;
        }
      }
    }

    if (node.type === 'switch') {
      // Creación de VLANs definidas por el usuario
      if (node.properties.vlans) {
        node.properties.vlans.forEach(v => {
          if (v.id) {
            config += `vlan ${v.id}\n name ${v.name || 'VLAN' + v.id}\nexit\n`;
          }
        });
      }

      // Creación de VLANs Nativas SOLO si el usuario no las declaró arriba explícitamente
      const definedVlans = new Set(
        (node.properties.vlans || []).map(v => String(v.id)).filter(Boolean)
      );
      const nativeVlansToCreate = new Set<string>();

      if (node.properties.nativeVlan && !definedVlans.has(String(node.properties.nativeVlan))) {
        nativeVlansToCreate.add(String(node.properties.nativeVlan));
      }
      if (node.properties.trunks) {
        node.properties.trunks.forEach(t => {
          if (t.nativeVlan && !definedVlans.has(String(t.nativeVlan))) {
            nativeVlansToCreate.add(String(t.nativeVlan));
          }
        });
      }

      nativeVlansToCreate.forEach(vid => {
        config += `vlan ${vid}\n name NATIVA\nexit\n`;
      });

      // Puertos de Acceso (VLANs)
      if (node.properties.vlans) {
        node.properties.vlans.forEach(v => {
          let interfaceCmd = '';
          if (v.portPrefix || v.startPort) {
            if (v.endPort && v.endPort !== v.startPort) {
              interfaceCmd = `interface range ${v.portPrefix || 'Fa0/'}${v.startPort}-${v.endPort}`;
            } else if (v.startPort) {
              interfaceCmd = `interface ${v.portPrefix || 'Fa0/'}${v.startPort}`;
            }
          } else if (v.range) {
            interfaceCmd = `interface range ${v.range}`;
          }

          if (interfaceCmd && v.id) {
            config += `${interfaceCmd}\n`;
            config += ` switchport mode access\n`;
            config += ` switchport access vlan ${v.id}\nexit\n`;
          }
        });
      }

      // Puertos Troncales Explícitos
      if (node.properties.trunks && node.properties.trunks.length > 0) {
        node.properties.trunks.forEach(t => {
          if (t.interface) {
            config += `interface ${t.interface}\n`;
            config += ` switchport mode trunk\n`;
            if (t.nativeVlan) config += ` switchport trunk native vlan ${t.nativeVlan}\n`;
            if (t.allowedVlans) config += ` switchport trunk allowed vlan ${t.allowedVlans}\n`;
            config += `exit\n`;
          }
        });
      }

      // Configuración de Interfaces Restantes
      (node.properties.interfaces || []).forEach(int => {
        if (int.showInCli === false) return;

        const targetNode = allNodes.find(n => n.id === int.connectedTo);
        const isExplicitTrunk =
          node.properties.trunks && node.properties.trunks.find(t => t.interface === int.name);

        if (!isExplicitTrunk && targetNode && targetNode.type === 'router') {
          config += `interface ${int.name}\n`;
          config += ` switchport mode trunk\n`;
          if (node.properties.nativeVlan) {
            config += ` switchport trunk native vlan ${node.properties.nativeVlan}\n`;
          }
          const allowed = (node.properties.vlans || []).map(v => v.id).filter(Boolean);
          if (node.properties.nativeVlan && !allowed.includes(node.properties.nativeVlan)) {
            allowed.push(node.properties.nativeVlan);
          } else if (
            node.properties.nativeVlan &&
            allowed.filter(v => v === node.properties.nativeVlan).length === 0
          ) {
            allowed.push(node.properties.nativeVlan);
          }
          if (allowed.length > 0) {
            config += ` switchport trunk allowed vlan ${allowed.join(',')}\n`;
          }
          config += `exit\n`;
        } else if (int.ip) {
          config += `interface ${int.name}\n`;
          config += ` ip address ${int.ip} ${int.mask}\nno shut\nexit\n`;
        }
      });
    }

    if (node.type === 'router') {
      // Interfaces Base y Subinterfaces
      (node.properties.interfaces || []).forEach(int => {
        if (int.showInCli === false) return;

        const subs = (node.properties.subinterfaces || []).filter(
          s => s.baseInterface === int.name
        );
        if (subs.length > 0) {
          config += `interface ${int.name}\n no shutdown\nexit\n`;
          subs.forEach(sub => {
            config += `interface ${int.name}.${sub.vlan}\n`;
            config += ` encapsulation dot1Q ${sub.vlan}\n`;
            config += ` ip address ${sub.ip} ${sub.mask}\n`;
            config += ` no shutdown\nexit\n`;
          });
        } else if (int.ip) {
          config += `interface ${int.name}\n`;
          config += ` ip address ${int.ip} ${int.mask}\nno shutdown\nexit\n`;
        }
      });

      // 1. Protocolo Base (Configuración Simple)
      const p = node.properties.protocol;
      const pd = node.properties.protocolData;

      if (p === 'static' && pd?.staticRoutes) {
        pd.staticRoutes.forEach(r => {
          config += `ip route ${r.network} ${r.mask} ${r.nextHop}\n`;
        });
      } else if (p === 'eigrp') {
        config += `router eigrp ${pd?.eigrpAsn || '1'}\n`;
        if (pd?.eigrpNetworks) {
          pd.eigrpNetworks.forEach(n => {
            config += ` network ${n.network} ${n.wildcard}\n`;
          });
        }
        config += ` no auto-summary\nexit\n`;
      } else if (p === 'ospf') {
        config += `router ospf ${pd?.ospfProcessId || '1'}\n`;
        if (pd?.ospfNetworks) {
          pd.ospfNetworks.forEach(n => {
            config += ` network ${n.network} ${n.wildcard} area ${n.area || '0'}\n`;
          });
        }
        config += `exit\n`;
      } else if (p === 'rip') {
        config += `router rip\n version ${pd?.ripVersion || '2'}\n`;
        if (pd?.ripNetworks && pd.ripNetworks.length > 0) {
          pd.ripNetworks.forEach(n => {
            config += ` network ${n.network}\n`;
          });
        } else if (pd?.networks) {
          pd.networks.split(',').forEach(n => {
            if (n.trim()) config += ` network ${n.trim()}\n`;
          });
        }
        config += ` no auto-summary\nexit\n`;
      } else if (p === 'bgp') {
        config += `router bgp ${pd?.bgpAsn || '100'}\n`;
        if (pd?.bgpNeighbors) {
          pd.bgpNeighbors.forEach(n => {
            config += ` neighbor ${n.ip} remote-as ${n.remoteAs}\n`;
          });
        }
        if (pd?.bgpNetworks) {
          pd.bgpNetworks.forEach(n => {
            config += ` network ${n.network} mask ${n.mask}\n`;
          });
        }
        config += `exit\n`;
      }

      // 2. Módulo Traductor de Protocolos (Multi-Protocolo con Redistribución)
      if (node.properties.translators && node.properties.translators.length > 0) {
        config += `\n! --- Traductor de Protocolos (Redistribución Avanzada) ---\n`;
        const allNets = this.getRouterNetworks(node);

        node.properties.translators.forEach(t => {
          if (t.protocol === 'rip') {
            config += `router rip\n version 2\n`;
            (t.networks || []).forEach(netAddr => {
              config += ` network ${netAddr}\n`;
            });
            (t.redistributions || []).forEach(r => {
              config += ` redistribute ${r.source}`;
              if (['ospf', 'eigrp', 'bgp'].includes(r.source) && r.sourceId) {
                config += ` ${r.sourceId}`;
              }
              if (r.metric) config += ` metric ${r.metric}`;
              config += `\n`;
            });
            config += ` no auto-summary\nexit\n`;
          } else if (t.protocol === 'ospf') {
            config += `router ospf ${t.processId || '1'}\n`;
            (t.networks || []).forEach(netAddr => {
              const netObj = allNets.find(n => n.network === netAddr);
              const wc = netObj ? netObj.wildcard : '0.0.0.255';
              config += ` network ${netAddr} ${wc} area 0\n`;
            });
            (t.redistributions || []).forEach(r => {
              config += ` redistribute ${r.source}`;
              if (['ospf', 'eigrp', 'bgp'].includes(r.source) && r.sourceId) {
                config += ` ${r.sourceId}`;
              }
              if (r.subnets) config += ` subnets`;
              if (r.metric) config += ` metric ${r.metric}`;
              config += `\n`;
            });
            config += `exit\n`;
          } else if (t.protocol === 'eigrp') {
            config += `router eigrp ${t.processId || '1'}\n`;
            (t.networks || []).forEach(netAddr => {
              const netObj = allNets.find(n => n.network === netAddr);
              const wc = netObj ? netObj.wildcard : '0.0.0.255';
              config += ` network ${netAddr} ${wc}\n`;
            });
            (t.redistributions || []).forEach(r => {
              config += ` redistribute ${r.source}`;
              if (['ospf', 'eigrp', 'bgp'].includes(r.source) && r.sourceId) {
                config += ` ${r.sourceId}`;
              }
              if (r.metric) config += ` metric ${r.metric}`;
              config += `\n`;
            });
            config += ` no auto-summary\nexit\n`;
          }
        });
      }
    }

    // 3. Módulo de Servidor DHCP
    if (node.properties.dhcp && (node.type === 'router' || node.type === 'switch')) {
      if (
        node.properties.dhcp.excludedAddresses &&
        node.properties.dhcp.excludedAddresses.length > 0
      ) {
        config += `\n! --- DHCP Exclusions ---\n`;
        node.properties.dhcp.excludedAddresses.forEach(ex => {
          if (ex.startIp) {
            config += `ip dhcp excluded-address ${ex.startIp}`;
            if (ex.endIp) config += ` ${ex.endIp}`;
            config += `\n`;
          }
        });
      }

      if (node.properties.dhcp.pools && node.properties.dhcp.pools.length > 0) {
        config += `\n! --- DHCP Pools ---\n`;
        node.properties.dhcp.pools.forEach(pool => {
          if (pool.name) {
            config += `ip dhcp pool ${pool.name}\n`;
            if (pool.networkIp) {
              config += ` network ${pool.networkIp} ${pool.mask || '255.255.255.0'}\n`;
            }
            if (pool.defaultRouter) {
              config += ` default-router ${pool.defaultRouter}\n`;
            }
            if (pool.dnsServer) {
              config += ` dns-server ${pool.dnsServer}\n`;
            }
            config += `exit\n`;
          }
        });
      }
    }

    config += `end\nwrite\n`;
    return config;
  }
}

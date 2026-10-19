export type NodeType = 'pc' | 'switch' | 'router';

export type RoutingProtocolType = 'none' | 'static' | 'ospf' | 'eigrp' | 'rip' | 'bgp';

export type TranslatorProtocolType = 'rip' | 'ospf' | 'eigrp';

export type RedistributionSourceType = 'ospf' | 'eigrp' | 'rip' | 'bgp' | 'static' | 'connected';

export type TopologyTemplateType = 'subinterfaces' | 'static_rip';

export interface NodeInterface {
  id: string;
  name: string;
  ip: string;
  mask: string;
  connectedTo: string | null;
  showInCli?: boolean;
}

export interface NodeSubinterface {
  id: string;
  vlan: string;
  ip: string;
  mask: string;
  baseInterface: string;
}

export interface SwitchVlan {
  id: string;
  name: string;
  portPrefix?: string;
  startPort?: string;
  endPort?: string;
  range?: string;
  isNative?: boolean;
}

export interface SwitchTrunk {
  id: string;
  interface: string;
  nativeVlan: string;
  allowedVlans: string;
}

export interface StaticRoute {
  network: string;
  mask: string;
  nextHop: string;
  label?: string;
}

export interface OspfNetwork {
  network: string;
  wildcard: string;
  area: string;
  label?: string;
}

export interface EigrpNetwork {
  network: string;
  wildcard: string;
  label?: string;
}

export interface RipNetwork {
  network: string;
  label?: string;
}

export interface BgpNeighbor {
  id: string;
  ip: string;
  remoteAs: string;
}

export interface BgpNetwork {
  network: string;
  mask: string;
  label?: string;
}

export interface RoutingProtocolData {
  networks?: string;
  routes?: string;
  processId?: string;
  area?: string;
  asn?: string;
  staticRoutes: StaticRoute[];
  eigrpAsn: string;
  eigrpNetworks: EigrpNetwork[];
  ospfProcessId: string;
  ospfArea: string;
  ospfNetworks: OspfNetwork[];
  ripVersion: string;
  ripNetworks: RipNetwork[];
  bgpAsn: string;
  bgpNeighbors: BgpNeighbor[];
  bgpNetworks: BgpNetwork[];
}

export interface TranslatorRedistribution {
  id: string;
  source: RedistributionSourceType;
  sourceId: string;
  metric: string;
  subnets?: boolean;
}

export interface TranslatorProcess {
  id: string;
  protocol: TranslatorProtocolType;
  processId: string;
  networks: string[];
  redistributions: TranslatorRedistribution[];
}

export interface AdminVlanConfig {
  enabled: boolean;
  id: string;
  ip: string;
  mask: string;
  gateway?: string;
}

export interface SecurityConfig {
  enabled: boolean;
  enableSecret: string;
  consolePassword: string;
  vtyPassword: string;
  vtyLines: string;
  loginLocal?: boolean;
  adminVlan: AdminVlanConfig;
}

export interface DhcpExclusion {
  id: string;
  startIp: string;
  endIp: string;
}

export interface DhcpPool {
  id: string;
  name: string;
  networkIp: string;
  mask: string;
  defaultRouter: string;
  dnsServer: string;
}

export interface DhcpConfig {
  pools: DhcpPool[];
  excludedAddresses: DhcpExclusion[];
}

export interface RouterNetworkInfo {
  ip: string;
  mask: string;
  network: string;
  wildcard: string;
  label: string;
  connectedTo: string | null;
}

export interface NodeProperties {
  gateway?: string;
  interfaces: NodeInterface[];
  subinterfaces: NodeSubinterface[];
  vlans?: SwitchVlan[];
  trunks?: SwitchTrunk[];
  nativeVlan?: string;
  protocol: RoutingProtocolType;
  protocolData: RoutingProtocolData;
  translators: TranslatorProcess[];
  dhcp: DhcpConfig;
  security?: SecurityConfig;
}

export interface NetworkNode {
  id: string;
  type: NodeType;
  name: string;
  properties: NodeProperties;
}

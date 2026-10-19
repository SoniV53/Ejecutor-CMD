export interface CmdProject {
  id: string;
  name: string;
  path: string;
}

export interface CmdScriptVariant {
  label: string;
  code: string;
}

export interface CmdCommandItem {
  id: string;
  label: string;
  category: string;
  color: 'indigo' | 'emerald' | 'rose' | 'amber' | string;
  projectId?: string | null;
  background?: boolean;
  multiSelect?: boolean;
  script?: string;
  scripts?: (string | CmdScriptVariant)[];
}

export interface CmdCategoryItem {
  name: string;
  projectId: string | null;
}

export interface CmdWorkspaceData {
  projects: CmdProject[];
  commands: CmdCommandItem[];
  categories: (string | CmdCategoryItem)[];
}

export interface CmdStreamEvent {
  type: 'start' | 'stdout' | 'stderr' | 'exit';
  processId: string;
  pid?: number;
  command?: string;
  cwd?: string;
  text?: string;
  code?: number;
}

export interface CmdConsoleLog {
  id: string;
  label?: string;
  processId?: string;
  pid?: number;
  time: string;
  script: string;
  path: string;
  output: string;
  running: boolean;
  exitCode?: number | null;
}


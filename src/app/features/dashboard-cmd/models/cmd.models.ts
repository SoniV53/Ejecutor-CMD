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

export interface CmdConsoleLog {
  time: string;
  script: string;
  path: string;
}

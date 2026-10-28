export type BranchLifecycleState = 'En desarrollo' | 'QA' | 'Certificada';

export interface SubBranchContext {
  id: string;
  branchName: string;
  devName: string;
  notesOrCommits: string;
  linkedBranchId?: string;
}

export interface BranchFolderLink {
  id: string;
  label: string; // ej. "Drive", "OneDrive", "Compilados Android", etc.
  url: string; // ej. "https://drive.google.com/..." o "\\servidor\..."
  isPrimary?: boolean;
}

export interface TrackedBranch {
  id: string;
  name: string; // ej. feature/26102026/transferencias/mejora-selector
  moduleFlow: string; // ej. Transferencias, PENDO, Pagos
  featureTitle: string; // Nombre descriptivo del feature o validación
  state: BranchLifecycleState;
  qaVersions: string[]; // ej. ['6.10.13', '6.10.14']
  devs: string[]; // ej. ['Erick', 'Soni', 'Jose']
  objectivesSummary: string; // Objetivos, integraciones, control de errores
  rawCommitsOrDiff: string; // Commits o resúmenes pegados para análisis
  subBranches: SubBranchContext[];
  buildFolderUrl?: string; // Carpeta o enlace principal de la nube para compilados
  folderLinks?: BranchFolderLink[]; // Lista de enlaces o carpetas guardadas
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseBlockRecord {
  id: string;
  name: string;
  moduleFlow: string;
  branchIds: string[];
  generatedMrText: string;
  createdAt: string;
}

export interface ReleaseEmailContact {
  id: string;
  email: string;
  name?: string;
  type: 'to' | 'cc';
  selected?: boolean;
}

export interface ExcelDesignPreset {
  id: string;
  name: string;
  titleBgColor: string;
  titleTextColor: string;
  tableTheme: string;
  headerBgPreview: string;
}

export interface ExcelDesignConfig {
  presetId: string;
  titleBgColor: string;
  titleTextColor: string;
  tableTheme: string;
}

export interface GravityLeadWorkspace {
  branches: TrackedBranch[];
  releaseBlocks: ReleaseBlockRecord[];
  availableDevs?: string[];
  availableFlows?: string[];
  savedEmailContacts?: ReleaseEmailContact[];
  excelDesign?: ExcelDesignConfig;
}


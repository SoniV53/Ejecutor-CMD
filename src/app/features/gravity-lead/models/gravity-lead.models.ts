export type BranchLifecycleState = 'En desarrollo' | 'QA' | 'Certificada';

export interface SubBranchContext {
  id: string;
  branchName: string;
  devName: string;
  notesOrCommits: string;
  linkedBranchId?: string;
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

export interface GravityLeadWorkspace {
  branches: TrackedBranch[];
  releaseBlocks: ReleaseBlockRecord[];
  availableDevs?: string[];
  availableFlows?: string[];
}


export type RepoNoteColor = 'slate' | 'indigo' | 'amber' | 'emerald' | 'rose';

export interface RepoNote {
  id: string;
  targetType: 'branch' | 'folder';
  targetId: string;
  title: string;
  content: string;
  color: RepoNoteColor;
  pinned?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RepoFolder {
  id: string;
  name: string;
  parentId: string | null;
  desc?: string;
  isDefault?: boolean;
}

export interface RepoBranch {
  id: string;
  name: string;
  desc: string;
  parentId: string | null;
  folderId: string | null;
  isMain?: boolean;
  isRemote?: boolean;
  createdAt?: string;
  lastCommitHash?: string;
  lastCommitMsg?: string;
}

export interface RepoCommit {
  id: string;
  branchId: string;
  hash: string;
  message: string;
  date: string;
}

export interface RepoDocState {
  repoPath?: string;
  linkedProjectId?: string | null;
  folders: RepoFolder[];
  branches: RepoBranch[];
  commits: RepoCommit[];
  notes: RepoNote[];
}


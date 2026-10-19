export interface RepoFolder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface RepoBranch {
  id: string;
  name: string;
  desc: string;
  parentId: string | null;
  folderId: string | null;
  createdAt?: string;
}

export interface RepoCommit {
  id: string;
  branchId: string;
  hash: string;
  message: string;
  date: string;
}

export interface RepoDocState {
  folders: RepoFolder[];
  branches: RepoBranch[];
  commits: RepoCommit[];
}

export type RepoNoteColor = 'slate' | 'indigo' | 'amber' | 'emerald' | 'rose';

export interface RepoTag {
  id: string;
  name: string;
  color: string;
}

export interface TagColorOption {
  value: string;
  label: string;
  dotClass: string;
}

export const TAG_COLOR_OPTIONS: TagColorOption[] = [
  { value: 'indigo', label: 'Índigo', dotClass: 'bg-indigo-500' },
  { value: 'amber', label: 'Ámbar', dotClass: 'bg-amber-500' },
  { value: 'rose', label: 'Rosa / Prod', dotClass: 'bg-rose-500' },
  { value: 'emerald', label: 'Verde', dotClass: 'bg-emerald-500' },
  { value: 'sky', label: 'Cielo / QA', dotClass: 'bg-sky-500' },
  { value: 'purple', label: 'Púrpura', dotClass: 'bg-purple-500' },
  { value: 'slate', label: 'Gris', dotClass: 'bg-slate-500' }
];

export function getTagDotClass(color: string): string {
  const found = TAG_COLOR_OPTIONS.find(c => c.value === color);
  return found ? found.dotClass : 'bg-indigo-500';
}

export function getTagLabel(color: string): string {
  const found = TAG_COLOR_OPTIONS.find(c => c.value === color);
  return found ? found.label : color;
}

export const DEFAULT_REPO_TAGS: RepoTag[] = [];

export function getTagColorClasses(color: string = 'indigo'): {
  bg: string;
  text: string;
  border: string;
  badge: string;
} {
  switch (color) {
    case 'amber':
    case 'yellow':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-800 border-amber-200'
      };
    case 'rose':
    case 'red':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-800',
        border: 'border-rose-200',
        badge: 'bg-rose-100 text-rose-800 border-rose-200'
      };
    case 'emerald':
    case 'green':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200'
      };
    case 'sky':
    case 'blue':
      return {
        bg: 'bg-sky-50',
        text: 'text-sky-800',
        border: 'border-sky-200',
        badge: 'bg-sky-100 text-sky-800 border-sky-200'
      };
    case 'purple':
    case 'violet':
      return {
        bg: 'bg-purple-50',
        text: 'text-purple-800',
        border: 'border-purple-200',
        badge: 'bg-purple-100 text-purple-800 border-purple-200'
      };
    case 'teal':
      return {
        bg: 'bg-teal-50',
        text: 'text-teal-800',
        border: 'border-teal-200',
        badge: 'bg-teal-100 text-teal-800 border-teal-200'
      };
    case 'slate':
    default:
      return {
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
        badge: 'bg-slate-100 text-slate-700 border-slate-200'
      };
  }
}

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
  tags?: string[];
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
  availableTags?: RepoTag[];
}


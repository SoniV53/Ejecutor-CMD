export interface NoteTab {
  id: string;
  name: string;
  path?: string;
  fullPath?: string;
  content: string;
  savedContent: string;
  fileType: 'json' | 'txt' | 'md' | 'other';
  isDirty: boolean;
  isNew?: boolean;
}

export interface RenameModalData {
  oldPath: string;
  currentName: string;
}


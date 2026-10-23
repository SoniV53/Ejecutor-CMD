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
  storage?: 'local' | 'gdrive';
  driveFileId?: string;
}

export interface RenameModalData {
  oldPath: string;
  currentName: string;
}


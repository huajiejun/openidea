export interface EditorFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language?: string;
  readOnly?: boolean;
}

export interface VibeCodeEditorProps {
  files: EditorFile[];
  activeFileId?: string;
  onActiveFileChange?: (fileId: string) => void;
  onFileChange?: (fileId: string, newContent: string) => void;
  onSave?: (fileId: string, content: string) => void | Promise<void>;
  onCloseFile?: (fileId: string) => void;
  theme?: "dark" | "light";
  showSidebar?: boolean;
  showStatusBar?: boolean;
  className?: string;
  height?: string | number;
}

/**
 * Core types for InlineCMS
 */

export interface InlineCMSConfig {
  autosaveDelay: number;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export type ToastType = "success" | "error" | "warning" | "info";

export interface StatusState {
  state:
    | "idle"
    | "editing"
    | "typing"
    | "saving"
    | "saved"
    | "error"
    | "warning";
  text: string;
}

export interface HistoryEntry {
  content: string;
  timestamp: number;
  cursorPosition?: number;
}

export interface UndoRedoState {
  history: HistoryEntry[];
  currentIndex: number;
  maxHistorySize: number;
}

export interface Plugin {
  name: string;
  init(editor: InlineCMSEditor): void;
  handleKeydown?(e: KeyboardEvent): boolean;
  destroy?(): void;
}

export interface InlineCMSEditor {
  root: HTMLElement;
  config: InlineCMSConfig;
  updateStatus(status: StatusState): void;
  save(isManual?: boolean): void;
  triggerAutoSave(): void;
  insertTextAtCursor(text: string): void;
  getCurrentElement(): Node | null;
  debouncedSave(): void;
}

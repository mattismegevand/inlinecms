/**
 * Undo/Redo functionality for InlineCMS
 */

import type { HistoryEntry, UndoRedoState, InlineCMSEditor } from "../types";
import { getCursorPosition, setCursorPosition } from "../utils/dom";

export class UndoRedoManager {
  private state: UndoRedoState;
  private editor: InlineCMSEditor;
  private saveTimeout: number | null = null;
  private readonly SAVE_DELAY = 1000; // 1 second delay before saving to history

  constructor(editor: InlineCMSEditor, maxHistorySize = 50) {
    this.editor = editor;
    this.state = {
      history: [],
      currentIndex: -1,
      maxHistorySize,
    };

    // Save initial state
    this.saveState();
  }

  /**
   * Save current state to history (debounced)
   */
  saveState(immediate = false): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    const doSave = () => {
      const content = this.editor.root.innerHTML;
      const cursorPosition = getCursorPosition(this.editor.root);

      // Don't save if content hasn't changed
      const currentEntry = this.state.history[this.state.currentIndex];
      if (currentEntry && currentEntry.content === content) {
        return;
      }

      const entry: HistoryEntry = {
        content,
        timestamp: Date.now(),
        cursorPosition,
      };

      // Remove any history after current index (when undoing then making changes)
      this.state.history = this.state.history.slice(
        0,
        this.state.currentIndex + 1,
      );

      // Add new entry
      this.state.history.push(entry);
      this.state.currentIndex++;

      // Maintain max history size
      if (this.state.history.length > this.state.maxHistorySize) {
        this.state.history.shift();
        this.state.currentIndex--;
      }
    };

    if (immediate) {
      doSave();
    } else {
      this.saveTimeout = window.setTimeout(doSave, this.SAVE_DELAY);
    }
  }

  /**
   * Undo the last action
   */
  undo(): boolean {
    if (!this.canUndo()) return false;

    this.state.currentIndex--;
    const entry = this.state.history[this.state.currentIndex];
    if (!entry) return false;

    this.restoreState(entry);
    this.editor.updateStatus({ state: "editing", text: "↶ Undone" });

    // Show temporary status
    setTimeout(() => {
      this.editor.updateStatus({
        state: "editing",
        text: "✏️ Editing",
      });
    }, 1500);

    return true;
  }

  /**
   * Redo the next action
   */
  redo(): boolean {
    if (!this.canRedo()) return false;

    this.state.currentIndex++;
    const entry = this.state.history[this.state.currentIndex];
    if (!entry) return false;

    this.restoreState(entry);
    this.editor.updateStatus({ state: "editing", text: "↷ Redone" });

    // Show temporary status
    setTimeout(() => {
      this.editor.updateStatus({
        state: "editing",
        text: "✏️ Editing",
      });
    }, 1500);

    return true;
  }

  /**
   * Check if undo is possible
   */
  canUndo(): boolean {
    return this.state.currentIndex > 0;
  }

  /**
   * Check if redo is possible
   */
  canRedo(): boolean {
    return this.state.currentIndex < this.state.history.length - 1;
  }

  /**
   * Restore editor state from history entry
   */
  private restoreState(entry: HistoryEntry): void {
    this.editor.root.innerHTML = entry.content;

    // Restore cursor position
    if (entry.cursorPosition !== undefined) {
      setCursorPosition(this.editor.root, entry.cursorPosition);
    }

    // Trigger auto-save after restoration
    this.editor.triggerAutoSave();
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.state.history = [];
    this.state.currentIndex = -1;
    this.saveState(true);
  }

  /**
   * Get current history stats for debugging
   */
  getStats(): {
    total: number;
    current: number;
    canUndo: boolean;
    canRedo: boolean;
  } {
    return {
      total: this.state.history.length,
      current: this.state.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
  }
}

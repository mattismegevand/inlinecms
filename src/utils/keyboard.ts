/**
 * Keyboard utility functions
 */

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export class KeyboardManager {
  private shortcuts: KeyboardShortcut[] = [];

  addShortcut(shortcut: KeyboardShortcut): void {
    this.shortcuts.push(shortcut);
  }

  removeShortcut(
    key: string,
    modifiers?: { ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean },
  ): void {
    this.shortcuts = this.shortcuts.filter((shortcut) => {
      if (shortcut.key !== key) return true;
      if (
        modifiers?.ctrlKey !== undefined &&
        shortcut.ctrlKey !== modifiers.ctrlKey
      )
        return true;
      if (
        modifiers?.shiftKey !== undefined &&
        shortcut.shiftKey !== modifiers.shiftKey
      )
        return true;
      if (
        modifiers?.altKey !== undefined &&
        shortcut.altKey !== modifiers.altKey
      )
        return true;
      return false;
    });
  }

  handleKeydown(e: KeyboardEvent): boolean {
    for (const shortcut of this.shortcuts) {
      if (
        shortcut.key === e.key &&
        (shortcut.ctrlKey === undefined || shortcut.ctrlKey === e.ctrlKey) &&
        (shortcut.shiftKey === undefined || shortcut.shiftKey === e.shiftKey) &&
        (shortcut.altKey === undefined || shortcut.altKey === e.altKey)
      ) {
        shortcut.handler(e);
        return true; // Handled
      }
    }
    return false; // Not handled
  }

  destroy(): void {
    this.shortcuts = [];
  }
}

/**
 * InlineCMS - Modular TypeScript implementation
 * Provides inline editing capabilities for Astro markdown content
 */

import type {
  InlineCMSConfig,
  StatusState,
  Plugin,
  InlineCMSEditor,
} from "../types";
import { UndoRedoManager } from "./UndoRedoManager";
import { StatusManager, type StatusManagerCallbacks } from "./StatusManager";
import { KeyboardManager } from "../utils/keyboard";
import { getCurrentElement, insertTextAtCursor } from "../utils/dom";
import {
  MathPlugin,
  CodePlugin,
  ImagePlugin,
  ListPlugin,
  PostManagementPlugin,
} from "../plugins";
// CSS styles will be loaded via a separate file

export class InlineCMS implements InlineCMSEditor {
  public root: HTMLElement;
  public config: InlineCMSConfig;

  private statusManager: StatusManager;
  private undoRedoManager: UndoRedoManager;
  private keyboardManager: KeyboardManager;
  private plugins: Plugin[] = [];

  private isEditing = false;
  private saveTimeout: number | null = null;
  private originalContent = "";
  private saveRetryCount = 0;
  private readonly MAX_RETRIES = 3;

  constructor(root: HTMLElement, config: InlineCMSConfig) {
    this.root = root;
    this.config = config;

    // Create status manager
    const statusCallbacks: StatusManagerCallbacks = {};

    this.statusManager = new StatusManager(statusCallbacks);
    this.undoRedoManager = new UndoRedoManager(this);
    this.keyboardManager = new KeyboardManager();

    this.init();
  }

  private init(): void {
    this.setupRootElement();
    this.addStyles();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.initializePlugins();
    this.captureOriginalContent();
  }

  private setupRootElement(): void {
    this.root.contentEditable = "true";
    this.root.style.outline = "none";
  }

  private addStyles(): void {
    const styles = document.createElement("style");
    styles.textContent = this.getStyles();
    document.head.appendChild(styles);
  }

  private getStyles(): string {
    return `
      [data-markdown] {
        transition: all 0.2s ease;
        border: 2px dashed transparent;
        border-radius: 8px;
        padding: 16px;
        margin: -16px;
        min-height: 50px;
        position: relative;
      }
      
      [data-markdown]:hover {
        border-color: #e2e8f0;
        background: rgba(59, 130, 246, 0.02);
      }

      [data-markdown]:focus {
        outline: none;
        border-color: #3b82f6;
        background: rgba(59, 130, 246, 0.05);
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .inlinecms-editing {
        border-color: #3b82f6 !important;
        background: rgba(59, 130, 246, 0.05) !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .inlinecms-status {
        position: fixed;
        top: 20px;
        right: 20px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        z-index: 9999;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        min-width: 100px;
        cursor: default;
        opacity: 0.9;
      }

      .inlinecms-status-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        min-height: 20px;
      }

      .inlinecms-status-text {
        flex: 1;
        text-align: center;
      }

      
      .inlinecms-status-idle {
        background: #f1f5f9;
        color: #64748b;
        opacity: 0.8;
      }
      
      .inlinecms-status-editing {
        background: #3b82f6;
        color: white;
      }
      
      .inlinecms-status-saving {
        background: #f59e0b;
        color: white;
      }
      
      .inlinecms-status-saved {
        background: #10b981;
        color: white;
      }
      
      .inlinecms-status-typing {
        background: #6366f1;
        color: white;
      }
      
      .inlinecms-status-warning {
        background: #f59e0b;
        color: white;
        animation: pulse 2s ease-in-out infinite;
      }
      
      .inlinecms-status-error {
        background: #ef4444;
        color: white;
      }
      
      .inlinecms-drag-over {
        border-color: #3b82f6 !important;
        background: rgba(59, 130, 246, 0.1) !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2) !important;
      }
      
      .inlinecms-retry-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
      }
      
      .inlinecms-retry-content {
        background: white;
        border-radius: 8px;
        padding: 24px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        text-align: center;
      }
      
      .inlinecms-retry-content h3 {
        margin: 0 0 12px 0;
        font-size: 18px;
        color: #dc2626;
      }
      
      .inlinecms-retry-content p {
        margin: 0 0 20px 0;
        color: #64748b;
        line-height: 1.5;
      }
      
      .inlinecms-retry-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
      }
      
      .inlinecms-retry-btn {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .inlinecms-retry-btn:hover {
        background: #2563eb;
      }
      
      .inlinecms-dismiss-btn {
        background: #f1f5f9;
        color: #64748b;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      
      .inlinecms-dismiss-btn:hover {
        background: #e2e8f0;
      }
      
      [data-markdown] .katex,
      [data-markdown] .MathJax {
        transition: all 0.2s ease;
        border-radius: 4px;
        padding: 2px 4px;
        position: relative;
      }
      
      [data-markdown] .katex:hover,
      [data-markdown] .MathJax:hover {
        background: rgba(59, 130, 246, 0.1);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      
      [data-markdown] .katex::after,
      [data-markdown] .MathJax::after {
        content: '✏️';
        position: absolute;
        top: -20px;
        right: -5px;
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      [data-markdown] .katex:hover::after,
      [data-markdown] .MathJax:hover::after {
        opacity: 1;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
  }

  private captureOriginalContent(): void {
    this.originalContent = this.root.innerHTML;
  }

  private initializePlugins(): void {
    // Initialize default plugins
    this.plugins = [
      new MathPlugin(),
      new CodePlugin(),
      new ImagePlugin(),
      new ListPlugin(),
      new PostManagementPlugin(),
    ];

    // Initialize all plugins
    this.plugins.forEach((plugin) => {
      plugin.init(this);
    });
  }

  private setupEventListeners(): void {
    // Focus/blur events
    this.root.addEventListener("focus", () => this.handleFocus());
    this.root.addEventListener("blur", () => this.handleBlur());

    // Input events
    this.root.addEventListener("input", () => this.handleInput());

    // Keyboard events
    this.root.addEventListener("keydown", (e) => this.handleKeydown(e));
  }

  private setupKeyboardShortcuts(): void {
    // Core shortcuts
    this.keyboardManager.addShortcut({
      key: "s",
      ctrlKey: true,
      handler: (e) => {
        e.preventDefault();
        this.save(true); // Manual save from keyboard shortcut
      },
    });

    this.keyboardManager.addShortcut({
      key: "z",
      ctrlKey: true,
      handler: (e) => {
        e.preventDefault();
        this.undoRedoManager.undo();
      },
    });

    this.keyboardManager.addShortcut({
      key: "y",
      ctrlKey: true,
      handler: (e) => {
        e.preventDefault();
        this.undoRedoManager.redo();
      },
    });

    this.keyboardManager.addShortcut({
      key: "z",
      ctrlKey: true,
      shiftKey: true,
      handler: (e) => {
        e.preventDefault();
        this.undoRedoManager.redo();
      },
    });

    this.keyboardManager.addShortcut({
      key: "b",
      ctrlKey: true,
      handler: (e) => {
        e.preventDefault();
        document.execCommand("bold");
      },
    });

    this.keyboardManager.addShortcut({
      key: "i",
      ctrlKey: true,
      handler: (e) => {
        e.preventDefault();
        document.execCommand("italic");
      },
    });

    this.keyboardManager.addShortcut({
      key: "k",
      ctrlKey: true,
      handler: (e) => {
        e.preventDefault();
        this.createLink();
      },
    });
  }

  private handleFocus(): void {
    if (!this.isEditing) {
      this.isEditing = true;
      this.root.classList.add("inlinecms-editing");
      this.updateStatus({
        state: "editing",
        text: this.statusManager.getEditingStatusText(),
      });
    }
  }

  private handleBlur(): void {
    this.isEditing = false;
    this.root.classList.remove("inlinecms-editing");
    this.updateStatus({
      state: "idle",
      text: this.statusManager.getIdleStatusText(),
    });
    
    // Save immediately when clicking out if there are unsaved changes
    if (this.statusManager["hasUnsavedChanges"]) {
      // Cancel any pending auto-save
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }
      // Save immediately
      this.save(true);
    }
  }

  private handleInput(): void {
    this.checkForChanges();
    this.updateStatus({
      state: "typing",
      text: this.statusManager.getTypingStatusText(),
    });
    this.undoRedoManager.saveState(); // Save state for undo/redo
    this.debouncedSave();
  }

  private handleKeydown(e: KeyboardEvent): void {
    // Try keyboard shortcuts first
    if (this.keyboardManager.handleKeydown(e)) {
      return;
    }

    // Try plugins (they handle heading backspace, list indentation, code blocks, etc.)
    for (const plugin of this.plugins) {
      if (plugin.handleKeydown && plugin.handleKeydown(e)) {
        return;
      }
    }

    // Last resort: Check for backspace that would merge content into code blocks
    // Only apply this if no plugin handled the event
    if (e.key === "Backspace" && this.wouldMergeIntoCodeBlock()) {
      e.preventDefault();
      return;
    }
  }

  /**
   * Check if backspace would merge content into a code block
   */
  private wouldMergeIntoCodeBlock(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    
    // Only check if cursor is at the start of a text node (offset 0)
    if (range.startOffset !== 0 || range.startContainer.nodeType !== Node.TEXT_NODE) {
      return false;
    }

    const textNode = range.startContainer;
    const currentElement = textNode.parentElement;
    
    // Don't interfere if we're already inside a code block
    if (currentElement?.closest('pre code')) {
      return false;
    }

    // Don't interfere if we're inside a heading (let ListPlugin handle it)
    if (currentElement?.closest('h1, h2, h3, h4, h5, h6')) {
      return false;
    }

    // Don't interfere if we're inside a list item (let ListPlugin handle it)
    if (currentElement?.closest('li')) {
      return false;
    }

    // Find the previous sibling element
    let prevElement = this.findPreviousElement(textNode);
    
    // Check if the previous element is a code block
    return prevElement?.tagName === 'PRE' && prevElement.querySelector('code') !== null;
  }

  /**
   * Find the previous element that would be affected by backspace
   */
  private findPreviousElement(node: Node): Element | null {
    let current: Node | null = node;
    
    // Walk backwards through the DOM to find the previous element
    while (current) {
      // Check previous sibling
      let prev = current.previousSibling;
      while (prev) {
        if (prev.nodeType === Node.ELEMENT_NODE) {
          return prev as Element;
        }
        if (prev.nodeType === Node.TEXT_NODE && prev.textContent?.trim()) {
          // Found non-empty text, no merge would happen
          return null;
        }
        prev = prev.previousSibling;
      }
      
      // Move up to parent and continue searching
      current = current.parentNode;
      if (!current || current === this.root) break;
    }
    
    return null;
  }

  private checkForChanges(): void {
    const currentContent = this.root.innerHTML;
    const hasUnsavedChanges = currentContent !== this.originalContent;
    this.statusManager.setUnsavedChanges(hasUnsavedChanges);

    // Update window beforeunload warning
    if (hasUnsavedChanges) {
      window.addEventListener("beforeunload", this.handleBeforeUnload);
    } else {
      window.removeEventListener("beforeunload", this.handleBeforeUnload);
    }
  }

  private handleBeforeUnload = (e: BeforeUnloadEvent): string | undefined => {
    if (this.statusManager["hasUnsavedChanges"]) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
    return undefined;
  };

  public debouncedSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    // Use 10 second delay for all auto-saves
    this.saveTimeout = window.setTimeout(() => {
      this.save();
    }, 10000); // 10 seconds
  }


  public save(isManual = false): void {
    this.saveWithRetry(0);
  }

  private async saveWithRetry(retryCount: number): Promise<void> {
    const isRetry = retryCount > 0;
    const statusText = isRetry
      ? `💾 Retrying... (${retryCount}/${this.MAX_RETRIES})`
      : "💾 Saving...";

    this.updateStatus({ state: "saving", text: statusText });

    try {
      const response = await fetch("/__save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: location.pathname,
          html: this.root.innerHTML,
        }),
      });

      if (response.ok) {
        this.handleSaveSuccess();
      } else {
        const errorText = await response.text().catch(() => "Unknown error");
        this.handleSaveError(`Server error: ${response.status}`, retryCount);
      }
    } catch (error) {
      const errorMessage =
        error instanceof TypeError ? "Network error" : String(error);
      this.handleSaveError(errorMessage, retryCount);
    }
  }

  private handleSaveSuccess(): void {
    this.saveRetryCount = 0;
    this.originalContent = this.root.innerHTML;
    this.statusManager.setUnsavedChanges(false);
    window.removeEventListener("beforeunload", this.handleBeforeUnload);

    this.updateStatus({ state: "saved", text: "✅ Saved" });

    setTimeout(() => {
      const newState = this.isEditing ? "editing" : "idle";
      const newText = this.isEditing
        ? this.statusManager.getEditingStatusText()
        : this.statusManager.getIdleStatusText();
      this.updateStatus({ state: newState, text: newText });
    }, 1500);
  }

  private handleSaveError(errorMessage: string, retryCount: number): void {
    console.error("[Save error]", errorMessage);

    if (retryCount < this.MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        this.saveWithRetry(retryCount + 1);
      }, delay);
    } else {
      this.updateStatus({ state: "error", text: "❌ Save failed" });
      this.statusManager.showRetryDialog(() => this.save(true)); // Manual retry
    }
  }

  public getCurrentElement(): Node | null {
    return getCurrentElement();
  }

  public insertTextAtCursor(text: string): void {
    insertTextAtCursor(text);
  }

  public updateStatus(status: StatusState): void {
    this.statusManager.updateStatus(status);
  }

  public triggerAutoSave(): void {
    this.checkForChanges();
    this.updateStatus({
      state: "typing",
      text: this.statusManager.getTypingStatusText(),
    });
    this.debouncedSave();
  }

  private createLink(): void {
    const selection = window.getSelection();
    if (!selection) return;

    const selectedText = selection.toString();

    const url = prompt("Enter URL:", "https://");
    if (!url) return;

    if (selectedText) {
      document.execCommand("createLink", false, url);
    } else {
      const linkText = prompt("Enter link text:", url);
      if (!linkText) return;

      const link = document.createElement("a");
      link.href = url;
      link.textContent = linkText;

      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.insertNode(link);

        range.setStartAfter(link);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    this.triggerAutoSave();
  }

  public destroy(): void {
    // Cleanup plugins
    this.plugins.forEach((plugin) => {
      if (plugin.destroy) {
        plugin.destroy();
      }
    });

    // Cleanup managers
    this.statusManager.destroy();
    this.undoRedoManager.destroy();
    this.keyboardManager.destroy();

    // Clear timeouts
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Remove event listeners
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }
}

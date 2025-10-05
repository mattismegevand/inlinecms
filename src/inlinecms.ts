/**
 * InlineCMS - Minimal inline markdown editor for Astro
 * Tinygrad-inspired: simple code, minimal abstractions, ~800 lines
 */

// ============================================================================
// Types
// ============================================================================

export interface InlineCMSConfig {
  contentDir: string;
  urlPattern?: string;
  autosaveDelay?: number;
  enabled?: boolean;
}

type StatusState = 'idle' | 'editing' | 'typing' | 'saving' | 'saved' | 'error' | 'warning';

interface HistoryEntry {
  content: string;
  timestamp: number;
  cursorPosition: number;
}

// ============================================================================
// DOM Utilities (inlined)
// ============================================================================

function getCurrentElement(): Node | null {
  const sel = window.getSelection();
  return sel?.anchorNode ?? null;
}

function insertText(text: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function getCursorPos(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

function setCursorPos(el: HTMLElement, pos: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  let charCount = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length || 0;
    if (charCount + len >= pos) {
      const range = document.createRange();
      range.setStart(node, pos - charCount);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    charCount += len;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

// ============================================================================
// Main Editor Class
// ============================================================================

export class InlineCMS {
  public root: HTMLElement;
  public config: InlineCMSConfig;

  // State
  private isEditing = false;
  private saveTimeout: number | null = null;
  private originalContent = '';
  private hasUnsavedChanges = false;

  // History
  private history: HistoryEntry[] = [];
  private historyIndex = -1;
  private historyTimeout: number | null = null;

  // UI
  private statusEl: HTMLElement;
  private statusText: HTMLElement;

  // Config
  private readonly MAX_RETRIES = 3;
  private readonly AUTO_SAVE_DELAY = 2000;
  private readonly HISTORY_SIZE = 50;

  constructor(root: HTMLElement, config: InlineCMSConfig) {
    this.root = root;
    this.config = config;
    this.statusEl = this.createStatus();
    this.statusText = this.statusEl.querySelector('.status-text')!;
    this.init();
  }

  private init(): void {
    this.root.contentEditable = 'true';
    this.root.style.outline = 'none';
    this.addStyles();
    this.originalContent = this.root.innerHTML;
    this.saveHistory();

    // Events
    this.root.addEventListener('focus', () => this.onFocus());
    this.root.addEventListener('blur', () => this.onBlur());
    this.root.addEventListener('input', () => this.onInput());
    this.root.addEventListener('keydown', (e) => this.onKey(e));

    this.setupPlugins();
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  private onFocus(): void {
    this.isEditing = true;
    this.root.classList.add('editing');
    this.updateStatus('editing', this.hasUnsavedChanges ? '✏️ Editing (unsaved)' : '✏️ Editing');
  }

  private onBlur(): void {
    this.isEditing = false;
    this.root.classList.remove('editing');
    this.updateStatus('idle', this.hasUnsavedChanges ? '⚠️ Unsaved' : '');
    if (this.hasUnsavedChanges) {
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.save();
    }
  }

  private onInput(): void {
    this.checkChanges();
    this.updateStatus('typing', '✏️ Typing...');
    this.saveHistory();
    this.debounceSave();
  }

  private onKey(e: KeyboardEvent): boolean {
    // Keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') { e.preventDefault(); this.save(); return true; }
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return true; }
      if (e.key === 'z' && e.shiftKey) { e.preventDefault(); this.redo(); return true; }
      if (e.key === 'y') { e.preventDefault(); this.redo(); return true; }
      if (e.key === 'b') { e.preventDefault(); document.execCommand('bold'); return true; }
      if (e.key === 'i') { e.preventDefault(); document.execCommand('italic'); return true; }
      if (e.key === 'k') { e.preventDefault(); this.createLink(); return true; }
    }

    // Plugins handle: headings, lists, code blocks
    const el = getCurrentElement();

    // Heading backspace at start
    if (e.key === 'Backspace' && window.getSelection()?.anchorOffset === 0) {
      const h = el?.parentElement?.closest('h1,h2,h3,h4,h5,h6') as HTMLHeadingElement;
      if (h) {
        e.preventDefault();
        const level = parseInt(h.tagName[1]);
        const content = h.innerHTML;
        const newTag = level === 1 ? 'p' : `h${level - 1}`;
        const newEl = document.createElement(newTag);
        newEl.innerHTML = content;
        h.replaceWith(newEl);
        if (newEl.firstChild) {
          const range = document.createRange();
          range.setStart(newEl.firstChild, 0);
          range.collapse(true);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
        this.debounceSave();
        return true;
      }
    }

    // List Tab/Shift+Tab
    if (e.key === 'Tab') {
      const li = this.findLI(el);
      if (li) {
        e.preventDefault();
        e.shiftKey ? this.outdentLI(li) : this.indentLI(li);
        this.debounceSave();
        return true;
      }
    }

    // Code blocks
    const code = this.findCode(el);
    if (code) {
      if (e.key === 'Enter') { e.preventDefault(); insertText('\n'); return true; }
      if (e.key === 'Tab') {
        e.preventDefault();
        e.shiftKey ? this.unindentCode(code) : insertText('    ');
        return true;
      }
      if (e.key.length === 1 || e.key === 'Delete' || e.key === 'Backspace') {
        setTimeout(() => this.cleanCode(code), 0);
      }
    }

    return false;
  }

  // ============================================================================
  // Undo/Redo
  // ============================================================================

  private saveHistory(immediate = false): void {
    if (this.historyTimeout) clearTimeout(this.historyTimeout);
    const doSave = () => {
      const content = this.root.innerHTML;
      const cur = this.history[this.historyIndex];
      if (cur && cur.content === content) return;

      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push({
        content,
        timestamp: Date.now(),
        cursorPosition: getCursorPos(this.root)
      });
      this.historyIndex++;
      if (this.history.length > this.HISTORY_SIZE) {
        this.history.shift();
        this.historyIndex--;
      }
    };
    immediate ? doSave() : (this.historyTimeout = window.setTimeout(doSave, 300));
  }

  private undo(): void {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    const entry = this.history[this.historyIndex];
    this.root.innerHTML = entry.content;
    setCursorPos(this.root, entry.cursorPosition);
    this.debounceSave();
    this.updateStatus('editing', '↶ Undone');
    setTimeout(() => this.updateStatus('editing', '✏️ Editing'), 1500);
  }

  private redo(): void {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    const entry = this.history[this.historyIndex];
    this.root.innerHTML = entry.content;
    setCursorPos(this.root, entry.cursorPosition);
    this.debounceSave();
    this.updateStatus('editing', '↷ Redone');
    setTimeout(() => this.updateStatus('editing', '✏️ Editing'), 1500);
  }

  // ============================================================================
  // Save
  // ============================================================================

  private checkChanges(): void {
    this.hasUnsavedChanges = this.root.innerHTML !== this.originalContent;
    if (this.hasUnsavedChanges) {
      window.addEventListener('beforeunload', this.beforeUnload);
    } else {
      window.removeEventListener('beforeunload', this.beforeUnload);
    }
  }

  private beforeUnload = (e: BeforeUnloadEvent) => {
    if (this.hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  };

  public updateStatus(state: StatusState, text: string): void {
    this.statusText.textContent = text;
    const warn = this.hasUnsavedChanges && (state === 'idle' || state === 'editing');
    this.statusEl.className = warn ? 'cms-status cms-status-warning' : `cms-status cms-status-${state}`;
    this.statusEl.style.display = (state === 'idle' && !this.hasUnsavedChanges) ? 'none' : 'block';
  }

  public debouncedSave(): void {
    this.debounceSave();
  }

  private debounceSave(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = window.setTimeout(() => this.save(), this.AUTO_SAVE_DELAY);
  }

  private async save(retry = 0): Promise<void> {
    this.updateStatus('saving', retry > 0 ? `💾 Retry ${retry}/${this.MAX_RETRIES}` : '💾 Saving...');

    try {
      const res = await fetch('/__save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname, html: this.root.innerHTML })
      });

      if (res.ok) {
        this.originalContent = this.root.innerHTML;
        this.hasUnsavedChanges = false;
        window.removeEventListener('beforeunload', this.beforeUnload);
        this.updateStatus('saved', '✅ Saved');
        setTimeout(() => {
          const state = this.isEditing ? 'editing' : 'idle';
          const text = this.isEditing ? '✏️ Editing' : '';
          this.updateStatus(state, text);
        }, 1500);
      } else if (retry < this.MAX_RETRIES) {
        setTimeout(() => this.save(retry + 1), Math.pow(2, retry) * 1000);
      } else {
        this.updateStatus('error', '❌ Failed');
        this.showRetryDialog();
      }
    } catch (err) {
      if (retry < this.MAX_RETRIES) {
        setTimeout(() => this.save(retry + 1), Math.pow(2, retry) * 1000);
      } else {
        this.updateStatus('error', '❌ Failed');
        this.showRetryDialog();
      }
    }
  }

  // ============================================================================
  // List Helpers
  // ============================================================================

  private findLI(node: Node | null): HTMLLIElement | null {
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
        return node as HTMLLIElement;
      }
      const li = (node as HTMLElement).closest?.('li');
      if (li) return li;
      node = node.parentNode;
    }
    return null;
  }

  private indentLI(li: HTMLLIElement): void {
    const prev = li.previousElementSibling as HTMLLIElement;
    if (!prev) return;
    const parent = li.parentElement!;
    let nested = prev.querySelector(':scope > ul, :scope > ol') as HTMLElement;
    if (!nested) {
      nested = document.createElement(parent.tagName.toLowerCase());
      prev.appendChild(nested);
    }
    nested.appendChild(li);
  }

  private outdentLI(li: HTMLLIElement): void {
    const parent = li.parentElement!;
    const grandLI = parent.parentElement?.closest('li') as HTMLLIElement;
    if (!grandLI) return;
    const greatList = grandLI.parentElement!;
    greatList.insertBefore(li, grandLI.nextSibling);
    if (parent.children.length === 0) parent.remove();
  }

  // ============================================================================
  // Code Block Helpers
  // ============================================================================

  private findCode(node: Node | null): HTMLElement | null {
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === 'CODE' && el.closest('pre')) return el;
      }
      node = node.parentNode;
    }
    return null;
  }

  private cleanCode(code: HTMLElement): void {
    const pos = this.getCursorOffsetIn(code);
    // Preserve text before clearing; reading textContent after innerHTML reset would be empty
    const txt = code.textContent || '';
    code.innerHTML = '';
    code.appendChild(document.createTextNode(txt));
    this.setCursorOffsetIn(code, pos);
  }

  private unindentCode(code: HTMLElement): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const text = range.startContainer.textContent || '';
    const offset = range.startOffset;
    let start = offset;
    while (start > 0 && text[start - 1] !== '\n') start--;
    let spaces = 0;
    for (let i = start; i < text.length && i < start + 4; i++) {
      if (text[i] === ' ') spaces++;
      else break;
    }
    if (spaces > 0) {
      range.startContainer.textContent = text.substring(0, start) + text.substring(start + spaces);
      range.setStart(range.startContainer, Math.max(start, offset - spaces));
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  private getCursorOffsetIn(el: HTMLElement): number {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    let offset = 0;
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node === range.startContainer) {
          offset += range.startOffset;
          break;
        }
        offset += node.textContent?.length || 0;
      }
    }
    return offset;
  }

  private setCursorOffsetIn(el: HTMLElement, offset: number): void {
    const sel = window.getSelection();
    if (!sel) return;
    const text = el.firstChild;
    if (text && text.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      const safe = Math.min(offset, text.textContent?.length || 0);
      range.setStart(text, safe);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  // ============================================================================
  // Plugins (Math, Image, Post Management)
  // ============================================================================

  private setupPlugins(): void {
    // Math elements
    const math = this.root.querySelectorAll('.katex, .MathJax');
    math.forEach(m => {
      const el = m as HTMLElement;
      el.contentEditable = 'false';
      el.style.cursor = 'pointer';
      el.onclick = () => this.editMath(el);
    });

    // Watch for new math elements
    new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes.forEach(n => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            const el = n as HTMLElement;
            if (el.classList?.contains('katex') || el.classList?.contains('MathJax')) {
              el.contentEditable = 'false';
              el.style.cursor = 'pointer';
              el.onclick = () => this.editMath(el);
            }
          }
        });
      });
    }).observe(this.root, { childList: true, subtree: true });

    // Image & Post Management plugins
    import('./plugins').then(({ setupImagePlugin, setupPostManagement }) => {
      setupImagePlugin(this);
      setupPostManagement();
    });
  }

  private editMath(el: HTMLElement): void {
    const ann = el.querySelector('annotation[encoding="application/x-tex"]');
    const src = ann?.textContent || '';
    const newLatex = prompt('Edit LaTeX:', src);
    if (newLatex === null || newLatex === src) return;
    const isDisplay = el.closest('.katex-display') !== null;
    const delim = isDisplay ? '$$' : '$';
    el.replaceWith(document.createTextNode(`${delim}${newLatex}${delim}`));
    this.debounceSave();
  }

  private createLink(): void {
    const sel = window.getSelection();
    if (!sel) return;
    const text = sel.toString();
    const url = prompt('URL:', 'https://');
    if (!url) return;
    if (text) {
      document.execCommand('createLink', false, url);
    } else {
      const linkText = prompt('Link text:', url);
      if (!linkText) return;
      const a = document.createElement('a');
      a.href = url;
      a.textContent = linkText;
      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.insertNode(a);
        range.setStartAfter(a);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    this.debounceSave();
  }

  // ============================================================================
  // UI
  // ============================================================================

  private createStatus(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'cms-status cms-status-idle';
    el.style.display = 'none';
    el.innerHTML = '<div class="status-main"><span class="status-text"></span></div>';
    document.body.appendChild(el);
    return el;
  }

  private showRetryDialog(): void {
    const dlg = document.createElement('div');
    dlg.className = 'cms-retry-dialog';
    dlg.innerHTML = `
      <div class="cms-retry-content">
        <h3>⚠️ Save Failed</h3>
        <p>Unable to save. Check your connection.</p>
        <div class="cms-retry-buttons">
          <button class="cms-retry-btn">Retry</button>
          <button class="cms-dismiss-btn">Dismiss</button>
        </div>
      </div>
    `;
    dlg.querySelector('.cms-retry-btn')!.addEventListener('click', () => {
      dlg.remove();
      this.save();
    });
    dlg.querySelector('.cms-dismiss-btn')!.addEventListener('click', () => dlg.remove());
    document.body.appendChild(dlg);
    setTimeout(() => dlg.remove(), 10000);
  }

  private addStyles(): void {
    const s = document.createElement('style');
    s.textContent = `
      [data-markdown] {
        transition: all 0.2s;
        border: 2px dashed transparent;
        border-radius: 8px;
        padding: 16px;
        margin: -16px;
        min-height: 50px;
      }
      [data-markdown]:hover {
        border-color: #e2e8f0;
        background: rgba(59,130,246,0.02);
      }
      [data-markdown]:focus, .editing {
        outline: none;
        border-color: #3b82f6 !important;
        background: rgba(59,130,246,0.05) !important;
        box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
      }
      .cms-status {
        position: fixed;
        top: 20px;
        right: 20px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        z-index: 9999;
        transition: all 0.3s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255,255,255,0.2);
        min-width: 100px;
      }
      .status-main {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
      }
      .cms-status-idle { background: #f1f5f9; color: #64748b; opacity: 0.8; }
      .cms-status-editing { background: #3b82f6; color: white; }
      .cms-status-saving { background: #f59e0b; color: white; }
      .cms-status-saved { background: #10b981; color: white; }
      .cms-status-typing { background: #6366f1; color: white; }
      .cms-status-warning { background: #f59e0b; color: white; animation: pulse 2s infinite; }
      .cms-status-error { background: #ef4444; color: white; }
      .cms-retry-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }
      .cms-retry-content {
        background: white;
        border-radius: 8px;
        padding: 24px;
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
        max-width: 400px;
        text-align: center;
      }
      .cms-retry-content h3 { margin: 0 0 12px 0; font-size: 18px; color: #dc2626; }
      .cms-retry-content p { margin: 0 0 20px 0; color: #64748b; }
      .cms-retry-buttons { display: flex; gap: 12px; justify-content: center; }
      .cms-retry-btn {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      .cms-retry-btn:hover { background: #2563eb; }
      .cms-dismiss-btn {
        background: #f1f5f9;
        color: #64748b;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }
      .cms-dismiss-btn:hover { background: #e2e8f0; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    `;
    document.head.appendChild(s);
  }

  destroy(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    if (this.historyTimeout) clearTimeout(this.historyTimeout);
    window.removeEventListener('beforeunload', this.beforeUnload);
    this.statusEl.remove();
  }
}

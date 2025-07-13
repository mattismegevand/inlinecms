/**
 * Code block editing plugin for InlineCMS
 */

import type { Plugin, InlineCMSEditor } from "../types";
import { getCurrentElement } from "../utils/dom";

export class CodePlugin implements Plugin {
  name = "code";
  private editor!: InlineCMSEditor;

  init(editor: InlineCMSEditor): void {
    this.editor = editor;
  }

  handleKeydown(e: KeyboardEvent): boolean {
    const currentElement = getCurrentElement();
    const codeBlock = this.isInsideCodeBlock(currentElement);

    if (codeBlock) {
      if (e.key === "Enter") {
        e.preventDefault();
        this.editor.insertTextAtCursor("\n");
        return true;
      }

      if (e.key === "Tab") {
        e.preventDefault();

        if (e.shiftKey) {
          // Shift+Tab: Remove indentation
          this.handleCodeBlockUnindent(codeBlock);
        } else {
          // Tab: Add 4 spaces
          this.editor.insertTextAtCursor("    "); // 4 spaces for standard indentation
        }
        return true;
      }

      if (e.key === "Backspace") {
        // Prevent backspace from merging content into code block
        if (this.isAtStartOfCodeBlock(codeBlock)) {
          e.preventDefault();
          return true;
        }
        
        setTimeout(() => {
          this.cleanupCodeBlock(codeBlock);
        }, 0);
      }

      if (e.key.length === 1 || e.key === "Delete") {
        setTimeout(() => {
          this.cleanupCodeBlock(codeBlock);
        }, 0);
      }

      return false; // Let other handlers process the event
    }

    return false; // Not handled
  }

  private isInsideCodeBlock(element: Node | null): HTMLElement | null {
    if (!element) return null;

    // Check if we're in a text node inside a code block
    let currentNode = element;
    while (currentNode) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const el = currentNode as HTMLElement;
        if (el.tagName === "CODE" && el.closest("pre")) {
          return el;
        }
      }
      currentNode = currentNode.parentNode as Node;
    }
    return null;
  }

  private isAtStartOfCodeBlock(codeBlock: HTMLElement): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);
    
    // Check if cursor is at the very beginning of the code block
    if (range.startOffset === 0) {
      // Check if we're at the start of the first text node in the code block
      const firstTextNode = this.getFirstTextNode(codeBlock);
      if (firstTextNode && range.startContainer === firstTextNode) {
        return true;
      }
    }
    
    return false;
  }

  private getFirstTextNode(element: HTMLElement): Text | null {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );
    const firstNode = walker.nextNode();
    return firstNode && firstNode.nodeType === Node.TEXT_NODE ? firstNode as Text : null;
  }

  private cleanupCodeBlock(codeBlock: HTMLElement): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Save cursor position before cleanup
    const range = selection.getRangeAt(0);
    let cursorOffset = 0;
    
    // Calculate cursor offset from start of code block
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer;
      let walker = document.createTreeWalker(
        codeBlock,
        NodeFilter.SHOW_TEXT,
        null,
      );
      
      let currentNode;
      while (currentNode = walker.nextNode()) {
        if (currentNode === textNode) {
          cursorOffset += range.startOffset;
          break;
        }
        cursorOffset += currentNode.textContent?.length || 0;
      }
    }

    // Clean up the HTML, preserving only text content
    const plainText = codeBlock.textContent || "";
    codeBlock.innerHTML = "";
    codeBlock.appendChild(document.createTextNode(plainText));

    // Restore cursor position
    const textNode = codeBlock.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const newRange = document.createRange();
      const safeOffset = Math.min(cursorOffset, textNode.textContent?.length || 0);
      newRange.setStart(textNode, safeOffset);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  }

  private handleCodeBlockUnindent(codeBlock: HTMLElement): void {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const text = textNode.textContent || "";
    const offset = range.startOffset;

    // Find the start of the current line
    let lineStart = offset;
    while (lineStart > 0 && text[lineStart - 1] !== "\n") {
      lineStart--;
    }

    // Check how many spaces we have at the beginning of the line
    let spacesToRemove = 0;
    for (let i = lineStart; i < text.length && i < lineStart + 4; i++) {
      if (text[i] === " ") {
        spacesToRemove++;
      } else {
        break;
      }
    }

    if (spacesToRemove > 0) {
      // Remove up to 4 spaces
      const before = text.substring(0, lineStart);
      const after = text.substring(lineStart + spacesToRemove);
      textNode.textContent = before + after;

      // Restore cursor position
      const newOffset = offset - spacesToRemove;
      range.setStart(textNode, Math.max(lineStart, newOffset));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  destroy(): void {
    // No cleanup needed for code plugin
  }
}

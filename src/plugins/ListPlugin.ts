/**
 * List management plugin for InlineCMS
 */

import type { Plugin, InlineCMSEditor } from "../types";
import { getCurrentElement, restoreCursorPosition } from "../utils/dom";

export class ListPlugin implements Plugin {
  name = "list";
  private editor!: InlineCMSEditor;

  init(editor: InlineCMSEditor): void {
    this.editor = editor;
  }

  handleKeydown(e: KeyboardEvent): boolean {
    const selection = window.getSelection();
    if (!selection) return false;

    // Backspace at start of heading - prevent merging with previous block
    if (e.key === "Backspace" && selection.anchorOffset === 0) {
      const heading = selection.anchorNode?.parentElement?.closest(
        "h1, h2, h3, h4, h5, h6",
      ) as HTMLHeadingElement;
      if (heading) {
        e.preventDefault(); // This is key - prevents the default backspace behavior

        const currentLevel = parseInt(heading.tagName[1]);
        const content = heading.innerHTML;

        if (currentLevel === 1) {
          // H1 becomes paragraph
          const p = document.createElement("p");
          p.innerHTML = content;
          heading.replaceWith(p);

          // Set cursor at start of new paragraph
          if (p.firstChild) {
            const range = document.createRange();
            range.setStart(p.firstChild, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else {
          // Decrease heading level
          const newHeading = document.createElement(`h${currentLevel - 1}`);
          newHeading.innerHTML = content;
          heading.replaceWith(newHeading);

          // Set cursor at start of new heading
          if (newHeading.firstChild) {
            const range = document.createRange();
            range.setStart(newHeading.firstChild, 0);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }

        this.editor.triggerAutoSave();
        return true;
      }
    }

    // Tab for list indentation
    if (e.key === "Tab") {
      const listItem = this.findListItem(selection);
      if (listItem) {
        e.preventDefault();
        
        if (e.shiftKey) {
          this.handleOutdent(listItem);
        } else {
          this.handleIndent(listItem);
        }
        
        this.editor.triggerAutoSave();
        return true;
      }
    }

    return false;
  }

  /**
   * Find the list item containing the current selection
   */
  private findListItem(selection: Selection): HTMLLIElement | null {
    if (!selection || selection.rangeCount === 0) return null;
    
    let node: Node | null = selection.getRangeAt(0).startContainer;
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "LI") {
        return node as HTMLLIElement;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const li = (node as HTMLElement).closest("li");
        if (li) return li;
      }
      node = node.parentNode;
      if (!node) break;
    }
    return null;
  }

  /**
   * Handle indenting a list item
   */
  private handleIndent(listItem: HTMLLIElement): void {
    const prevSibling = listItem.previousElementSibling as HTMLLIElement | null;
    
    // Can only indent if there's a previous sibling
    if (!prevSibling) return;

    const parentList = listItem.parentElement as HTMLUListElement | HTMLOListElement;
    const listType = parentList.tagName.toLowerCase();

    // Find or create nested list in previous sibling
    let nestedList = prevSibling.querySelector(":scope > ul, :scope > ol") as HTMLUListElement | HTMLOListElement | null;
    
    if (!nestedList) {
      // Create new nested list of same type
      nestedList = document.createElement(listType) as HTMLUListElement | HTMLOListElement;
      
      // Apply proper styling for nested ordered lists
      if (listType === "ol" && parentList.tagName === "OL" && nestedList.tagName === "OL") {
        this.applyOrderedListStyling(nestedList as HTMLOListElement, parentList as HTMLOListElement);
      }
      
      prevSibling.appendChild(nestedList);
    }

    // Move the list item into the nested list
    nestedList.appendChild(listItem);
    
    // Preserve cursor position
    this.restoreCursorInListItem(listItem);
  }

  /**
   * Handle outdenting a list item
   */
  private handleOutdent(listItem: HTMLLIElement): void {
    const parentList = listItem.parentElement as HTMLUListElement | HTMLOListElement;
    const grandparentLi = parentList.parentElement?.closest("li") as HTMLLIElement | null;
    
    // Can only outdent if we're in a nested list
    if (!grandparentLi) return;

    const greatGrandparentList = grandparentLi.parentElement as HTMLUListElement | HTMLOListElement;
    
    // Move the list item to be a sibling of its grandparent
    greatGrandparentList.insertBefore(listItem, grandparentLi.nextSibling);
    
    // Clean up empty nested list
    if (parentList.children.length === 0) {
      parentList.remove();
    }
    
    // Re-apply styling to maintain proper hierarchy
    if (parentList.tagName.toLowerCase() === "ol") {
      this.refreshOrderedListStyling(greatGrandparentList);
    }
    
    // Preserve cursor position
    this.restoreCursorInListItem(listItem);
  }

  /**
   * Restore cursor position within a list item
   */
  private restoreCursorInListItem(listItem: HTMLLIElement): void {
    const selection = window.getSelection();
    if (!selection) return;

    // Find the first text node in the list item
    const walker = document.createTreeWalker(
      listItem,
      NodeFilter.SHOW_TEXT,
      (node) => {
        // Skip text nodes inside nested lists
        const parent = node.parentElement;
        return parent && (!parent.closest("ul, ol") || parent.closest("li") === listItem)
          ? NodeFilter.FILTER_ACCEPT 
          : NodeFilter.FILTER_SKIP;
      }
    );

    const firstTextNode = walker.nextNode();
    if (firstTextNode) {
      const range = document.createRange();
      range.setStart(firstTextNode, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  /**
   * Apply appropriate styling for nested ordered lists
   * Standard hierarchy: decimal -> lower-alpha -> lower-roman -> decimal...
   */
  private applyOrderedListStyling(nestedList: HTMLOListElement, parentList: HTMLOListElement): void {
    const nestingLevel = this.getOrderedListNestingLevel(parentList);
    
    // Define list style types for different nesting levels
    const styleTypes = [
      'decimal',      // 1, 2, 3...
      'lower-alpha',  // a, b, c...
      'lower-roman',  // i, ii, iii...
      'upper-alpha',  // A, B, C...
      'upper-roman'   // I, II, III...
    ];
    
    // Apply the appropriate style type based on nesting level
    const styleType = styleTypes[nestingLevel % styleTypes.length];
    nestedList.style.listStyleType = styleType;
    
    // Add CSS class for additional styling if needed
    nestedList.classList.add(`inlinecms-ol-level-${nestingLevel + 1}`);
  }

  /**
   * Calculate the nesting level of an ordered list
   */
  private getOrderedListNestingLevel(list: HTMLOListElement): number {
    let level = 0;
    let currentElement = list.parentElement;
    
    while (currentElement) {
      // Look for parent ordered lists
      const parentOl = currentElement.closest('ol');
      if (parentOl && parentOl !== list) {
        level++;
        currentElement = parentOl.parentElement;
      } else {
        break;
      }
    }
    
    return level;
  }

  /**
   * Refresh styling for all ordered lists within a container
   */
  private refreshOrderedListStyling(container: HTMLElement): void {
    const orderedLists = container.querySelectorAll('ol');
    orderedLists.forEach((ol) => {
      const nestingLevel = this.getOrderedListNestingLevel(ol);
      const styleTypes = ['decimal', 'lower-alpha', 'lower-roman', 'upper-alpha', 'upper-roman'];
      const styleType = styleTypes[nestingLevel % styleTypes.length];
      ol.style.listStyleType = styleType;
      
      // Update CSS class
      ol.className = ol.className.replace(/inlinecms-ol-level-\d+/g, '');
      ol.classList.add(`inlinecms-ol-level-${nestingLevel + 1}`);
    });
  }

  destroy(): void {
    // No cleanup needed for list plugin
  }
}

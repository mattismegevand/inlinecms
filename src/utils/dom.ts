/**
 * DOM utility functions
 */

export function getCurrentElement(): Node | null {
  const selection = window.getSelection();
  if (!selection?.anchorNode) return null;

  // Return the actual node (text or element) where the cursor is
  return selection.anchorNode;
}

export function insertTextAtCursor(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function getCursorPosition(element: HTMLElement): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  return preCaretRange.toString().length;
}

export function setCursorPosition(
  element: HTMLElement,
  position: number,
): void {
  const selection = window.getSelection();
  if (!selection) return;

  let charCount = 0;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);

  let node;
  while ((node = walker.nextNode())) {
    const textLength = node.textContent?.length || 0;
    if (charCount + textLength >= position) {
      const range = document.createRange();
      range.setStart(node, position - charCount);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    charCount += textLength;
  }

  // If position is beyond content, place at end
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function restoreCursorPosition(element: HTMLElement): void {
  const range = document.createRange();
  const selection = window.getSelection();
  if (!selection) return;

  range.setStart(element, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

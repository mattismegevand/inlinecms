/**
 * Math/LaTeX editing plugin for InlineCMS
 */

import type { Plugin, InlineCMSEditor } from "../types";
import { getCurrentElement } from "../utils/dom";

export class MathPlugin implements Plugin {
  name = "math";
  private editor!: InlineCMSEditor;
  private observer?: MutationObserver;

  init(editor: InlineCMSEditor): void {
    this.editor = editor;
    this.protectMathElements();
  }

  private protectMathElements(): void {
    // Make all KaTeX elements non-editable and add click handler
    const mathElements = this.editor.root.querySelectorAll(".katex, .MathJax");
    mathElements.forEach((math) => {
      const element = math as HTMLElement;
      element.contentEditable = "false";
      element.style.cursor = "pointer";
      element.title = "Press Enter or E to edit LaTeX";

      // Add click handler to edit
      element.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.editMath(element);
      });
    });

    // Also watch for dynamically added math elements (from saves/hot reload)
    this.observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (
              el.classList.contains("katex") ||
              el.classList.contains("MathJax")
            ) {
              el.contentEditable = "false";
              el.style.cursor = "pointer";
              el.title = "Press Enter or E to edit LaTeX";
              el.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.editMath(el);
              });
            }
          }
        });
      });
    });

    this.observer.observe(this.editor.root, { childList: true, subtree: true });
  }

  handleKeydown(e: KeyboardEvent): boolean {
    const currentElement = getCurrentElement();
    const mathElement = this.isInsideMath(currentElement);

    if (mathElement) {
      // Prevent all editing inside math elements
      if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();

        // Show edit dialog on Enter or 'e' key
        if (e.key === "Enter" || e.key === "e") {
          this.editMath(mathElement);
        }
      }
      return true; // Handled
    }

    return false; // Not handled
  }

  private isInsideMath(element: Node | null): HTMLElement | null {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return null;
    return (element as Element).closest(".katex, .katex-mathml, .MathJax");
  }

  private editMath(mathElement: HTMLElement): void {
    // Find the original LaTeX source
    const mathmlAnnotation = mathElement.querySelector(
      'annotation[encoding="application/x-tex"]',
    );
    const latexSource = mathmlAnnotation?.textContent || "";

    // Create edit dialog
    const newLatex = prompt("Edit LaTeX:", latexSource);
    if (newLatex === null || newLatex === latexSource) return;

    // Replace the entire math element with new LaTeX
    const isDisplay = mathElement.closest(".katex-display") !== null;
    const delimiter = isDisplay ? "$$" : "$";
    const newText = `${delimiter}${newLatex}${delimiter}`;

    const textNode = document.createTextNode(newText);
    mathElement.replaceWith(textNode);

    // Trigger save
    this.editor.triggerAutoSave();
  }

  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

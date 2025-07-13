/**
 * Image upload and handling plugin for InlineCMS
 */

import type { Plugin, InlineCMSEditor } from "../types";

export class ImagePlugin implements Plugin {
  name = "image";
  private editor!: InlineCMSEditor;

  init(editor: InlineCMSEditor): void {
    this.editor = editor;
    this.setupImageHandling();
  }

  private setupImageHandling(): void {
    // Drag & drop
    this.editor.root.addEventListener("dragover", this.handleDragOver);
    this.editor.root.addEventListener("dragleave", this.handleDragLeave);
    this.editor.root.addEventListener("drop", this.handleDrop);

    // Paste handling
    this.editor.root.addEventListener("paste", this.handlePaste);
  }

  private handleDragOver = (e: DragEvent): void => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    this.editor.root.classList.add("inlinecms-drag-over");
  };

  private handleDragLeave = (e: DragEvent): void => {
    if (!this.editor.root.contains(e.relatedTarget as Node)) {
      this.editor.root.classList.remove("inlinecms-drag-over");
    }
  };

  private handleDrop = (e: DragEvent): void => {
    e.preventDefault();
    this.editor.root.classList.remove("inlinecms-drag-over");

    if (!e.dataTransfer) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length > 0) {
      imageFiles.forEach((file) => this.uploadImage(file));
    }
  };

  private handlePaste = (e: ClipboardEvent): void => {
    if (!e.clipboardData) return;

    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith("image/"));

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        this.uploadImage(file);
      }
    }
  };

  private async uploadImage(file: File): Promise<void> {
    this.editor.updateStatus({
      state: "saving",
      text: "📁 Uploading image...",
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/__upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = (await response.json()) as { url: string };

      this.insertImageAtCursor(result.url, file.name);

      this.editor.updateStatus({ state: "saved", text: "✅ Image uploaded" });
      setTimeout(() => {
        this.editor.updateStatus({ state: "editing", text: "✏️ Editing" });
      }, 1500);

      this.editor.debouncedSave();
    } catch (error) {
      console.error("Image upload failed:", error);
      this.editor.updateStatus({ state: "error", text: "❌ Upload failed" });
    }
  }

  private insertImageAtCursor(imageUrl: string, altText = ""): void {
    const selection = window.getSelection();
    if (!selection) return;

    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = altText;
    img.style.maxWidth = "100%";
    img.style.height = "auto";

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);

      range.setStartAfter(img);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      this.editor.root.appendChild(img);
    }
  }

  destroy(): void {
    // Remove event listeners
    this.editor.root.removeEventListener("dragover", this.handleDragOver);
    this.editor.root.removeEventListener("dragleave", this.handleDragLeave);
    this.editor.root.removeEventListener("drop", this.handleDrop);
    this.editor.root.removeEventListener("paste", this.handlePaste);
  }
}

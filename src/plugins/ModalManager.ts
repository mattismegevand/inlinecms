/**
 * Manages modal creation and interactions
 */

import type { ToastType } from "../types";
import type { Post } from "./PostAPI";

export class ModalManager {
  private toastContainer: HTMLElement | null = null;

  constructor() {
    this.createToastContainer();
  }

  private createToastContainer(): void {
    this.toastContainer = document.createElement("div");
    this.toastContainer.className = "inlinecms-toast-container";
    document.body.appendChild(this.toastContainer);
  }

  showToast(
    type: ToastType,
    title: string,
    message: string,
    duration: number = 5000,
  ): void {
    if (!this.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `inlinecms-toast inlinecms-toast-${type}`;

    const icons: Record<ToastType, string> = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };

    toast.innerHTML = `
      <div class="inlinecms-toast-icon">${icons[type]}</div>
      <div class="inlinecms-toast-content">
        <div class="inlinecms-toast-title">${title}</div>
        <div class="inlinecms-toast-message">${message}</div>
      </div>
      <button class="inlinecms-toast-close">×</button>
    `;

    this.toastContainer.appendChild(toast);

    // Handle close button
    const closeBtn = toast.querySelector(".inlinecms-toast-close");
    closeBtn?.addEventListener("click", () => this.removeToast(toast));

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => this.removeToast(toast), duration);
    }
  }

  private removeToast(toast: HTMLElement): void {
    toast.classList.add("removing");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  createModal(content: string): HTMLElement {
    const modal = document.createElement("div");
    modal.className = "inlinecms-modal";
    modal.innerHTML = `<div class="inlinecms-modal-content">${content}</div>`;
    document.body.appendChild(modal);
    return modal;
  }

  createNewPostModal(schemaInfo: string): HTMLElement {
    const placeholder =
      schemaInfo ||
      "author: Your Name&#10;tags: [blog, example]&#10;description: Post description";

    const content = `
      <button class="inlinecms-modal-close" data-action="cancel">×</button>
      <h2>Create New Post</h2>
      <form id="inlinecms-new-post-form">
        <div class="inlinecms-form-group">
          <label class="inlinecms-form-label" for="post-title">Title</label>
          <input type="text" id="post-title" class="inlinecms-form-input" required>
        </div>
        <div class="inlinecms-form-group">
          <label class="inlinecms-form-label" for="post-slug">Slug</label>
          <input type="text" id="post-slug" class="inlinecms-form-input" required>
        </div>
        <div class="inlinecms-form-group">
          <label class="inlinecms-form-label" for="post-frontmatter">Additional Frontmatter (YAML)</label>
          <textarea id="post-frontmatter" class="inlinecms-form-textarea" placeholder="${placeholder}"></textarea>
          <small style="color: #64748b; font-size: 12px; margin-top: 4px; display: block;">
            Fields based on your existing posts. Use YAML format.
          </small>
        </div>
        <div class="inlinecms-modal-buttons">
          <button type="submit" class="inlinecms-modal-btn inlinecms-modal-btn-primary">Create Post</button>
        </div>
      </form>
    `;

    return this.createModal(content);
  }

  createPostListModal(
    posts: Array<{
      slug: string;
      title: string;
      date: string;
      draft: boolean;
      path: string;
    }>,
  ): HTMLElement {
    const content = `
      <button class="inlinecms-modal-close" data-action="close">×</button>
      <h2>All Posts</h2>
      <div class="inlinecms-posts-list">
        ${posts
          .map(
            (post) => `
          <div class="inlinecms-post-item" data-path="${post.path}">
            <div class="inlinecms-post-info">
              <div class="inlinecms-post-title">${post.title}</div>
              <div class="inlinecms-post-meta">${post.slug} • ${post.date} ${post.draft ? "• Draft" : ""}</div>
            </div>
            <button class="inlinecms-post-delete" data-path="${post.path}" data-slug="${post.slug}" title="Click to delete">×</button>
          </div>
        `,
          )
          .join("")}
      </div>
    `;

    return this.createModal(content);
  }

  createDeleteConfirmationModal(slug: string): HTMLElement {
    const content = `
      <div class="inlinecms-delete-confirmation">
        <span class="inlinecms-delete-icon">🗑️</span>
        <div class="inlinecms-delete-title">Delete Post</div>
        <div class="inlinecms-delete-message">Are you sure you want to delete "<strong>${slug}</strong>"?</div>
        <div class="inlinecms-delete-warning">⚠️ This action cannot be undone</div>
      </div>
      <div class="inlinecms-modal-buttons">
        <button type="button" class="inlinecms-modal-btn inlinecms-modal-btn-secondary" data-action="cancel">Cancel</button>
        <button type="button" class="inlinecms-modal-btn inlinecms-modal-btn-danger" data-action="delete">Delete Forever</button>
      </div>
    `;

    return this.createModal(content);
  }

  async createFrontmatterModal(
    currentFrontmatter: Record<string, any>,
  ): Promise<HTMLElement> {
    const yaml = await import("js-yaml");
    const frontmatterYaml = yaml.dump(currentFrontmatter, {
      quotingType: '"',
      forceQuotes: false,
    });

    const content = `
      <button class="inlinecms-modal-close" data-action="cancel">×</button>
      <h2>Edit Frontmatter</h2>
      <form id="inlinecms-frontmatter-form">
        <div class="inlinecms-form-group">
          <label class="inlinecms-form-label" for="frontmatter-editor">Frontmatter (YAML)</label>
          <textarea 
            id="frontmatter-editor" 
            class="inlinecms-form-textarea" 
            style="min-height: 200px; font-family: 'SF Mono', Monaco, monospace;"
            placeholder="key: value&#10;tags: [tag1, tag2]&#10;published: true"
          >${frontmatterYaml}</textarea>
        </div>
        <div class="inlinecms-modal-buttons">
          <button type="submit" class="inlinecms-modal-btn inlinecms-modal-btn-primary">Update Frontmatter</button>
        </div>
      </form>
    `;

    return this.createModal(content);
  }

  destroy(): void {
    if (this.toastContainer && this.toastContainer.parentNode) {
      this.toastContainer.parentNode.removeChild(this.toastContainer);
    }
  }
}

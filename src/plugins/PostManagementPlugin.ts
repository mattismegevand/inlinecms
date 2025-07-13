/**
 * Post management plugin for InlineCMS
 * Coordinates UI and handles user interactions
 */

import type { Plugin, InlineCMSEditor } from "../types";
import { PostAPI, type Post } from "./PostAPI";
import { ModalManager } from "./ModalManager";

export class PostManagementPlugin implements Plugin {
  name = "post-management";
  private editor!: InlineCMSEditor;
  private managementUI: HTMLElement | null = null;
  private postAPI!: PostAPI;
  private modalManager!: ModalManager;
  init(editor: InlineCMSEditor): void {
    this.editor = editor;
    this.postAPI = new PostAPI();
    this.modalManager = new ModalManager();

    this.createManagementUI();
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts(): void {
    // Ctrl+N for new post
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        this.handleNewPost();
      }
      // Ctrl+Shift+D for delete current post
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        this.handleDeletePost();
      }
      // Ctrl+Shift+L for list posts
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        this.handlePostList();
      }
      // Ctrl+Shift+F for edit frontmatter
      if (e.ctrlKey && e.shiftKey && e.key === "F") {
        e.preventDefault();
        this.handleFrontmatterEditor();
      }
    });
  }

  private createManagementUI(): void {
    this.managementUI = document.createElement("div");
    this.managementUI.className = "inlinecms-sidebar";
    this.managementUI.innerHTML = `
      <div class="inlinecms-sidebar-header">
        <div class="inlinecms-sidebar-logo">cms</div>
      </div>
      <div class="inlinecms-sidebar-nav">
        <button class="inlinecms-sidebar-btn" data-action="new" title="Create new post (Ctrl+N)">
          <span class="inlinecms-btn-icon">+</span>
          <span class="inlinecms-btn-text">New Post</span>
        </button>
        <button class="inlinecms-sidebar-btn" data-action="list" title="View all posts (Ctrl+Shift+L)">
          <span class="inlinecms-btn-icon">☰</span>
          <span class="inlinecms-btn-text">All Posts</span>
        </button>
        <button class="inlinecms-sidebar-btn" data-action="frontmatter" title="Edit frontmatter (Ctrl+Shift+F)">
          <span class="inlinecms-btn-icon">⚙</span>
          <span class="inlinecms-btn-text">Settings</span>
        </button>
        <div class="inlinecms-sidebar-divider"></div>
        <button class="inlinecms-sidebar-btn inlinecms-btn-danger" data-action="delete" title="Delete current post (Ctrl+Shift+D)">
          <span class="inlinecms-btn-icon">×</span>
          <span class="inlinecms-btn-text">Delete</span>
        </button>
      </div>
    `;

    document.body.appendChild(this.managementUI);
    this.setupManagementEvents();
    this.addManagementStyles();
  }

  private setupManagementEvents(): void {
    if (!this.managementUI) return;

    // Handle button clicks
    this.managementUI.addEventListener("click", (e) => {
      const btn = (e.target as Element).closest("[data-action]") as HTMLElement;
      if (!btn) return;

      const action = btn.dataset.action;

      switch (action) {
        case "new":
          this.handleNewPost();
          break;
        case "list":
          this.handlePostList();
          break;
        case "frontmatter":
          this.handleFrontmatterEditor();
          break;
        case "delete":
          this.handleDeletePost();
          break;
        case "save":
          this.handleSave();
          break;
        case "pause":
          this.handlePauseResume();
          break;
      }
    });
  }

  private handleSave(): void {
    // Trigger manual save through the editor instance
    if (this.editor && typeof (this.editor as any).save === "function") {
      (this.editor as any).save(true);
    }
  }

  private handlePauseResume(): void {
    // Toggle pause/resume through the editor's status manager
    if (this.editor && (this.editor as any).statusManager) {
      const statusManager = (this.editor as any).statusManager;
      const isPaused = statusManager.isPausedState();

      if (isPaused) {
        statusManager.callbacks.onResume();
      } else {
        statusManager.callbacks.onPause();
      }

      // Update button text and icon
      this.updatePauseButton(!isPaused);
    }
  }

  private updatePauseButton(isPaused: boolean): void {
    const pauseBtn = this.managementUI?.querySelector('[data-action="pause"]');
    if (!pauseBtn) return;

    const icon = pauseBtn.querySelector(".inlinecms-btn-icon");
    const text = pauseBtn.querySelector(".inlinecms-btn-text");

    if (icon && text) {
      if (isPaused) {
        icon.textContent = "▶";
        text.textContent = "Resume";
        pauseBtn.setAttribute("title", "Resume autosave");
      } else {
        icon.textContent = "⏸";
        text.textContent = "Pause";
        pauseBtn.setAttribute("title", "Pause autosave");
      }
    }
  }

  private addManagementStyles(): void {
    const styles = document.createElement("style");
    styles.textContent = `
      :root {
        --inlinecms-primary: #6366f1;
        --inlinecms-primary-hover: #4f46e5;
        --inlinecms-danger: #ef4444;
        --inlinecms-danger-hover: #dc2626;
        --inlinecms-success: #10b981;
        --inlinecms-warning: #f59e0b;
        --inlinecms-gray-50: #f9fafb;
        --inlinecms-gray-100: #f3f4f6;
        --inlinecms-gray-200: #e5e7eb;
        --inlinecms-gray-300: #d1d5db;
        --inlinecms-gray-400: #9ca3af;
        --inlinecms-gray-500: #6b7280;
        --inlinecms-gray-600: #4b5563;
        --inlinecms-gray-700: #374151;
        --inlinecms-gray-800: #1f2937;
        --inlinecms-gray-900: #111827;
        --inlinecms-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --inlinecms-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        --inlinecms-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        --inlinecms-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        --inlinecms-radius: 8px;
        --inlinecms-radius-lg: 12px;
        --inlinecms-radius-xl: 16px;
      }

      .inlinecms-sidebar {
        position: fixed;
        top: 24px;
        left: 24px;
        width: 56px;
        height: auto;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        z-index: 9998;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        transition: width 0.2s ease;
        overflow: hidden;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        display: flex;
        flex-direction: column;
      }

      .inlinecms-sidebar:hover {
        width: 180px;
      }

      .inlinecms-sidebar-header {
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-bottom: 1px solid #f3f4f6;
      }

      .inlinecms-sidebar-logo {
        font-size: 12px;
        font-weight: 500;
        color: #6b7280;
        font-family: 'SF Mono', Monaco, monospace;
        letter-spacing: 0.5px;
      }

      .inlinecms-sidebar-nav {
        padding: 16px 0;
        flex: 1;
      }

      .inlinecms-sidebar-controls {
        border-top: 1px solid #f3f4f6;
        padding: 12px 0 16px 0;
      }

      .inlinecms-controls-header {
        font-size: 10px;
        font-weight: 600;
        color: #9ca3af;
        padding: 0 16px 8px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        opacity: 0;
        transition: opacity 0.2s ease;
        white-space: nowrap;
      }

      .inlinecms-sidebar:hover .inlinecms-controls-header {
        opacity: 1;
      }

      .inlinecms-sidebar-btn {
        display: flex;
        align-items: center;
        width: 100%;
        padding: 10px 16px;
        border: none;
        background: transparent;
        color: #374151;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        transition: all 0.15s ease;
        white-space: nowrap;
        font-weight: 500;
      }

      .inlinecms-sidebar-btn:hover {
        background: #f9fafb;
        color: #111827;
      }

      .inlinecms-sidebar-btn.inlinecms-btn-danger {
        color: #dc2626;
      }

      .inlinecms-sidebar-btn.inlinecms-btn-danger:hover {
        background: #fef2f2;
        color: #b91c1c;
      }

      .inlinecms-btn-icon {
        width: 20px;
        text-align: center;
        font-size: 14px;
        flex-shrink: 0;
        margin-right: 10px;
      }

      .inlinecms-btn-text {
        font-weight: 500;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .inlinecms-sidebar:hover .inlinecms-btn-text {
        opacity: 1;
      }

      .inlinecms-sidebar-divider {
        height: 1px;
        background: #f3f4f6;
        margin: 8px 16px;
      }

      /* Responsive design */
      @media (max-width: 768px) {
        .inlinecms-sidebar {
          width: 50px;
        }
        
        .inlinecms-sidebar:hover {
          width: 180px;
        }
        
        .inlinecms-sidebar-header {
          padding: 0 15px;
        }
        
        .inlinecms-sidebar-btn {
          padding: 10px 15px;
        }
      }

      @media (max-width: 480px) {
        .inlinecms-sidebar {
          width: 45px;
        }
        
        .inlinecms-sidebar:hover {
          width: 160px;
        }
        
        .inlinecms-sidebar-header {
          height: 50px;
          padding: 0 12px;
        }
        
        .inlinecms-sidebar-logo {
          font-size: 14px;
        }
        
        .inlinecms-sidebar-btn {
          padding: 8px 12px;
          font-size: 13px;
        }
        
        .inlinecms-btn-icon {
          width: 18px;
          font-size: 14px;
          margin-right: 10px;
        }
      }

      .inlinecms-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 20px;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideIn {
        from { 
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to { 
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      .inlinecms-modal-content {
        background: white;
        border-radius: var(--inlinecms-radius-xl);
        padding: 32px;
        box-shadow: var(--inlinecms-shadow-xl), 0 0 0 1px rgba(0, 0, 0, 0.05);
        max-width: 640px;
        width: 100%;
        max-height: 85vh;
        overflow-y: auto;
        animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        position: relative;
      }

      .inlinecms-modal-content::-webkit-scrollbar {
        display: none;
      }

      .inlinecms-modal-content {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }

      .inlinecms-modal h2 {
        margin: 0 0 28px 0;
        font-size: 24px;
        font-weight: 700;
        color: var(--inlinecms-gray-900);
        line-height: 1.2;
      }

      .inlinecms-modal-close {
        position: absolute;
        top: 16px;
        right: 16px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 8px;
        border-radius: 6px;
        color: var(--inlinecms-gray-400);
        font-size: 20px;
        font-weight: 700;
        transition: all 0.2s ease;
        line-height: 1;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .inlinecms-modal-close:hover {
        background: var(--inlinecms-gray-100);
        color: var(--inlinecms-gray-600);
      }

      .inlinecms-form-group {
        margin-bottom: 24px;
      }

      .inlinecms-form-label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: var(--inlinecms-gray-700);
        font-size: 15px;
      }

      .inlinecms-form-input,
      .inlinecms-form-textarea {
        width: 95% !important;
        padding: 14px 16px;
        border: 2px solid var(--inlinecms-gray-200);
        border-radius: var(--inlinecms-radius);
        font-size: 15px;
        transition: all 0.2s ease;
        background: var(--inlinecms-gray-50);
        font-family: inherit;
      }

      .inlinecms-form-input:focus,
      .inlinecms-form-textarea:focus {
        outline: none;
        border-color: var(--inlinecms-primary);
        background: white;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        transform: translateY(-1px);
      }

      .inlinecms-form-textarea {
        resize: vertical;
        min-height: 100px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        line-height: 1.5;
      }

      .inlinecms-modal-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 32px;
        padding-top: 24px;
        border-top: 1px solid var(--inlinecms-gray-100);
      }

      .inlinecms-modal-btn {
        padding: 12px 24px;
        border: none;
        border-radius: var(--inlinecms-radius);
        cursor: pointer;
        font-size: 15px;
        font-weight: 600;
        font-family: inherit;
        transition: all 0.2s ease;
        position: relative;
        overflow: hidden;
        min-width: 100px;
      }

      .inlinecms-modal-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none !important;
      }

      .inlinecms-modal-btn-primary {
        background: var(--inlinecms-primary);
        color: white;
        box-shadow: var(--inlinecms-shadow);
      }

      .inlinecms-modal-btn-primary:hover:not(:disabled) {
        background: var(--inlinecms-primary-hover);
        transform: translateY(-1px);
        box-shadow: var(--inlinecms-shadow-lg);
      }

      .inlinecms-modal-btn-secondary {
        background: var(--inlinecms-gray-100);
        color: var(--inlinecms-gray-700);
        border: 1px solid var(--inlinecms-gray-200);
      }

      .inlinecms-modal-btn-secondary:hover:not(:disabled) {
        background: var(--inlinecms-gray-200);
        transform: translateY(-1px);
      }

      .inlinecms-modal-btn-danger {
        background: var(--inlinecms-danger);
        color: white;
        box-shadow: var(--inlinecms-shadow);
      }

      .inlinecms-modal-btn-danger:hover:not(:disabled) {
        background: var(--inlinecms-danger-hover);
        transform: translateY(-1px);
        box-shadow: var(--inlinecms-shadow-lg);
      }

      .inlinecms-posts-list {
        max-height: 420px;
        overflow-y: auto;
        border-radius: var(--inlinecms-radius);
        border: 1px solid var(--inlinecms-gray-100);
      }

      .inlinecms-post-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        border-bottom: 1px solid var(--inlinecms-gray-100);
        transition: all 0.2s ease;
        cursor: pointer;
      }

      .inlinecms-post-item:last-child {
        border-bottom: none;
      }

      .inlinecms-post-item:hover {
        background: var(--inlinecms-gray-50);
      }

      .inlinecms-post-info {
        flex: 1;
        min-width: 0;
        pointer-events: none;
      }

      .inlinecms-post-title {
        font-weight: 600;
        color: var(--inlinecms-gray-900);
        margin-bottom: 6px;
        font-size: 16px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .inlinecms-post-meta {
        font-size: 13px;
        color: var(--inlinecms-gray-500);
        font-weight: 500;
      }

      .inlinecms-post-delete {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 6px;
        background: rgba(239, 68, 68, 0.1);
        color: var(--inlinecms-danger);
        cursor: pointer;
        font-size: 18px;
        font-weight: 700;
        transition: all 0.2s ease;
        flex-shrink: 0;
        line-height: 1;
      }

      .inlinecms-post-delete:hover {
        background: rgba(239, 68, 68, 0.2);
        color: #b91c1c;
        transform: scale(1.1);
      }

      .inlinecms-post-delete:active {
        transform: scale(0.95);
      }

      .inlinecms-toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 400px;
      }

      .inlinecms-toast {
        background: white;
        border-radius: var(--inlinecms-radius-lg);
        padding: 16px 20px;
        box-shadow: var(--inlinecms-shadow-xl);
        border: 1px solid var(--inlinecms-gray-100);
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        min-width: 300px;
      }

      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes slideOutRight {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(100%);
        }
      }

      .inlinecms-toast.removing {
        animation: slideOutRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .inlinecms-toast-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      .inlinecms-toast-content {
        flex: 1;
      }

      .inlinecms-toast-title {
        font-weight: 600;
        color: var(--inlinecms-gray-900);
        margin-bottom: 2px;
        font-size: 15px;
      }

      .inlinecms-toast-message {
        color: var(--inlinecms-gray-600);
        font-size: 14px;
        line-height: 1.4;
      }

      .inlinecms-toast-close {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: var(--inlinecms-gray-400);
        font-size: 16px;
        transition: all 0.2s ease;
      }

      .inlinecms-toast-close:hover {
        background: var(--inlinecms-gray-100);
        color: var(--inlinecms-gray-600);
      }

      .inlinecms-toast-success {
        border-left: 4px solid var(--inlinecms-success);
      }

      .inlinecms-toast-success .inlinecms-toast-icon {
        color: var(--inlinecms-success);
      }

      .inlinecms-toast-error {
        border-left: 4px solid var(--inlinecms-danger);
      }

      .inlinecms-toast-error .inlinecms-toast-icon {
        color: var(--inlinecms-danger);
      }

      .inlinecms-toast-warning {
        border-left: 4px solid var(--inlinecms-warning);
      }

      .inlinecms-toast-warning .inlinecms-toast-icon {
        color: var(--inlinecms-warning);
      }

      .inlinecms-error-message,
      .inlinecms-success-message {
        padding: 16px 20px;
        border-radius: var(--inlinecms-radius);
        margin-bottom: 20px;
        font-size: 14px;
        line-height: 1.5;
        font-weight: 500;
      }

      .inlinecms-error-message {
        background: rgba(239, 68, 68, 0.05);
        color: var(--inlinecms-danger);
        border: 1px solid rgba(239, 68, 68, 0.2);
      }

      .inlinecms-success-message {
        background: rgba(16, 185, 129, 0.05);
        color: var(--inlinecms-success);
        border: 1px solid rgba(16, 185, 129, 0.2);
      }

      .inlinecms-form-input.error,
      .inlinecms-form-textarea.error {
        border-color: var(--inlinecms-danger);
        background: rgba(239, 68, 68, 0.02);
        box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
      }

      .inlinecms-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s ease-in-out infinite;
        margin-right: 8px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .inlinecms-field-type {
        font-size: 11px;
        color: var(--inlinecms-gray-500);
        font-weight: 500;
        background: var(--inlinecms-gray-100);
        padding: 3px 8px;
        border-radius: 4px;
        margin-left: 8px;
        font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
        letter-spacing: 0.5px;
      }

      .inlinecms-delete-confirmation {
        text-align: center;
        padding: 20px 0;
      }

      .inlinecms-delete-icon {
        font-size: 64px;
        color: var(--inlinecms-danger);
        margin-bottom: 16px;
        display: block;
      }

      .inlinecms-delete-title {
        font-size: 20px;
        font-weight: 700;
        color: var(--inlinecms-gray-900);
        margin-bottom: 8px;
      }

      .inlinecms-delete-message {
        color: var(--inlinecms-gray-600);
        margin-bottom: 6px;
        font-size: 15px;
      }

      .inlinecms-delete-warning {
        color: var(--inlinecms-danger);
        font-size: 14px;
        font-weight: 600;
        background: rgba(239, 68, 68, 0.05);
        padding: 12px;
        border-radius: var(--inlinecms-radius);
        border: 1px solid rgba(239, 68, 68, 0.2);
        margin-top: 16px;
      }
    `;
    document.head.appendChild(styles);
  }

  private async handleNewPost(): Promise<void> {
    const modal = this.modalManager.createNewPostModal(
      "author: Your Name&#10;tags: [blog, example]",
    );

    const titleInput = modal.querySelector("#post-title") as HTMLInputElement;
    const slugInput = modal.querySelector("#post-slug") as HTMLInputElement;
    const frontmatterInput = modal.querySelector(
      "#post-frontmatter",
    ) as HTMLTextAreaElement;
    const form = modal.querySelector(
      "#inlinecms-new-post-form",
    ) as HTMLFormElement;

    // Auto-generate slug from title
    titleInput.addEventListener("input", () => {
      const slug = titleInput.value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .trim();
      slugInput.value = slug;
    });

    // Handle form submission
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = await this.postAPI.createPost(
        titleInput.value,
        slugInput.value,
        frontmatterInput.value,
      );

      if (result.success) {
        this.modalManager.showToast(
          "success",
          "Post Created!",
          `"${titleInput.value}" has been created successfully.`,
        );
        modal.remove();
        setTimeout(() => (window.location.href = result.path!), 1500);
      } else {
        this.modalManager.showToast("error", "Creation Failed", result.error!);
      }
    });

    // Handle cancel
    modal.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === "cancel" || target === modal) {
        modal.remove();
      }
    });

    titleInput.focus();
  }

  private async handlePostList(): Promise<void> {
    const result = await this.postAPI.listPosts();

    if (!result.success) {
      this.modalManager.showToast("error", "Load Failed", result.error!);
      return;
    }

    const modal = this.modalManager.createPostListModal(result.posts!);

    // Handle post item clicks and delete buttons
    modal.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;

      if (target.dataset.action === "close" || target === modal) {
        modal.remove();
        return;
      }

      // Single click on post item to open
      const postItem = target.closest(".inlinecms-post-item") as HTMLElement;
      if (postItem && !target.classList.contains("inlinecms-post-delete")) {
        const path = postItem.dataset.path;
        if (path) window.location.href = path;
        return;
      }

      // Delete button with confirmation
      if (target.classList.contains("inlinecms-post-delete")) {
        e.stopPropagation();
        const path = target.dataset.path!;
        const slug = target.dataset.slug!;

        if (
          confirm(
            `Are you sure you want to delete "${slug}"? This cannot be undone.`,
          )
        ) {
          const deleteResult = await this.postAPI.deletePost(path);
          if (deleteResult.success) {
            this.modalManager.showToast(
              "success",
              "Post Deleted",
              "The post has been permanently deleted.",
            );
            modal.remove();
            setTimeout(() => (window.location.href = "/"), 1500);
          } else {
            this.modalManager.showToast(
              "error",
              "Delete Failed",
              deleteResult.error!,
            );
          }
        }
      }
    });
  }

  private handleDeletePost(): void {
    const currentPath = window.location.pathname;
    const slug = this.extractSlugFromPath(currentPath);

    if (!slug) {
      this.modalManager.showToast(
        "warning",
        "Not Available",
        "Cannot delete: not viewing a specific post",
      );
      return;
    }

    const modal = this.modalManager.createDeleteConfirmationModal(slug);

    modal.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;

      if (target.dataset.action === "cancel" || target === modal) {
        modal.remove();
      } else if (target.dataset.action === "delete") {
        const result = await this.postAPI.deletePost(currentPath);
        if (result.success) {
          this.modalManager.showToast(
            "success",
            "Post Deleted",
            "The post has been permanently deleted.",
          );
          modal.remove();
          setTimeout(() => (window.location.href = "/"), 1500);
        } else {
          this.modalManager.showToast("error", "Delete Failed", result.error!);
        }
      }
    });
  }

  private async handleFrontmatterEditor(): Promise<void> {
    const currentPath = window.location.pathname;
    const slug = this.extractSlugFromPath(currentPath);

    if (!slug) {
      this.modalManager.showToast(
        "warning",
        "Not Available",
        "Cannot edit frontmatter: not viewing a specific post",
      );
      return;
    }

    // Get current frontmatter
    const frontmatterResult =
      await this.postAPI.getCurrentPostFrontmatter(currentPath);
    if (!frontmatterResult.success) {
      this.modalManager.showToast(
        "error",
        "Load Failed",
        frontmatterResult.error!,
      );
      return;
    }

    const modal = await this.modalManager.createFrontmatterModal(
      frontmatterResult.frontmatter!,
    );
    const form = modal.querySelector(
      "#inlinecms-frontmatter-form",
    ) as HTMLFormElement;
    const textarea = modal.querySelector(
      "#frontmatter-editor",
    ) as HTMLTextAreaElement;

    // Handle form submission
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        // Parse YAML input
        const yaml = await import("js-yaml");
        let frontmatterData: Record<string, any> = {};

        if (textarea.value.trim()) {
          const parsed = yaml.load(textarea.value);
          if (parsed !== null && parsed !== undefined) {
            if (typeof parsed === "object" && !Array.isArray(parsed)) {
              frontmatterData = parsed as Record<string, any>;
            } else {
              this.modalManager.showToast(
                "error",
                "Invalid YAML",
                "Frontmatter must be a valid YAML object",
              );
              return;
            }
          }
        }

        const result = await this.postAPI.updateFrontmatter(
          currentPath,
          frontmatterData,
        );
        if (result.success) {
          this.modalManager.showToast(
            "success",
            "Updated!",
            "Frontmatter has been updated successfully.",
          );
          modal.remove();
          // Reload page to show changes
          setTimeout(() => window.location.reload(), 1500);
        } else {
          this.modalManager.showToast("error", "Update Failed", result.error!);
        }
      } catch (yamlError) {
        this.modalManager.showToast(
          "error",
          "Invalid YAML",
          `YAML syntax error: ${(yamlError as Error).message}`,
        );
      }
    });

    // Handle cancel
    modal.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.action === "cancel" || target === modal) {
        modal.remove();
      }
    });

    textarea.focus();
  }

  private extractSlugFromPath(path: string): string | null {
    return path.split("/").filter(Boolean).at(-1) || null;
  }

  destroy(): void {
    if (this.managementUI && this.managementUI.parentNode) {
      this.managementUI.parentNode.removeChild(this.managementUI);
    }
    this.modalManager.destroy();
  }
}

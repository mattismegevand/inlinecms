/**
 * Status indicator management for InlineCMS
 */

import type { StatusState } from "../types";

export interface StatusManagerCallbacks {
  // Removed save/pause callbacks - no longer needed
}

export class StatusManager {
  private statusIndicator: HTMLElement;
  private statusText: HTMLElement;
  private hasUnsavedChanges = false;
  private callbacks: StatusManagerCallbacks;

  constructor(callbacks: StatusManagerCallbacks) {
    this.callbacks = callbacks;
    this.statusIndicator = this.createStatusIndicator();
    this.statusText = this.statusIndicator.querySelector(
      ".inlinecms-status-text",
    )!;
  }


  updateStatus(status: StatusState): void {
    this.statusText.textContent = status.text;

    const className =
      this.hasUnsavedChanges &&
      (status.state === "idle" || status.state === "editing")
        ? "inlinecms-status inlinecms-status-warning"
        : `inlinecms-status inlinecms-status-${status.state}`;

    this.statusIndicator.className = className;

    // Hide status indicator if there's nothing meaningful to show
    const shouldHide = status.state === "idle" && !this.hasUnsavedChanges;
    this.statusIndicator.style.display = shouldHide ? "none" : "block";
  }

  setUnsavedChanges(hasChanges: boolean): void {
    this.hasUnsavedChanges = hasChanges;
  }

  getIdleStatusText(): string {
    return this.hasUnsavedChanges ? "⚠️ Unsaved changes" : "";
  }

  getEditingStatusText(): string {
    return this.hasUnsavedChanges ? "✏️ Editing (unsaved)" : "✏️ Editing";
  }

  getTypingStatusText(): string {
    return "✏️ Typing...";
  }

  private createStatusIndicator(): HTMLElement {
    const indicator = document.createElement("div");
    indicator.className = "inlinecms-status inlinecms-status-idle";
    indicator.style.display = "none"; // Start hidden

    indicator.innerHTML = `
      <div class="inlinecms-status-main">
        <span class="inlinecms-status-text"></span>
      </div>
    `;

    document.body.appendChild(indicator);
    return indicator;
  }

  showRetryDialog(onRetry: () => void): void {
    const dialog = document.createElement("div");
    dialog.className = "inlinecms-retry-dialog";
    dialog.innerHTML = `
      <div class="inlinecms-retry-content">
        <h3>⚠️ Save Failed</h3>
        <p>Unable to save your changes. Check your connection.</p>
        <div class="inlinecms-retry-buttons">
          <button class="inlinecms-retry-btn">Retry Now</button>
          <button class="inlinecms-dismiss-btn">Dismiss</button>
        </div>
      </div>
    `;

    const retryBtn = dialog.querySelector(
      ".inlinecms-retry-btn",
    ) as HTMLButtonElement;
    const dismissBtn = dialog.querySelector(
      ".inlinecms-dismiss-btn",
    ) as HTMLButtonElement;

    retryBtn.addEventListener("click", () => {
      dialog.remove();
      onRetry();
    });

    dismissBtn.addEventListener("click", () => {
      dialog.remove();
    });

    document.body.appendChild(dialog);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.body.contains(dialog)) {
        dialog.remove();
      }
    }, 10000);
  }

  destroy(): void {
    if (this.statusIndicator && this.statusIndicator.parentNode) {
      this.statusIndicator.parentNode.removeChild(this.statusIndicator);
    }
  }
}

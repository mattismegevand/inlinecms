/**
 * InlineCMS Main Entry Point
 * Initializes the editor when DOM is ready
 */

import type { InlineCMSConfig } from "./types";
import { InlineCMS } from "./core/InlineCMS";

// Initialize InlineCMS when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-markdown]") as HTMLElement;
  if (!root) return;

  const defaultConfig: InlineCMSConfig = {
    autosaveDelay: 2000,
  };

  const config: InlineCMSConfig = {
    ...defaultConfig,
    ...(window as any).__inlineCMS,
  };
  new InlineCMS(root, config);
});

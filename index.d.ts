import type { AstroIntegration } from "astro";

/**
 * Configuration options for InlineCMS
 */
export interface InlineCMSConfig {
  /** Directory containing markdown files (relative to project root) */
  contentDir: string;
  /** URL pattern for posts like "/posts/{slug}/" or "/{slug}" (default: "/posts/{slug}/") */
  urlPattern?: string;
  /** Auto-save delay in milliseconds (default: 2000) */
  autosaveDelay?: number;
  /** Whether the integration is enabled (default: true) */
  enabled?: boolean;
}

/**
 * InlineCMS Astro Integration
 *
 * Provides inline editing capabilities for Astro markdown content during development.
 * Allows real-time editing of blog posts and other markdown-based content directly
 * in the browser with automatic save functionality.
 *
 * @param contentDir - Path to the directory containing markdown files (relative to project root)
 * @returns Astro integration object
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import inlineCMS from "inlinecms";
 *
 * export default {
 *   integrations: [inlineCMS("src/content/blog")]
 * };
 * ```
 *
 * @example
 * ```ts
 * // With custom configuration
 * import inlineCMS from "inlinecms";
 *
 * export default {
 *   integrations: [inlineCMS({
 *     contentDir: "src/content/blog",
 *     urlPattern: "/posts/{slug}/",
 *     autosaveDelay: 1000,
 *     enabled: process.env.NODE_ENV === "development"
 *   })]
 * };
 * ```
 */
declare function editableIntegration(contentDir: string): AstroIntegration;
declare function editableIntegration(config: InlineCMSConfig): AstroIntegration;

export default editableIntegration;

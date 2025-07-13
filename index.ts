import type { AstroIntegration } from "astro";
import { readFileSync } from "node:fs";

/**
 * Infer frontmatter schema from existing posts
 */
async function inferFrontmatterSchema(
  contentDir: string,
): Promise<Record<string, string>> {
  try {
    const fs = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { pathToFileURL } = await import("url");
    const { createRequire } = await import("module");
    const require = createRequire(pathToFileURL(process.cwd() + "/index.js"));
    const matter = require("gray-matter");

    const contentPath = join(process.cwd(), contentDir);
    const files = await fs.readdir(contentPath);
    const mdFiles = files.filter((file) => file.endsWith(".md")).slice(0, 5); // Sample first 5 files

    const schema: Record<string, Set<string>> = {};

    for (const file of mdFiles) {
      const filePath = join(contentPath, file);
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = matter(content);

      for (const [key, value] of Object.entries(parsed.data)) {
        if (!schema[key]) {
          schema[key] = new Set();
        }

        // Determine type based on value
        if (value instanceof Date) {
          schema[key].add("date");
        } else if (typeof value === "boolean") {
          schema[key].add("boolean");
        } else if (typeof value === "number") {
          schema[key].add("number");
        } else if (Array.isArray(value)) {
          schema[key].add("array");
        } else if (typeof value === "string") {
          // Check if string looks like a date
          if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
            schema[key].add("date");
          } else {
            schema[key].add("string");
          }
        } else {
          schema[key].add("object");
        }
      }
    }

    // Convert sets to most common type
    const finalSchema: Record<string, string> = {};
    for (const [key, types] of Object.entries(schema)) {
      const typeArray = Array.from(types);
      // Prefer date over string if both exist
      if (typeArray.includes("date")) {
        finalSchema[key] = "date";
      } else if (typeArray.length === 1) {
        finalSchema[key] = typeArray[0]!;
      } else {
        // Default to string if mixed types
        finalSchema[key] = "string";
      }
    }

    return finalSchema;
  } catch (error) {
    console.warn("[schema inference error]", error);
    return {};
  }
}

/**
 * Process frontmatter values based on inferred schema
 */
function processFrontmatterWithSchema(
  frontmatter: Record<string, any>,
  schema: Record<string, string>,
): Record<string, any> {
  const processed: Record<string, any> = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined || value === null) {
      processed[key] = value;
      continue;
    }

    const expectedType = schema[key];

    switch (expectedType) {
      case "date":
        if (value instanceof Date) {
          // Keep as Date object for proper YAML serialization
          processed[key] = new Date(value.toISOString().split("T")[0]);
        } else if (typeof value === "string") {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              // Create a new Date object from the date string for proper serialization
              const dateString = date.toISOString().split("T")[0];
              processed[key] = new Date(dateString);
            } else {
              processed[key] = value; // Keep original if can't parse
            }
          } catch {
            processed[key] = value;
          }
        } else {
          processed[key] = value;
        }
        break;

      case "boolean":
        if (typeof value === "string") {
          processed[key] = value.toLowerCase() === "true";
        } else {
          processed[key] = Boolean(value);
        }
        break;

      case "number":
        if (typeof value === "string") {
          const num = Number(value);
          processed[key] = isNaN(num) ? value : num;
        } else {
          processed[key] = value;
        }
        break;

      case "array":
        if (!Array.isArray(value)) {
          // Try to convert string to array
          if (typeof value === "string") {
            try {
              processed[key] = value.split(",").map((item) => item.trim());
            } catch {
              processed[key] = [value];
            }
          } else {
            processed[key] = [value];
          }
        } else {
          processed[key] = value;
        }
        break;

      default:
        // Keep as string or original type
        processed[key] = value;
    }
  }

  return processed;
}

export interface InlineCMSConfig {
  contentDir: string;
  urlPattern?: string; // URL pattern like "/posts/{slug}/" or "/{slug}"
  autosaveDelay?: number;
  enabled?: boolean;
}

/**
 * InlineCMS Astro Integration
 *
 * Provides inline editing capabilities for Astro markdown content during development.
 * Allows real-time editing of blog posts and other markdown-based content directly
 * in the browser with automatic save functionality.
 *
 * @param configOrContentDir - Configuration object or content directory path
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
 * // With custom URL pattern
 * export default {
 *   integrations: [inlineCMS({
 *     contentDir: "src/content/blog",
 *     urlPattern: "/posts/{slug}/"
 *   })]
 * };
 * ```
 */
export default function editableIntegration(
  configOrContentDir: string | InlineCMSConfig,
): AstroIntegration {
  // Handle both string and object configurations
  const config: InlineCMSConfig =
    typeof configOrContentDir === "string"
      ? { contentDir: configOrContentDir }
      : configOrContentDir;

  const {
    contentDir,
    urlPattern = "/posts/{slug}/", // Default to /posts/{slug}/ pattern
    enabled = true,
  } = config;
  return {
    name: "astro-editable-dev",
    hooks: {
      "astro:config:setup": ({ injectScript, command }) => {
        if (command === "dev" && enabled) {
          const clientScript = readFileSync(
            new URL("./client.js", import.meta.url),
            "utf8",
          );

          // Inject configuration
          const configScript = `
            window.__INLINECMS_CONFIG__ = ${JSON.stringify({ urlPattern })};
          `;

          injectScript("page", configScript);
          injectScript("page", clientScript);
        }
      },

      "astro:server:setup": ({ server }) => {
        server.middlewares.use("/__save", async (req, res, next) => {
          if (req.method !== "POST") return next();

          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              const { path, html } = JSON.parse(body);
              const fs = await import("node:fs/promises");
              const { join } = await import("node:path");
              const { pathToFileURL } = await import("url");
              const { createRequire } = await import("module");
              const require = createRequire(
                pathToFileURL(process.cwd() + "/index.js"),
              );
              const TurndownService = require("turndown");
              const matter = require("gray-matter");

              const slug = path.split("/").filter(Boolean).at(-1);
              const filePath = join(process.cwd(), contentDir, `${slug}.md`);
              const md = await fs.readFile(filePath, "utf-8");
              const parsed = matter(md);

              const td = new TurndownService({
                headingStyle: "atx",
                bulletListMarker: "-",
              });
              td.escape = (s: any) => s;

              // Custom rule for Astro processed images
              td.addRule("astroImage", {
                filter: (node: any) => {
                  return (
                    node.nodeName === "IMG" &&
                    node.getAttribute("src") &&
                    (node.getAttribute("src").includes("/_image?href=") ||
                      node.getAttribute("src").includes("/@fs/"))
                  );
                },
                replacement: (_: any, node: HTMLElement) => {
                  const src = node.getAttribute("src") || "";
                  const alt = node.getAttribute("alt") || "";

                  // Try to extract original path from Astro's processed URL
                  let originalPath = src;

                  // Handle /_image?href= URLs
                  if (src.includes("/_image?href=")) {
                    try {
                      const url = new URL(src, "http://localhost");
                      const href = url.searchParams.get("href");
                      if (href) {
                        const decodedHref = decodeURIComponent(href);
                        
                        // Extract path from /@fs/ URLs
                        if (decodedHref.includes("/@fs/")) {
                          const fsMatch = decodedHref.match(/\/@fs\/.*?\/src\/(.+?)(?:\?|$)/);
                          if (fsMatch && fsMatch[1]) {
                            // Reconstruct relative path
                            const relativePath = fsMatch[1];
                            originalPath = `../../${relativePath}`;
                          }
                        }
                      }
                    } catch (e) {
                      // If URL parsing fails, keep original
                    }
                  }
                  
                  // Handle direct /@fs/ URLs
                  else if (src.includes("/@fs/")) {
                    const fsMatch = src.match(/\/@fs\/.*?\/src\/(.+?)(?:\?|$)/);
                    if (fsMatch && fsMatch[1]) {
                      const relativePath = fsMatch[1];
                      originalPath = `../../${relativePath}`;
                    }
                  }

                  return `![${alt}](${originalPath})`;
                },
              });

              td.addRule("fencedCodeBlock", {
                filter: (node: {
                  nodeName: string;
                  firstChild: { nodeName: string };
                }) =>
                  node.nodeName === "PRE" &&
                  node.firstChild?.nodeName === "CODE",
                replacement: (_: any, node: HTMLElement) => {
                  const codeNode = node.firstChild as HTMLElement;
                  const code = codeNode.textContent?.replace(/\n$/, "") ?? "";

                  // Get language from data-language attribute (Astro/Shiki style)
                  let lang = node.getAttribute("data-language") || "";

                  // Fallback to class-based detection
                  if (!lang) {
                    const className = codeNode.getAttribute("class") || "";
                    const match = className.match(/language-(\w+)/);
                    lang = match ? match[1] : "";
                  }

                  return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
                },
              });

              const newContent = td.turndown(html).trim();
              const updated = matter.stringify(newContent, parsed.data);
              await fs.writeFile(filePath, updated, "utf-8");
              res.writeHead(200);
              res.end("OK");
            } catch (err) {
              console.error("[save error]", err);
              res.writeHead(500);
              res.end("error");
            }
          });
        });

        server.middlewares.use("/__upload", async (req, res, next) => {
          if (req.method !== "POST") return next();

          try {
            const crypto = await import("node:crypto");
            const fs = await import("node:fs/promises");
            const path = await import("node:path");

            const uploadsDir = path.join(process.cwd(), "public", "uploads");
            await fs.mkdir(uploadsDir, { recursive: true });

            // Simple multipart parsing for image uploads
            const chunks: Buffer[] = [];
            req.on("data", (chunk: Buffer) => chunks.push(chunk));
            req.on("end", async () => {
              try {
                const buffer = Buffer.concat(chunks);
                const boundary =
                  req.headers["content-type"]?.split("boundary=")[1];

                if (!boundary) {
                  res.writeHead(400);
                  return res.end(
                    JSON.stringify({ error: "No boundary found" }),
                  );
                }

                // Extract file data from multipart (proper binary handling)
                const boundaryBuffer = Buffer.from(`--${boundary}`);

                let fileBuffer: Buffer | null = null;
                let filename = "";

                // Find the start of the file part
                let startIndex = buffer.indexOf(boundaryBuffer);
                while (startIndex !== -1) {
                  const nextBoundaryIndex = buffer.indexOf(
                    boundaryBuffer,
                    startIndex + boundaryBuffer.length,
                  );
                  const partBuffer =
                    nextBoundaryIndex !== -1
                      ? buffer.subarray(startIndex, nextBoundaryIndex)
                      : buffer.subarray(startIndex);

                  // Convert only the headers part to string to parse metadata
                  const headersEndIndex = partBuffer.indexOf(
                    Buffer.from("\r\n\r\n"),
                  );
                  if (headersEndIndex !== -1) {
                    const headers = partBuffer
                      .subarray(0, headersEndIndex)
                      .toString();

                    if (
                      headers.includes("Content-Disposition: form-data") &&
                      headers.includes("filename=")
                    ) {
                      const lines = headers.split("\r\n");
                      const dispositionLine = lines.find((line) =>
                        line.includes("filename="),
                      );
                      if (dispositionLine) {
                        const match =
                          dispositionLine.match(/filename="([^"]+)"/);
                        filename = match ? match[1] : "upload";
                      }

                      // Extract binary data (everything after double CRLF)
                      const binaryDataStart = headersEndIndex + 4;
                      let binaryData = partBuffer.subarray(binaryDataStart);

                      // Remove trailing CRLF if present
                      if (
                        binaryData.length >= 2 &&
                        binaryData[binaryData.length - 2] === 0x0d &&
                        binaryData[binaryData.length - 1] === 0x0a
                      ) {
                        binaryData = binaryData.subarray(0, -2);
                      }

                      fileBuffer = binaryData;
                      break;
                    }
                  }

                  startIndex = nextBoundaryIndex;
                }

                if (!fileBuffer) {
                  res.writeHead(400);
                  return res.end(JSON.stringify({ error: "No file found" }));
                }

                // Basic security: file type and size validation
                const ext = path.extname(filename).toLowerCase();
                const allowedTypes = [
                  ".jpg",
                  ".jpeg",
                  ".png",
                  ".gif",
                  ".webp",
                  ".svg",
                ];
                const maxSize = 10 * 1024 * 1024; // 10MB

                if (!allowedTypes.includes(ext)) {
                  res.writeHead(400);
                  return res.end(
                    JSON.stringify({
                      error:
                        "File type not allowed. Use: " +
                        allowedTypes.join(", "),
                    }),
                  );
                }

                if (fileBuffer.length > maxSize) {
                  res.writeHead(400);
                  return res.end(
                    JSON.stringify({ error: "File too large. Max size: 10MB" }),
                  );
                }

                const hash = crypto
                  .createHash("md5")
                  .update(fileBuffer)
                  .digest("hex");
                const fileExt = ext || ".jpg";

                const referer = req.headers.referer || "";
                const slug =
                  referer.split("/").filter(Boolean).at(-1) || "post";

                const finalFilename = `${slug}-${hash}${fileExt}`;
                const dest = path.join(uploadsDir, finalFilename);

                await fs.writeFile(dest, fileBuffer);

                const url = `/uploads/${finalFilename}`;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ url }));
              } catch (error) {
                console.error("[upload processing error]", error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Processing failed" }));
              }
            });
          } catch (err) {
            console.error("[upload error]", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "upload failed" }));
          }
        });

        // Create new post endpoint
        server.middlewares.use("/__create", async (req, res, next) => {
          if (req.method !== "POST") return next();

          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              // Parse and validate request body
              let requestData;
              try {
                requestData = JSON.parse(body);
              } catch (parseError) {
                res.writeHead(400);
                res.end(
                  JSON.stringify({ error: "Invalid JSON in request body" }),
                );
                return;
              }

              const { title, slug, frontmatter } = requestData;

              // Validate required fields
              if (!title || typeof title !== "string" || !title.trim()) {
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    error: "Title is required and must be a non-empty string",
                  }),
                );
                return;
              }

              if (!slug || typeof slug !== "string" || !slug.trim()) {
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    error: "Slug is required and must be a non-empty string",
                  }),
                );
                return;
              }

              // Validate slug format
              const cleanSlug = slug.trim();
              if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    error:
                      "Slug can only contain lowercase letters, numbers, and hyphens",
                  }),
                );
                return;
              }

              // Validate frontmatter if provided
              if (
                frontmatter &&
                (typeof frontmatter !== "object" || Array.isArray(frontmatter))
              ) {
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    error: "Frontmatter must be a valid object",
                  }),
                );
                return;
              }

              const fs = await import("node:fs/promises");
              const { join } = await import("node:path");
              const { pathToFileURL } = await import("url");
              const { createRequire } = await import("module");
              const require = createRequire(
                pathToFileURL(process.cwd() + "/index.js"),
              );
              const matter = require("gray-matter");

              const filePath = join(
                process.cwd(),
                contentDir,
                `${cleanSlug}.md`,
              );

              // Check if file already exists
              try {
                await fs.access(filePath);
                res.writeHead(409);
                res.end(
                  JSON.stringify({
                    error: `A post with slug "${cleanSlug}" already exists. Please choose a different slug.`,
                  }),
                );
                return;
              } catch {
                // File doesn't exist, continue
              }

              // Validate content directory exists
              const contentPath = join(process.cwd(), contentDir);
              try {
                await fs.access(contentPath);
              } catch {
                res.writeHead(500);
                res.end(
                  JSON.stringify({
                    error: `Content directory "${contentDir}" does not exist. Please check your configuration.`,
                  }),
                );
                return;
              }

              // Infer schema from existing posts
              const schema = await inferFrontmatterSchema(contentDir);

              // Create default frontmatter with proper date handling
              const now = new Date();
              const defaultFrontmatter = {
                title: title.trim(),
                date: new Date(now.toISOString().split("T")[0]), // Date object for proper YAML serialization
                draft: false,
                ...frontmatter,
              };

              // Process frontmatter values based on inferred schema
              const processedFrontmatter = processFrontmatterWithSchema(
                defaultFrontmatter,
                schema,
              );

              // Validate frontmatter values
              try {
                // Test if the frontmatter can be stringified (catches circular references, etc.)
                JSON.stringify(processedFrontmatter);
              } catch (stringifyError) {
                res.writeHead(400);
                res.end(
                  JSON.stringify({
                    error:
                      "Invalid frontmatter: contains non-serializable values",
                  }),
                );
                return;
              }

              // Configure matter to handle dates properly by using js-yaml directly
              const yaml = require("js-yaml");
              const yamlContent = yaml.dump(processedFrontmatter, {
                quotingType: '"',
                forceQuotes: false,
                schema: yaml.DEFAULT_SCHEMA,
              });
              const content = `---\n${yamlContent}---\n`;
              await fs.writeFile(filePath, content, "utf-8");

              // Generate URL from pattern
              const postUrl = urlPattern.replace("{slug}", cleanSlug);

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  success: true,
                  path: postUrl,
                  filePath: filePath.replace(process.cwd(), ""),
                  message: "Post created successfully",
                }),
              );
            } catch (err) {
              console.error("[create error]", err);

              // Provide more specific error messages based on error type
              let errorMessage = "Failed to create post";

              if ((err as any).code === "EACCES") {
                errorMessage =
                  "Permission denied: Cannot write to content directory";
              } else if ((err as any).code === "ENOSPC") {
                errorMessage = "Insufficient disk space to create post";
              } else if (
                (err as any).code === "EMFILE" ||
                (err as any).code === "ENFILE"
              ) {
                errorMessage = "Too many open files: Please try again";
              } else if (err instanceof SyntaxError) {
                errorMessage =
                  "Invalid content format: Please check your frontmatter";
              }

              res.writeHead(500);
              res.end(
                JSON.stringify({
                  error: errorMessage,
                  details:
                    process.env.NODE_ENV === "development"
                      ? (err as Error).message
                      : undefined,
                }),
              );
            }
          });
        });

        // Delete post endpoint
        server.middlewares.use("/__delete", async (req, res, next) => {
          if (req.method !== "POST") return next();

          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              const { path } = JSON.parse(body);
              const fs = await import("node:fs/promises");
              const { join } = await import("node:path");

              const slug = path.split("/").filter(Boolean).at(-1);
              const filePath = join(process.cwd(), contentDir, `${slug}.md`);

              // Check if file exists
              try {
                await fs.access(filePath);
              } catch {
                res.writeHead(404);
                res.end(JSON.stringify({ error: "Post not found" }));
                return;
              }

              await fs.unlink(filePath);

              res.writeHead(200);
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              console.error("[delete error]", err);
              res.writeHead(500);
              res.end(JSON.stringify({ error: "Failed to delete post" }));
            }
          });
        });

        // List posts endpoint
        server.middlewares.use("/__list", async (req, res, next) => {
          if (req.method !== "GET") return next();

          try {
            const fs = await import("node:fs/promises");
            const { join } = await import("node:path");
            const { pathToFileURL } = await import("url");
            const { createRequire } = await import("module");
            const require = createRequire(
              pathToFileURL(process.cwd() + "/index.js"),
            );
            const matter = require("gray-matter");

            const contentPath = join(process.cwd(), contentDir);
            const files = await fs.readdir(contentPath);
            const mdFiles = files.filter((file) => file.endsWith(".md"));

            const posts = await Promise.all(
              mdFiles.map(async (file) => {
                const filePath = join(contentPath, file);
                const content = await fs.readFile(filePath, "utf-8");
                const parsed = matter(content);
                const slug = file.replace(".md", "");

                return {
                  slug,
                  title: parsed.data.title || slug,
                  date: parsed.data.date || "",
                  draft: parsed.data.draft || false,
                  path: urlPattern.replace("{slug}", slug),
                  frontmatter: parsed.data,
                };
              }),
            );

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ posts }));
          } catch (err) {
            console.error("[list error]", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed to list posts" }));
          }
        });

        // Get schema endpoint
        server.middlewares.use("/__schema", async (req, res, next) => {
          if (req.method !== "GET") return next();

          try {
            const schema = await inferFrontmatterSchema(contentDir);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ schema }));
          } catch (err) {
            console.error("[schema error]", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed to infer schema" }));
          }
        });

        // Update frontmatter endpoint
        server.middlewares.use(
          "/__update-frontmatter",
          async (req, res, next) => {
            if (req.method !== "POST") return next();

            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const { path, frontmatter } = JSON.parse(body);
                const fs = await import("node:fs/promises");
                const { join } = await import("node:path");
                const { pathToFileURL } = await import("url");
                const { createRequire } = await import("module");
                const require = createRequire(
                  pathToFileURL(process.cwd() + "/index.js"),
                );
                const matter = require("gray-matter");

                const slug = path.split("/").filter(Boolean).at(-1);
                const filePath = join(process.cwd(), contentDir, `${slug}.md`);

                // Check if file exists
                try {
                  await fs.access(filePath);
                } catch {
                  res.writeHead(404);
                  res.end(JSON.stringify({ error: "Post not found" }));
                  return;
                }

                // Read current file
                const currentContent = await fs.readFile(filePath, "utf-8");
                const parsed = matter(currentContent);

                // Infer schema from existing posts
                const schema = await inferFrontmatterSchema(contentDir);

                // Process new frontmatter with schema
                const processedFrontmatter = processFrontmatterWithSchema(
                  frontmatter,
                  schema,
                );

                // Generate new content with updated frontmatter
                const yaml = require("js-yaml");
                const yamlContent = yaml.dump(processedFrontmatter, {
                  quotingType: '"',
                  forceQuotes: false,
                  schema: yaml.DEFAULT_SCHEMA,
                });
                const newContent = `---\n${yamlContent}---\n${parsed.content}`;

                await fs.writeFile(filePath, newContent, "utf-8");

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                  JSON.stringify({
                    success: true,
                    message: "Frontmatter updated successfully",
                  }),
                );
              } catch (err) {
                console.error("[frontmatter update error]", err);
                res.writeHead(500);
                res.end(
                  JSON.stringify({ error: "Failed to update frontmatter" }),
                );
              }
            });
          },
        );

        server.middlewares.use("/__get-frontmatter", async (req, res, next) => {
          if (req.method !== "POST") return next();

          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              const { path } = JSON.parse(body);
              const fs = await import("node:fs/promises");
              const { join } = await import("node:path");
              const { pathToFileURL } = await import("url");
              const { createRequire } = await import("module");
              const require = createRequire(
                pathToFileURL(process.cwd() + "/index.js"),
              );
              const matter = require("gray-matter");

              const slug = path.split("/").filter(Boolean).at(-1);
              const filePath = join(process.cwd(), contentDir, `${slug}.md`);

              // Check if file exists
              try {
                await fs.access(filePath);
              } catch {
                res.writeHead(404);
                res.end(JSON.stringify({ error: "Post not found" }));
                return;
              }

              const content = await fs.readFile(filePath, "utf-8");
              const parsed = matter(content);

              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  success: true,
                  frontmatter: parsed.data,
                }),
              );
            } catch (err) {
              console.error("[get frontmatter error]", err);
              res.writeHead(500);
              res.end(JSON.stringify({ error: "Failed to get frontmatter" }));
            }
          });
        });
      },
    },
  };
}

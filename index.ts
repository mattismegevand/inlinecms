import type { AstroIntegration } from "astro";
import { readFileSync } from "node:fs";

export interface InlineCMSConfig {
  contentDir: string;
  urlPattern?: string;
  autosaveDelay?: number;
  enabled?: boolean;
}

// Helper: get common modules
async function getModules() {
  const fs = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("url");
  const { createRequire } = await import("module");
  const require = createRequire(pathToFileURL(process.cwd() + "/index.js"));
  return { fs, join, matter: require("gray-matter"), yaml: require("js-yaml"), require };
}

// Helper: infer frontmatter schema
async function inferSchema(contentDir: string): Promise<Record<string, string>> {
  try {
    const { fs, join, matter } = await getModules();
    const files = await fs.readdir(join(process.cwd(), contentDir));
    const schema: Record<string, Set<string>> = {};

    for (const file of files.filter(f => f.endsWith(".md")).slice(0, 5)) {
      const content = await fs.readFile(join(process.cwd(), contentDir, file), "utf-8");
      const parsed = matter(content);

      for (const [key, val] of Object.entries(parsed.data)) {
        if (!schema[key]) schema[key] = new Set();
        if (val instanceof Date || (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val))) {
          schema[key].add("date");
        } else {
          schema[key].add(typeof val === "boolean" ? "boolean" : typeof val === "number" ? "number" : Array.isArray(val) ? "array" : "string");
        }
      }
    }

    const result: Record<string, string> = {};
    for (const [key, types] of Object.entries(schema)) {
      const arr = Array.from(types);
      result[key] = arr.includes("date") ? "date" : arr[0] || "string";
    }
    return result;
  } catch { return {}; }
}

// Helper: process frontmatter with schema
function processWithSchema(fm: Record<string, any>, schema: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fm)) {
    if (val == null) { result[key] = val; continue; }
    const type = schema[key];
    if (type === "date") {
      result[key] = val instanceof Date ? new Date(val.toISOString().split("T")[0]) : new Date(new Date(val).toISOString().split("T")[0]);
    } else if (type === "boolean") {
      result[key] = typeof val === "string" ? val.toLowerCase() === "true" : Boolean(val);
    } else if (type === "number") {
      result[key] = typeof val === "string" ? (isNaN(+val) ? val : +val) : val;
    } else if (type === "array") {
      result[key] = Array.isArray(val) ? val : typeof val === "string" ? val.split(",").map(s => s.trim()) : [val];
    } else {
      result[key] = val;
    }
  }
  return result;
}

// Helper: read request body
function readBody(req: any): Promise<string> {
  return new Promise(resolve => {
    let body = "";
    req.on("data", (chunk: any) => body += chunk);
    req.on("end", () => resolve(body));
  });
}

export default function inlineCMS(configOrContentDir: string | InlineCMSConfig): AstroIntegration {
  const config: InlineCMSConfig = typeof configOrContentDir === "string" ? { contentDir: configOrContentDir } : configOrContentDir;
  const { contentDir, urlPattern = "/posts/{slug}/", enabled = true } = config;

  return {
    name: "inlinecms",
    hooks: {
      "astro:config:setup": ({ injectScript, command }) => {
        if (command === "dev" && enabled) {
          const clientScript = readFileSync(new URL("./client.js", import.meta.url), "utf8");
          injectScript("page", `window.__INLINECMS_CONFIG__=${JSON.stringify({ urlPattern })};`);
          injectScript("page", clientScript);
        }
      },

      "astro:server:setup": ({ server }) => {
        // Save endpoint
        server.middlewares.use("/__save", async (req, res, next) => {
          if (req.method !== "POST") return next();
          try {
            const { path, html } = JSON.parse(await readBody(req));
            const { fs, join, matter, require } = await getModules();
            const TurndownService = require("turndown");
            const slug = path.split("/").filter(Boolean).at(-1);
            const filePath = join(process.cwd(), contentDir, `${slug}.md`);
            const parsed = matter(await fs.readFile(filePath, "utf-8"));

            const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
            td.escape = (s: any) => s;
            td.keep(['figure', 'svg', 'video']);

            // Astro images
            td.addRule("astroImage", {
              filter: (n: any) => n.nodeName === "IMG" && n.getAttribute("src")?.includes("/_image"),
              replacement: (_: any, n: any) => {
                let src = n.getAttribute("src") || "";
                const alt = n.getAttribute("alt") || "";
                if (src.includes("/_image?href=")) {
                  const href = new URL(src, "http://localhost").searchParams.get("href");
                  if (href) {
                    const match = decodeURIComponent(href).match(/\/@fs\/.*?\/src\/(.+?)(?:\?|$)/);
                    if (match?.[1]) src = `../../${match[1]}`;
                  }
                }
                return `![${alt}](${src})`;
              }
            });

            // Math
            td.addRule("katexDisplay", {
              filter: (n: any) => n.nodeName === "DIV" && n.classList?.contains("katex-display"),
              replacement: (_: any, n: any) => {
                const latex = n.querySelector('annotation[encoding="application/x-tex"]')?.textContent?.trim();
                return latex ? `\n$$\n${latex}\n$$\n` : n.textContent;
              }
            });
            td.addRule("katexInline", {
              filter: (n: any) => n.nodeName === "SPAN" && n.classList?.contains("katex") && !n.classList?.contains("katex-display"),
              replacement: (_: any, n: any) => {
                const latex = n.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
                return latex ? `$${latex}$` : n.textContent;
              }
            });

            // Code blocks
            td.addRule("code", {
              filter: (n: any) => n.nodeName === "PRE" && n.firstChild?.nodeName === "CODE",
              replacement: (_: any, n: any) => {
                const code = n.firstChild.textContent?.replace(/\n$/, "") ?? "";
                const lang = n.getAttribute("data-language") || n.firstChild.getAttribute("class")?.match(/language-(\w+)/)?.[1] || "";
                return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
              }
            });

            const newContent = td.turndown(html).trim();
            await fs.writeFile(filePath, matter.stringify(newContent, parsed.data), "utf-8");
            res.writeHead(200);
            res.end("OK");
          } catch (err) {
            console.error("[save error]", err);
            res.writeHead(500);
            res.end("error");
          }
        });

        // Upload endpoint
        server.middlewares.use("/__upload", async (req, res, next) => {
          if (req.method !== "POST") return next();
          try {
            const crypto = await import("node:crypto");
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            const uploadsDir = path.join(process.cwd(), "public", "uploads");
            await fs.mkdir(uploadsDir, { recursive: true });

            const buffer = Buffer.concat(await new Promise<Buffer[]>(resolve => {
              const chunks: Buffer[] = [];
              req.on("data", (chunk: Buffer) => chunks.push(chunk));
              req.on("end", () => resolve(chunks));
            }));

            const boundary = req.headers["content-type"]?.split("boundary=")[1];
            if (!boundary) { res.writeHead(400); return res.end(JSON.stringify({ error: "No boundary" })); }

            const parts = buffer.toString('binary').split(`--${boundary}`);
            let fileBuffer: Buffer | null = null;
            let filename = "";

            for (const part of parts) {
              if (part.includes('filename=')) {
                const headers = part.split('\r\n\r\n')[0];
                const match = headers.match(/filename="([^"]+)"/);
                filename = match?.[1] || "upload";
                const dataStart = part.indexOf('\r\n\r\n') + 4;
                const dataEnd = part.lastIndexOf('\r\n');
                fileBuffer = Buffer.from(part.slice(dataStart, dataEnd), 'binary');
                break;
              }
            }

            if (!fileBuffer) { res.writeHead(400); return res.end(JSON.stringify({ error: "No file" })); }

            const ext = path.extname(filename).toLowerCase();
            const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
            if (!allowed.includes(ext)) { res.writeHead(400); return res.end(JSON.stringify({ error: "Invalid type" })); }
            if (fileBuffer.length > 10 * 1024 * 1024) { res.writeHead(400); return res.end(JSON.stringify({ error: "Too large" })); }

            const hash = crypto.createHash("md5").update(fileBuffer).digest("hex");
            const slug = req.headers.referer?.split("/").filter(Boolean).at(-1) || "post";
            const finalFilename = `${slug}-${hash}${ext}`;
            await fs.writeFile(path.join(uploadsDir, finalFilename), fileBuffer);

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ url: `/uploads/${finalFilename}` }));
          } catch (err) {
            console.error("[upload error]", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "failed" }));
          }
        });

        // Create post
        server.middlewares.use("/__create", async (req, res, next) => {
          if (req.method !== "POST") return next();
          try {
            const { title, slug, frontmatter } = JSON.parse(await readBody(req));
            if (!title?.trim() || !slug?.trim()) { res.writeHead(400); return res.end(JSON.stringify({ error: "Title and slug required" })); }
            if (!/^[a-z0-9-]+$/.test(slug)) { res.writeHead(400); return res.end(JSON.stringify({ error: "Invalid slug" })); }

            const { fs, join, yaml } = await getModules();
            const filePath = join(process.cwd(), contentDir, `${slug}.md`);

            try { await fs.access(filePath); res.writeHead(409); return res.end(JSON.stringify({ error: "Post exists" })); } catch {}

            const schema = await inferSchema(contentDir);
            const now = new Date();
            const fm = processWithSchema({ title: title.trim(), date: new Date(now.toISOString().split("T")[0]), draft: false, ...frontmatter }, schema);
            const content = `---\n${yaml.dump(fm, { quotingType: '"', forceQuotes: false })}\---\n`;
            await fs.writeFile(filePath, content, "utf-8");

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, path: urlPattern.replace("{slug}", slug) }));
          } catch (err) {
            console.error("[create error]", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed" }));
          }
        });

        // Delete post
        server.middlewares.use("/__delete", async (req, res, next) => {
          if (req.method !== "POST") return next();
          try {
            const { path } = JSON.parse(await readBody(req));
            const { fs, join } = await getModules();
            const slug = path.split("/").filter(Boolean).at(-1);
            const filePath = join(process.cwd(), contentDir, `${slug}.md`);
            try { await fs.access(filePath); } catch { res.writeHead(404); return res.end(JSON.stringify({ error: "Not found" })); }
            await fs.unlink(filePath);
            res.writeHead(200);
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            console.error("[delete error]", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed" }));
          }
        });

        // List posts
        server.middlewares.use("/__list", async (req, res, next) => {
          if (req.method !== "GET") return next();
          try {
            const { fs, join, matter } = await getModules();
            const contentPath = join(process.cwd(), contentDir);
            const files = await fs.readdir(contentPath);
            const posts = await Promise.all(files.filter(f => f.endsWith(".md")).map(async file => {
              const parsed = matter(await fs.readFile(join(contentPath, file), "utf-8"));
              const slug = file.replace(".md", "");
              return { slug, title: parsed.data.title || slug, date: parsed.data.date || "", draft: parsed.data.draft || false, path: urlPattern.replace("{slug}", slug), frontmatter: parsed.data };
            }));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ posts }));
          } catch (err) {
            console.error("[list error]", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed" }));
          }
        });

        // Get schema
        server.middlewares.use("/__schema", async (req, res, next) => {
          if (req.method !== "GET") return next();
          try {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ schema: await inferSchema(contentDir) }));
          } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed" }));
          }
        });

        // Update frontmatter
        server.middlewares.use("/__update-frontmatter", async (req, res, next) => {
          if (req.method !== "POST") return next();
          try {
            const { path, frontmatter } = JSON.parse(await readBody(req));
            const { fs, join, matter, yaml } = await getModules();
            const slug = path.split("/").filter(Boolean).at(-1);
            const filePath = join(process.cwd(), contentDir, `${slug}.md`);
            try { await fs.access(filePath); } catch { res.writeHead(404); return res.end(JSON.stringify({ error: "Not found" })); }

            const parsed = matter(await fs.readFile(filePath, "utf-8"));
            const schema = await inferSchema(contentDir);
            const fm = processWithSchema(frontmatter, schema);
            const newContent = `---\n${yaml.dump(fm, { quotingType: '"', forceQuotes: false })}\---\n${parsed.content}`;
            await fs.writeFile(filePath, newContent, "utf-8");

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            console.error("[update error]", err);
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed" }));
          }
        });

        // Get frontmatter
        server.middlewares.use("/__get-frontmatter", async (req, res, next) => {
          if (req.method !== "POST") return next();
          try {
            const { path } = JSON.parse(await readBody(req));
            const { fs, join, matter } = await getModules();
            const slug = path.split("/").filter(Boolean).at(-1);
            const filePath = join(process.cwd(), contentDir, `${slug}.md`);
            try { await fs.access(filePath); } catch { res.writeHead(404); return res.end(JSON.stringify({ error: "Not found" })); }

            const parsed = matter(await fs.readFile(filePath, "utf-8"));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, frontmatter: parsed.data }));
          } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed" }));
          }
        });
      }
    }
  };
}

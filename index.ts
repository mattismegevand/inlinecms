import type { AstroIntegration } from "astro";
import { readFileSync } from "node:fs";

export default function editableIntegration(): AstroIntegration {
  return {
    name: "astro-editable-dev",
    hooks: {
      "astro:config:setup": ({ injectScript, command }) => {
        if (command === "dev") {
          const clientScript = readFileSync(
            new URL("./client.js", import.meta.url),
            "utf8",
          );
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
              const filePath = join(
                process.cwd(),
                "src/content/blog",
                `${slug}.md`,
              );
              const md = await fs.readFile(filePath, "utf-8");
              const parsed = matter(md);

              const td = new TurndownService({
                headingStyle: "atx",
                bulletListMarker: "-",
              });
              td.escape = (s: any) => s;

              td.addRule("fencedCodeBlock", {
                filter: (node: {
                  nodeName: string;
                  firstChild: { nodeName: string };
                }) =>
                  node.nodeName === "PRE" &&
                  node.firstChild?.nodeName === "CODE",
                replacement: (_: any, node: { firstChild: any }) => {
                  const codeNode = node.firstChild;
                  const code = codeNode.textContent?.replace(/\\n\$/, "") ?? "";
                  const lang =
                    codeNode.getAttribute("class")?.replace(/^language-/, "") ??
                    "";
                  return `\\n\`\`\`\${lang}\\n\${code}\\n\`\`\`\\n`;
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

          const { pathToFileURL } = await import("url");
          const { createRequire } = await import("module");
          const require = createRequire(pathToFileURL(import.meta.url));
          const formidable = require("formidable");
          const crypto = await import("node:crypto");
          const fs = await import("node:fs/promises");
          const path = await import("node:path");

          const uploadsDir = path.join(process.cwd(), "public", "uploads");
          await fs.mkdir(uploadsDir, { recursive: true });

          const form = new formidable.IncomingForm({
            uploadDir: uploadsDir,
            keepExtensions: true,
          });

          form.parse(
            req,
            async (err: any, _fields: any, files: { file: any[] }) => {
              if (err) {
                console.error("[upload error]", err);
                res.writeHead(500);
                return res.end(JSON.stringify({ error: "upload failed" }));
              }

              const file = files.file?.[0];
              const buffer = await fs.readFile(file.filepath);
              const hash = crypto
                .createHash("md5")
                .update(buffer)
                .digest("hex");
              const ext = path.extname(
                file.originalFilename || file.newFilename,
              );

              const referer = req.headers.referer || "";
              const slug = referer.split("/").filter(Boolean).at(-1) || "post";

              const filename = `${slug}-${hash}${ext}`;
              const dest = path.join(uploadsDir, filename);
              await fs.rename(file.filepath, dest);

              const url = `/uploads/${filename}`;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ url }));
            },
          );
        });
      },
    },
  };
}

/**
 * Handles all server communication for post management
 */

import type { APIResponse } from "../types";

export interface Post {
  slug: string;
  title: string;
  date: string;
  draft: boolean;
  path: string;
  frontmatter: Record<string, any>;
}

export interface PostListResponse extends APIResponse<Post[]> {
  posts?: Post[];
}

export interface CreatePostResponse extends APIResponse<{ path: string }> {
  path?: string;
}

export interface DeletePostResponse extends APIResponse<void> {}

export interface SchemaResponse extends APIResponse<Record<string, string>> {
  schema?: Record<string, string>;
}

export class PostAPI {
  async createPost(
    title: string,
    slug: string,
    frontmatterYaml: string,
  ): Promise<CreatePostResponse> {
    try {
      let additionalFrontmatter = {};

      if (frontmatterYaml.trim()) {
        try {
          const yaml = await import("js-yaml");
          const parsed = yaml.load(frontmatterYaml);

          if (parsed === null || parsed === undefined) {
            additionalFrontmatter = {};
          } else if (typeof parsed === "object" && !Array.isArray(parsed)) {
            additionalFrontmatter = parsed as Record<string, any>;
          } else {
            return {
              success: false,
              error: "Frontmatter must be a valid YAML object",
            };
          }
        } catch (yamlError) {
          return {
            success: false,
            error: `Invalid YAML syntax: ${(yamlError as Error).message}`,
          };
        }
      }

      const response = await fetch("/__create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          frontmatter: additionalFrontmatter,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        return { success: true, path: result.path };
      } else {
        return {
          success: false,
          error: result.error || "Failed to create post",
        };
      }
    } catch (error) {
      console.error("Create post error:", error);
      if (error instanceof TypeError && error.message.includes("fetch")) {
        return {
          success: false,
          error: "Please check your connection and try again.",
        };
      } else {
        return { success: false, error: (error as Error).message };
      }
    }
  }

  async deletePost(path: string): Promise<DeletePostResponse> {
    try {
      const response = await fetch("/__delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });

      const result = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || "Failed to delete post",
        };
      }
    } catch (error) {
      console.error("Delete post error:", error);
      return {
        success: false,
        error: "Failed to delete post. Please try again.",
      };
    }
  }

  async listPosts(): Promise<PostListResponse> {
    try {
      const response = await fetch("/__list");
      const result = await response.json();

      if (response.ok) {
        return { success: true, posts: result.posts };
      } else {
        return {
          success: false,
          error: result.error || "Failed to load posts",
        };
      }
    } catch (error) {
      console.error("List posts error:", error);
      return {
        success: false,
        error: "Failed to load posts. Please try again.",
      };
    }
  }

  async getSchema(): Promise<SchemaResponse> {
    try {
      const response = await fetch("/__schema");
      if (response.ok) {
        const { schema } = await response.json();
        return { success: true, schema };
      } else {
        return { success: false, error: "Failed to fetch schema" };
      }
    } catch (error) {
      console.warn("Could not fetch schema:", error);
      return { success: false, error: "Schema unavailable" };
    }
  }

  async updateFrontmatter(
    postPath: string,
    frontmatter: Record<string, any>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch("/__update-frontmatter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: postPath,
          frontmatter: frontmatter,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || "Failed to update frontmatter",
        };
      }
    } catch (error) {
      console.error("Update frontmatter error:", error);
      return {
        success: false,
        error: "Failed to update frontmatter. Please try again.",
      };
    }
  }

  async getCurrentPostFrontmatter(postPath: string): Promise<{
    success: boolean;
    frontmatter?: Record<string, any>;
    error?: string;
  }> {
    try {
      const response = await fetch("/__get-frontmatter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: postPath }),
      });

      const result = await response.json();

      if (response.ok) {
        return { success: true, frontmatter: result.frontmatter };
      } else {
        return {
          success: false,
          error: result.error || "Failed to get frontmatter",
        };
      }
    } catch (error) {
      console.error("Get frontmatter error:", error);
      return {
        success: false,
        error: "Failed to get frontmatter. Please try again.",
      };
    }
  }
}

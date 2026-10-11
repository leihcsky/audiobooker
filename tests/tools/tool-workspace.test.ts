import { describe, expect, it } from "vitest";
import {
  bindProjectToTool,
  clearToolProjectBinding,
  isProjectBoundToTool,
} from "@/lib/tools/tool-workspace";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("tool workspace binding", () => {
  it("restores a project only on the page that created it", () => {
    const storage = memoryStorage();
    bindProjectToTool("project-1", "audiobook-maker", storage);
    expect(isProjectBoundToTool("project-1", "audiobook-maker", storage)).toBe(true);
    expect(isProjectBoundToTool("project-1", "pdf-to-audiobook", storage)).toBe(false);
    expect(isProjectBoundToTool("project-2", "audiobook-maker", storage)).toBe(false);
  });

  it("moves the binding when a new book is created on another page", () => {
    const storage = memoryStorage();
    bindProjectToTool("project-1", "audiobook-maker", storage);
    bindProjectToTool("project-2", "pdf-to-audiobook", storage);
    expect(isProjectBoundToTool("project-1", "audiobook-maker", storage)).toBe(false);
    expect(isProjectBoundToTool("project-2", "pdf-to-audiobook", storage)).toBe(true);
  });

  it("treats cleared, malformed, or missing storage as unbound", () => {
    const storage = memoryStorage();
    bindProjectToTool("project-1", "audiobook-maker", storage);
    clearToolProjectBinding(storage);
    expect(isProjectBoundToTool("project-1", "audiobook-maker", storage)).toBe(false);

    storage.setItem("audiobooker:tool-project", "{not json");
    expect(isProjectBoundToTool("project-1", "audiobook-maker", storage)).toBe(false);

    expect(isProjectBoundToTool("project-1", "audiobook-maker", null)).toBe(false);
  });
});

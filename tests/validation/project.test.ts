import { describe, expect, it } from "vitest";
import {
  createProjectSchema,
  projectIdSchema,
  updateProjectSchema,
} from "@/lib/validation/project";

describe("project validation", () => {
  it("allows a blank or missing title", () => {
    expect(createProjectSchema.safeParse({ title: "   " }).success).toBe(true);
    expect(createProjectSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an invalid project ID", () => {
    const result = projectIdSchema.safeParse("not-a-uuid");
    expect(result.success).toBe(false);
  });

  it("rejects an invalid create payload", () => {
    const result = createProjectSchema.safeParse({ title: "a".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("accepts a valid create payload", () => {
    const result = createProjectSchema.safeParse({
      title: "My Audiobook",
      description: "A story",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty update payload", () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts narrator publisher and copyright updates", () => {
    const result = updateProjectSchema.safeParse({
      narrator: "Alex",
      publisher: "Studio",
      copyright: "2026",
    });
    expect(result.success).toBe(true);
  });
});

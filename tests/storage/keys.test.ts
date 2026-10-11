import { describe, expect, it } from "vitest";
import {
  buildChapterAudioObjectKey,
  buildCoverObjectKey,
  buildExportObjectKey,
  buildPreviewObjectKey,
  buildSourceObjectKey,
  parseChapterAudioObjectKey,
  parseCoverObjectKey,
  parseExportObjectKey,
  parsePreviewObjectKey,
  parseSourceObjectKey,
} from "@/lib/storage/keys";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const projectId = "11111111-1111-4111-8111-111111111111";
const sourceFileId = "22222222-2222-4222-8222-222222222222";

describe("storage keys", () => {
  it("builds and parses a server-generated source key", () => {
    const objectKey = buildSourceObjectKey({
      owner: { kind: "user", id: userId },
      projectId,
      sourceFileId,
      extension: "epub",
    });

    expect(parseSourceObjectKey(objectKey)).toEqual({
      owner: { kind: "user", id: userId },
      projectId,
      sourceFileId,
      extension: "epub",
    });
  });

  it("rejects client-manipulated keys", () => {
    expect(parseSourceObjectKey("users/other/projects/x/sources/y/original.epub")).toBeNull();
    expect(parseSourceObjectKey("../secret.epub")).toBeNull();
  });

  it("builds and parses chapter audio keys", () => {
    const audioFileId = "33333333-3333-4333-8333-333333333333";
    const chapterId = "44444444-4444-4444-8444-444444444444";
    const objectKey = buildChapterAudioObjectKey({
      owner: { kind: "user", id: userId },
      projectId,
      chapterId,
      audioFileId,
    });

    expect(parseChapterAudioObjectKey(objectKey)).toEqual({
      owner: { kind: "user", id: userId },
      projectId,
      chapterId,
      audioFileId,
    });
    expect(parseChapterAudioObjectKey("users/other/projects/x/chapters/y/audio/z/audio.mp3")).toBeNull();
  });

  it("builds and parses preview keys", () => {
    const objectKey = buildPreviewObjectKey({
      owner: { kind: "user", id: userId },
      voiceId: "openai-alloy",
    });
    expect(parsePreviewObjectKey(objectKey)).toEqual({
      owner: { kind: "user", id: userId },
      voiceId: "openai-alloy",
    });
    expect(parsePreviewObjectKey("users/not-a-uuid/previews/openai-alloy.mp3")).toBeNull();
  });

  it("builds and parses cover and export keys", () => {
    const coverKey = buildCoverObjectKey({
      owner: { kind: "user", id: userId },
      projectId,
      extension: "jpg",
    });
    expect(parseCoverObjectKey(coverKey)).toEqual({
      owner: { kind: "user", id: userId },
      projectId,
      extension: "jpg",
    });
    expect(parseCoverObjectKey("users/other/projects/x/cover/cover.jpg")).toBeNull();

    const exportId = "33333333-3333-4333-8333-333333333333";
    const exportKey = buildExportObjectKey({
      owner: { kind: "user", id: userId },
      projectId,
      exportId,
      filename: "audiobook.m4b",
    });
    expect(parseExportObjectKey(exportKey)).toEqual({
      owner: { kind: "user", id: userId },
      projectId,
      exportId,
      filename: "audiobook.m4b",
    });
    expect(parseExportObjectKey("exports/audiobook.m4b")).toBeNull();
  });

  it("builds anonymous storage keys under the session prefix", () => {
    const sessionId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const objectKey = buildSourceObjectKey({
      owner: { kind: "anonymous", id: sessionId },
      projectId,
      sourceFileId,
      extension: "pdf",
    });
    expect(objectKey.startsWith(`anonymous/${sessionId}/`)).toBe(true);
    expect(parseSourceObjectKey(objectKey)?.owner).toEqual({
      kind: "anonymous",
      id: sessionId,
    });
  });
});

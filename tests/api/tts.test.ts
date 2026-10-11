import { beforeEach, describe, expect, it, vi } from "vitest";

const requireActor = vi.hoisted(() => vi.fn());
const startChapterGeneration = vi.hoisted(() => vi.fn());
const getChapterAudioForActor = vi.hoisted(() => vi.fn());
const previewVoiceForActor = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/actor", () => ({
  requireActor,
  getOptionalActor: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/tools/rate-limit", () => ({
  assertAnonymousRateLimit: vi.fn(),
}));

vi.mock("@/lib/tools/events", () => ({
  recordToolEvent: vi.fn(),
}));

vi.mock("@/lib/chapters/generation.service", () => ({
  startChapterGeneration,
}));

vi.mock("@/lib/jobs/schedule-tts", () => ({
  scheduleTtsJob: vi.fn(),
}));

vi.mock("@/lib/chapters/audio.service", () => ({
  getChapterAudioForActor,
}));

vi.mock("@/lib/voices/voice.service", () => ({
  listVoiceDtos: () => [
    {
      id: "edge-en-us-ava",
      provider: "edge",
      name: "Ava",
      language: "en-US",
      languageName: "English (US)",
      tier: "STANDARD",
    },
  ],
  previewVoiceForActor,
}));

import { GET as listVoices } from "@/app/api/voices/route";
import { POST as previewVoice } from "@/app/api/voices/[voiceId]/preview/route";
import { POST as generateChapter } from "@/app/api/chapters/[chapterId]/generate/route";
import { GET as getChapterAudio } from "@/app/api/chapters/[chapterId]/audio/route";
import { AppError, unauthenticated } from "@/lib/api/errors";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const chapterId = "33333333-3333-4333-8333-333333333333";

describe("tts API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActor.mockResolvedValue({ type: "user", userId: ownerId });
  });

  it("lists voices without a session", async () => {
    const response = await listVoices(new Request("http://localhost/api/voices"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { voices: [{ id: "edge-en-us-ava", tier: "STANDARD" }] },
    });
  });

  it("rejects generation when no actor is present", async () => {
    requireActor.mockRejectedValue(unauthenticated());
    const response = await generateChapter(
      new Request(`http://localhost/api/chapters/${chapterId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: "openai-alloy" }),
      }),
      { params: Promise.resolve({ chapterId }) },
    );
    expect(response.status).toBe(401);
  });

  it("rejects generation for another user's chapter", async () => {
    startChapterGeneration.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this chapter.", 403),
    );

    const response = await generateChapter(
      new Request(`http://localhost/api/chapters/${chapterId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: "openai-alloy" }),
      }),
      { params: Promise.resolve({ chapterId }) },
    );

    expect(response.status).toBe(403);
  });

  it("rejects an unknown voice", async () => {
    startChapterGeneration.mockRejectedValue(
      new AppError("TTS_VOICE_NOT_FOUND", "That voice is not available.", 404),
    );

    const response = await generateChapter(
      new Request(`http://localhost/api/chapters/${chapterId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: "missing-voice" }),
      }),
      { params: Promise.resolve({ chapterId }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "TTS_VOICE_NOT_FOUND" },
    });
  });

  it("rejects audio access for another actor", async () => {
    getChapterAudioForActor.mockRejectedValue(
      new AppError("FORBIDDEN", "You do not have access to this chapter.", 403),
    );

    const response = await getChapterAudio(
      new Request(`http://localhost/api/chapters/${chapterId}/audio`),
      { params: Promise.resolve({ chapterId }) },
    );
    expect(response.status).toBe(403);
  });

  it("rejects preview for a missing voice", async () => {
    previewVoiceForActor.mockRejectedValue(
      new AppError("TTS_VOICE_NOT_FOUND", "That voice is not available.", 404),
    );

    const response = await previewVoice(
      new Request("http://localhost/api/voices/missing-voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ voiceId: "missing-voice" }) },
    );
    expect(response.status).toBe(404);
  });
});

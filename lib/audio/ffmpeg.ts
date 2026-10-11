import { spawn } from "node:child_process";
import { AppError } from "@/lib/api/errors";
import { FILE_LIMITS } from "@/lib/config/limits";

export class FfmpegError extends AppError {
  readonly stderr: string;

  constructor(code: "EXPORT_PROCESSING_FAILED" | "EXPORT_TIMEOUT", message: string, stderr = "") {
    super(code, message, code === "EXPORT_TIMEOUT" ? 504 : 502);
    this.name = "FfmpegError";
    this.stderr = stderr;
  }
}

export function getFfmpegPath(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

export function getFfprobePath(): string {
  return process.env.FFPROBE_PATH?.trim() || "ffprobe";
}

export async function runFfmpeg(
  args: string[],
  options: { timeoutMs?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  return runProcess(getFfmpegPath(), args, options);
}

export async function runFfprobe(
  args: string[],
  options: { timeoutMs?: number; cwd?: string } = {},
): Promise<{ stdout: string; stderr: string }> {
  return runProcess(getFfprobePath(), args, options);
}

export async function probeDurationSeconds(filePath: string): Promise<number | null> {
  const result = await runFfprobe(
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
    { timeoutMs: 30_000 },
  );
  const value = Number.parseFloat(result.stdout.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

export type AudioProbe = {
  durationSeconds: number | null;
  bitRate: number | null;
  sampleRate: number | null;
  channels: number | null;
};

export async function probeAudioFile(filePath: string): Promise<AudioProbe> {
  const result = await runFfprobe(
    [
      "-v",
      "error",
      "-select_streams",
      "a:0",
      "-show_entries",
      "format=duration,bit_rate:stream=bit_rate,sample_rate,channels",
      "-of",
      "json",
      filePath,
    ],
    { timeoutMs: 30_000 },
  );
  const parsed = JSON.parse(result.stdout || "{}") as {
    format?: { duration?: string; bit_rate?: string };
    streams?: { bit_rate?: string; sample_rate?: string; channels?: number }[];
  };
  const stream = parsed.streams?.[0];
  return {
    durationSeconds: positiveNumber(parsed.format?.duration),
    bitRate: positiveNumber(stream?.bit_rate) ?? positiveNumber(parsed.format?.bit_rate),
    sampleRate: positiveNumber(stream?.sample_rate),
    channels: positiveNumber(stream?.channels),
  };
}

function positiveNumber(value: string | number | undefined): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function runProcess(
  command: string,
  args: string[],
  options: { timeoutMs?: number; cwd?: string },
): Promise<{ stdout: string; stderr: string }> {
  const timeoutMs = options.timeoutMs ?? FILE_LIMITS.EXPORT_FFMPEG_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGKILL");
      reject(new FfmpegError("EXPORT_TIMEOUT", "The export timed out. Please try again.", stderr));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      reject(
        new FfmpegError(
          "EXPORT_PROCESSING_FAILED",
          "FFmpeg is not available on this server.",
          error.message,
        ),
      );
    });
    child.on("close", (code) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new FfmpegError(
          "EXPORT_PROCESSING_FAILED",
          "We couldn't export this audiobook. Please try again.",
          stderr,
        ),
      );
    });
  });
}

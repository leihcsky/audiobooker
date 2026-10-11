export const NARRATION_CONTINUE_HINT =
  "Finished chapters are kept. Click Generate audiobook to retry from here.";

export const NARRATION_BUSY_MESSAGE =
  `The narration service is busy. Wait a minute, then try again. ${NARRATION_CONTINUE_HINT}`;

export const NARRATION_GENERIC_FAILURE = `This chapter didn't finish. ${NARRATION_CONTINUE_HINT}`;

export function narrationFailureCopy(input: {
  title: string;
  code?: string | null;
  message?: string | null;
}): string {
  if (input.message?.trim()) {
    return input.message.trim();
  }
  if (
    input.code === "TTS_PROVIDER_BUSY" ||
    input.code === "TTS_PROVIDER_UNAVAILABLE" ||
    input.code === "TTS_PROVIDER_TIMEOUT" ||
    input.code === "TTS_RATE_LIMITED"
  ) {
    return NARRATION_BUSY_MESSAGE;
  }
  return `Narration stopped on “${input.title}”. ${NARRATION_CONTINUE_HINT}`;
}

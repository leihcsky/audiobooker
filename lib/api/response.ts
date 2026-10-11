import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/api/errors";

export type SuccessEnvelope<T> = {
  success: true;
  data: T;
};

export type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export function success<T>(data: T, status = 200): NextResponse<SuccessEnvelope<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function failure(
  code: string,
  message: string,
  status: number,
): NextResponse<ErrorEnvelope> {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status },
  );
}

export function handleRouteError(error: unknown): NextResponse<ErrorEnvelope> {
  if (error instanceof AppError) {
    return failure(error.code, error.message, error.status);
  }

  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Invalid request.";
    return failure("VALIDATION_ERROR", message, 422);
  }

  console.error("Unhandled API error", {
    name: error instanceof Error ? error.name : "UnknownError",
  });

  return failure("INTERNAL_ERROR", "An unexpected error occurred.", 500);
}

export async function handleApiRoute(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return handleRouteError(error);
  }
}

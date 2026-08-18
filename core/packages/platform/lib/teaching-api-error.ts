import type { TeachingErrorCode } from "@cuberoot/shared/teaching";

export class TeachingApiError extends Error {
  constructor(
    readonly code: TeachingErrorCode | "BAD_RESPONSE" | "UNAVAILABLE",
    message: string,
    readonly status?: number,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "TeachingApiError";
  }
}

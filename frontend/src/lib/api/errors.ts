export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "PRIVACY_GATE_BLOCKED"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "LEGAL_SOURCE_UNAVAILABLE"
  | "ASSESSMENT_NOT_FOUND"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode | string,
    message: string,
    public details: Array<{ field?: string | null; issue: string }> = [],
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Plain-language, actionable copy keyed by HTTP status. Contract §7.8 requires explicit handling. */
export function describeError(err: unknown): { title: string; hint: string } {
  if (!(err instanceof ApiError)) {
    return { title: "Something went wrong", hint: "Try again. If it keeps happening, reload the page." };
  }
  if (err.code === "ASSESSMENT_NOT_FOUND")
    return { title: "No assessment yet", hint: "Send a message in the conversation so the assistant can prepare one." };
  if (err.code === "PRIVACY_GATE_BLOCKED")
    return { title: "Blocked to protect your privacy", hint: "This case is marked sensitive and external AI processing was not permitted. You can keep adding facts; nothing was sent outside." };
  switch (err.status) {
    case 0:
      return { title: "Can't reach the server", hint: "Check your connection and the API address in settings, then retry." };
    case 401:
      return { title: "Please sign in", hint: "Your session is missing or expired. Sign in again to continue." };
    case 403:
      return { title: "Not permitted", hint: "This action was blocked by a privacy or access rule." };
    case 404:
      return { title: "Not found", hint: "It may have been removed, or it doesn't belong to your account." };
    case 413:
      return { title: "File too large", hint: "Choose a smaller file and try again." };
    case 415:
      return { title: "Unsupported file type", hint: "Use WAV, MP3, M4A, WebM, OGG or FLAC for audio." };
    case 422:
      return { title: "Check the highlighted details", hint: "Some information is missing or too short or too long." };
    case 429:
      return { title: "Too many requests", hint: "Wait a minute before trying again." };
    case 502:
      return { title: "AI service unavailable", hint: "Your message was saved. Try again shortly." };
    case 503:
      return { title: "Service temporarily unavailable", hint: "A required service is not ready. Try again later." };
    case 504:
      return { title: "The AI service timed out", hint: "Try again in a moment." };
    default:
      return { title: "Request failed", hint: err.message || "Try again." };
  }
}

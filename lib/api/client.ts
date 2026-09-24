export type GetClerkToken = () => Promise<string | null>;

// Only sanitized scalar diagnostics cross the authentication boundary.
const safeDiagnostic = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/https?:\/\/\S+/gi, "[URL REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_.-]+/g, "[TOKEN REDACTED]")
    .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9_-]+|\bAIza[A-Za-z0-9_-]+/g, "[KEY REDACTED]")
    .replace(/((?:token|password|secret|authorization|api[_-]?key)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi, "$1[REDACTED]")
    .slice(0, 500);
};

export class AuthenticationError extends Error {
  constructor(readonly reason: "token_failed" | "token_missing", readonly code?: string) {
    super("We couldn't verify your session. Retry, or sign in again.");
    this.name = "AuthenticationError";
  }
}

export const taskErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof AuthenticationError) return error.message;
  if (error instanceof APIRequestError && error.status === 401) {
    return "The server rejected your session. Please sign in again.";
  }
  return fallback;
};

const reportTokenError = (message: string, code?: string) => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.error("Clerk getToken() failed:", { message, ...(code ? { code } : {}) });
  }
};

type APIErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class APIRequestError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "APIRequestError";
    this.status = status;
    this.code = code;
  }
}

const getAPIURL = () => {
  const apiURL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

  if (!apiURL) {
    throw new Error("Missing EXPO_PUBLIC_API_URL");
  }

  return apiURL;
};

export const authenticatedAPIRequest = async <Response>(
  path: string,
  getToken: GetClerkToken,
  init: RequestInit = {},
): Promise<Response> => {
  let token: string | null;
  try {
    token = await getToken();
  } catch (error) {
    const details = error && typeof error === "object"
      ? error as { message?: unknown; code?: unknown; errors?: { message?: unknown; code?: unknown }[] }
      : {};
    const first = Array.isArray(details.errors) ? details.errors[0] : undefined;
    const code = safeDiagnostic(first?.code ?? details.code);
    reportTokenError(safeDiagnostic(first?.message ?? details.message ?? error) ?? "Token retrieval failed without an error message.", code);
    throw new AuthenticationError("token_failed", code);
  }
  if (!token) {
    reportTokenError("Clerk getToken() returned no token; the session may be unavailable or expired.");
    throw new AuthenticationError("token_missing");
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${getAPIURL()}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 204) {
    return undefined as Response;
  }

  const body = (await response.json().catch(() => null)) as
    | Response
    | APIErrorResponse
    | null;

  if (!response.ok) {
    const errorBody = body as APIErrorResponse | null;
    throw new APIRequestError(
      errorBody?.error?.message ??
        `The server request failed with status ${response.status}`,
      response.status,
      errorBody?.error?.code,
    );
  }

  if (body == null) {
    throw new Error("The server returned an empty response");
  }

  return body as Response;
};

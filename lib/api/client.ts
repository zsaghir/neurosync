export type GetClerkToken = () => Promise<string | null>;

type APIErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

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
  const token = await getToken();
  if (!token) {
    throw new Error("You must be signed in to continue");
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
    throw new Error(
      errorBody?.error?.message ??
        `The server request failed with status ${response.status}`,
    );
  }

  if (body == null) {
    throw new Error("The server returned an empty response");
  }

  return body as Response;
};

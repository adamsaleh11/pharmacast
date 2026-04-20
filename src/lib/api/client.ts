import { getPublicEnv } from "@/lib/env";

type ApiClientOptions = {
  accessToken?: string;
};

export type ApiClient = {
  get<TResponse>(path: string, options?: ApiClientOptions): Promise<TResponse>;
  post<TResponse>(path: string, body?: unknown, options?: ApiClientOptions): Promise<TResponse>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function warnAboutAuthRejection(path: string, status: number, code: string | undefined, hasAccessToken: boolean) {
  if (status !== 401) {
    return;
  }

  console.warn("[API] Backend rejected authenticated request.", {
    path,
    status,
    code,
    authorizationHeader: hasAccessToken ? "present" : "missing"
  });
}

export function createApiClient(): ApiClient {
  const env = getPublicEnv();

  async function request<TResponse>(
    path: string,
    options: ApiClientOptions = {},
    init: RequestInit = {}
  ): Promise<TResponse> {
    if (!env.hasApiConfig) {
      throw new Error("NEXT_PUBLIC_API_URL is not configured.");
    }

    const url = `${env.apiUrl}${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        ...init.headers
      }
    });

    if (!response.ok) {
      let code: string | undefined;
      try {
        const errorBody = (await response.json()) as { error?: string };
        code = errorBody.error;
      } catch {
        code = undefined;
      }

      warnAboutAuthRejection(path, response.status, code, Boolean(options.accessToken));
      throw new ApiError(`API request failed with status ${response.status}.`, response.status, code);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return response.json() as Promise<TResponse>;
  }

  return {
    get: async <TResponse>(path: string, options: ApiClientOptions = {}) => {
      if (!env.hasApiConfig) {
        throw new Error("NEXT_PUBLIC_API_URL is not configured.");
      }
      const url = `${env.apiUrl}${path}`;
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
        }
      });
      if (!response.ok) {
        let errorBody: { error?: string } = {};
        try {
          errorBody = (await response.json()) as { error?: string };
        } catch {
          errorBody = {};
        }
        const errorCode = errorBody?.error || `HTTP_${response.status}`;
        warnAboutAuthRejection(path, response.status, errorCode, Boolean(options.accessToken));
        throw new ApiError(`API request failed with status ${response.status}.`, response.status, errorCode);
      }
      return response.json() as Promise<TResponse>;
    },
    post: (path, body, options = {}) =>
      request(path, options, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body)
      })
  };
}

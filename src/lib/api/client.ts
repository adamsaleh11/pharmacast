import { getPublicEnv } from "@/lib/env";

type ApiClientOptions = {
  accessToken?: string;
};

export type ApiClient = {
  get<TResponse>(path: string, options?: ApiClientOptions): Promise<TResponse>;
};

export function createApiClient(): ApiClient {
  const env = getPublicEnv();

  async function request<TResponse>(path: string, options: ApiClientOptions = {}): Promise<TResponse> {
    if (!env.hasApiConfig) {
      throw new Error("NEXT_PUBLIC_API_URL is not configured.");
    }

    const response = await fetch(`${env.apiUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}.`);
    }

    return response.json() as Promise<TResponse>;
  }

  return {
    get: request
  };
}

import { ApiError, createApiClient } from "@/lib/api/client";
import type { AuthBootstrapResponse, AuthMeResponse, SignupBootstrapMetadata } from "@/types/auth";

const apiClient = createApiClient();

export { ApiError };

export function getCurrentAuthUser(accessToken: string) {
  return apiClient.get<AuthMeResponse>("/auth/me", { accessToken });
}

export function bootstrapFirstOwner(accessToken: string, metadata: SignupBootstrapMetadata) {
  return apiClient.post<AuthBootstrapResponse>("/auth/bootstrap", metadata, { accessToken });
}

export function acknowledgeBackendLogout(accessToken?: string) {
  return apiClient.post<void>("/auth/logout", undefined, { accessToken });
}

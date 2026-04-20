import { createApiClient, ApiError } from "@/lib/api/client";
import { getPublicEnv } from "@/lib/env";
import type { CreateUploadResponse, UploadResponse } from "@/types/upload";

const apiClient = createApiClient();

export async function uploadCsv(
  locationId: string,
  file: File,
  accessToken: string
): Promise<CreateUploadResponse> {
  const env = getPublicEnv();
  
  if (!env.hasApiConfig) {
    throw new Error("Frontend error: NEXT_PUBLIC_API_URL is not configured in your .env file.");
  }

  const url = `${env.apiUrl}/locations/${locationId}/uploads`;
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: formData
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new ApiError(
          `Backend error: The upload endpoint was not found at ${url}. Please verify the backend is running and the location ID is valid.`,
          404
        );
      }

      let code: string | undefined;
      try {
        const errorBody = (await response.json()) as { error?: string };
        code = errorBody.error;
      } catch {
        code = undefined;
      }
      throw new ApiError(`Upload failed with status ${response.status}.`, response.status, code);
    }

    return response.json();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error(`Network error: Could not reach the backend at ${env.apiUrl}. Is the Spring Boot app running?`);
  }
}

export function listUploads(locationId: string, accessToken: string): Promise<UploadResponse[]> {
  return apiClient.get<UploadResponse[]>(`/locations/${locationId}/uploads`, { accessToken });
}

export function getUploadDetail(
  locationId: string,
  uploadId: string,
  accessToken: string
): Promise<UploadResponse> {
  return apiClient.get<UploadResponse>(`/locations/${locationId}/uploads/${uploadId}`, {
    accessToken
  });
}

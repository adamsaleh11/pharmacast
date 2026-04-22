import { ApiError, createApiClient } from "@/lib/api/client";
import { getPublicEnv } from "@/lib/env";
import type { ChatConversationMessage, ChatMessageResponse } from "@/types/chat";

const apiClient = createApiClient();

export function chatHistoryQueryKey(locationId: string | null | undefined) {
  return ["chat-history", locationId] as const;
}

export function listChatHistory(locationId: string, accessToken: string) {
  return apiClient.get<ChatMessageResponse[]>(`/locations/${locationId}/chat/history`, { accessToken });
}

export async function sendChatMessage(
  locationId: string,
  accessToken: string,
  body: {
    message: string;
    conversationHistory?: ChatConversationMessage[];
    signal?: AbortSignal;
  }
) {
  const env = getPublicEnv();

  if (!env.hasApiConfig) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  return fetch(`${env.apiUrl}/locations/${locationId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`
    },
    signal: body.signal,
    body: JSON.stringify({
      message: body.message,
      conversation_history: body.conversationHistory ?? []
    })
  });
}

export async function readJsonError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string; message?: string; detail?: string };
    return body.message ?? body.error ?? body.detail ?? null;
  } catch {
    return null;
  }
}

export { ApiError };

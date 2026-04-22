export type ChatRole = "user" | "assistant" | "system";

export type ChatConversationMessage = {
  role: ChatRole;
  content: string;
};

export type ChatSendRequest = {
  message: string;
  conversationHistory: ChatConversationMessage[];
};

export type ChatMessageResponse = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatStreamPayload = {
  locationId: string;
  message: string;
  conversationHistory: ChatConversationMessage[];
};

export type ChatStreamEvent =
  | { token: string }
  | { done: true; total_tokens?: number }
  | { error: string; message: string };


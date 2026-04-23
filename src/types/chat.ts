export type ChatRole = "user" | "assistant" | "system";

export type ChatConversationMessage = {
  role: ChatRole;
  content: string;
};

export type ChatSendRequest = {
  message: string;
  conversationId: string;
  conversationHistory: ChatConversationMessage[];
};

export type ChatMessageResponse = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
};

export type ChatConversationResponse = {
  conversation_id: string;
  location_id: string;
  user_id: string;
  started_at: string;
  last_message_at: string;
  message_count: number;
};

export type ChatStreamPayload = {
  locationId: string;
  conversationId: string;
  message: string;
  conversationHistory: ChatConversationMessage[];
};

export type ChatStreamEvent =
  | { token: string }
  | { done: true; total_tokens?: number }
  | { error: string; message: string };

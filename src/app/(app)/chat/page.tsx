"use client";

import { ArrowDown, Clock3, Loader2, MessageSquareText, Plus, Send, Square } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  chatConversationsQueryKey,
  chatConversationHistoryQueryKey,
  listChatConversationHistory,
  listChatConversations,
  readJsonError,
  sendChatMessage
} from "@/lib/api/chat";
import { getChatSidebarSlot, subscribeChatSidebarSlot } from "@/lib/chat-sidebar-slot";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import { readChatStreamResponse } from "@/lib/chat-stream";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/providers/app-context";
import type { ChatStreamDebugEvent } from "@/lib/chat-stream";
import type { ChatConversationMessage, ChatConversationResponse, ChatMessageResponse, ChatRole } from "@/types/chat";

type ThreadMessage = {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status?: "streaming" | "error";
  errorMessage?: string;
};

type SidebarConversation = {
  id: string;
  label: string;
  preview: string;
  meta: string;
  anchorId: string;
  messageCount: number;
  isDraft: boolean;
};

type ArchivedThread = {
  id: string;
  messages: ThreadMessage[];
  conversationHistory: ChatConversationMessage[];
  sidebar: SidebarConversation;
};

const MAX_CHAT_INPUT_LENGTH = 2000;
const HISTORY_SIDEBAR_LIMIT = 10;
const EMPTY_PROMPTS = [
  {
    icon: "📦",
    text: "Which drugs should I reorder this week?"
  },
  {
    icon: "💰",
    text: "What is my total order value for all critical drugs?"
  },
  {
    icon: "📈",
    text: "Which drugs have increased in demand over the last month?"
  },
  {
    icon: "🗒️",
    text: "Generate a purchase order for all red and amber drugs"
  }
] as const;

function createId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function truncate(text: string, maxLength: number) {
  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed;
  }

  return `${collapsed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function chatDebugEnabled() {
  try {
    return window.localStorage.getItem("pharmacast.chat.debug") === "1";
  } catch {
    return false;
  }
}

function logChatDebug(event: ChatStreamDebugEvent | { type: "response"; status: number; ok: boolean; contentType: string | null }) {
  if (!chatDebugEnabled()) {
    return;
  }

  console.debug("[chat-stream]", event);
}

async function getChatAccessToken(label: string) {
  const supabase = createSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const accessToken = await getBackendAccessToken(supabase, label);

  if (!accessToken) {
    throw new Error("You must be signed in to view chat history.");
  }

  return accessToken;
}

function summarizeDraftThread(messages: ThreadMessage[]): SidebarConversation | null {
  if (messages.length === 0) {
    return null;
  }

  const firstUserMessage = messages.find((message) => message.role === "user");
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const anchor = firstUserMessage ?? messages[0];

  return {
    id: anchor.conversationId,
    label: truncate(firstUserMessage?.content ?? "New conversation", 42),
    preview: truncate(lastAssistantMessage?.content || firstUserMessage?.content || "New conversation", 64),
    meta: "Unsaved draft",
    anchorId: anchor.id,
    messageCount: messages.length,
    isDraft: true
  };
}

function summarizeConversationSummary(summary: ChatConversationResponse): SidebarConversation {
  return {
    id: summary.conversation_id,
    label: `${summary.message_count} ${summary.message_count === 1 ? "message" : "messages"}`,
    preview: `Started ${formatTimestamp(summary.started_at)}`,
    meta: `Updated ${formatTimestamp(summary.last_message_at)}`,
    anchorId: summary.conversation_id,
    messageCount: summary.message_count,
    isDraft: false
  };
}

function snapshotThread(
  conversationId: string,
  messages: ThreadMessage[],
  conversationHistory: ChatConversationMessage[]
): ArchivedThread | null {
  if (messages.length === 0) {
    return null;
  }

  const sidebar = summarizeDraftThread(messages);

  if (!sidebar) {
    return null;
  }

  return {
    id: conversationId,
    messages: messages.map((message) => ({ ...message })),
    conversationHistory: conversationHistory.map((message) => ({ ...message })),
    sidebar: {
      ...sidebar,
      id: conversationId
    }
  };
}

function toThreadMessage(message: ChatMessageResponse): ThreadMessage {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    role: message.role,
    content: message.content,
    createdAt: message.created_at
  };
}

function finalizeInterruptedThread(messages: ThreadMessage[], assistantId: string | null, partialContent: string) {
  if (!assistantId) {
    return messages.map((message) => ({ ...message }));
  }

  const nextMessages: ThreadMessage[] = [];

  messages.forEach((message) => {
    if (message.id !== assistantId) {
      nextMessages.push({ ...message });
      return;
    }

    const content = partialContent || message.content;
    if (content.trim().length === 0) {
      return;
    }

    nextMessages.push({
      ...message,
      content,
      status: undefined,
      errorMessage: undefined
    });
  });

  return nextMessages;
}

function messageHistoryFromThread(messages: ThreadMessage[]) {
  return messages
    .filter((message) => message.content.trim().length > 0 && message.status !== "streaming")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
    </div>
  );
}

function MessageMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none prose-slate prose-p:my-1 prose-li:my-0 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-table:my-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium text-slate-700">{children}</th>
          ),
          td: ({ children }) => <td className="border border-slate-200 px-3 py-2 align-top">{children}</td>,
          p: ({ children }) => <p className="my-1 leading-6 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-1 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 list-decimal space-y-1 pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-slate-300 pl-3 text-slate-600">{children}</blockquote>
          ),
          code: ({ children, inline }: React.ComponentPropsWithoutRef<"code"> & { inline?: boolean }) =>
            inline ? (
              <code className="rounded bg-slate-200 px-1.5 py-0.5 text-[0.9em] text-slate-900">{children}</code>
            ) : (
              <code className="block overflow-x-auto rounded-lg bg-slate-950 px-3 py-2 font-mono text-sm text-slate-50">
                {children}
              </code>
            ),
          pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function ChatBubble({
  message,
  registerRef
}: {
  message: ThreadMessage;
  registerRef: (messageId: string, node: HTMLDivElement | null) => void;
}) {
  const isUser = message.role === "user";
  const isAssistantStreaming = message.role === "assistant" && message.status === "streaming";
  const isAssistantEmpty = isAssistantStreaming && message.content.trim().length === 0;
  const bubbleTone = isUser
    ? "bg-primary text-primary-foreground"
    : message.status === "error"
      ? "bg-rose-50 text-slate-800 border border-rose-200"
      : "bg-slate-100 text-slate-800";

  return (
    <div
      className={cn("group flex w-full", isUser ? "justify-end" : "justify-start")}
      ref={(node) => registerRef(message.id, node)}
    >
      <div className={cn("relative max-w-[80%] rounded-2xl px-4 py-3 shadow-sm", isUser ? "max-w-[75%]" : "", bubbleTone)}>
        <span className="pointer-events-none absolute -top-5 right-2 select-none text-xs text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
          {formatTimestamp(message.createdAt)}
        </span>
        {isAssistantEmpty ? (
          <TypingIndicator />
        ) : (
          <>
            <div className={cn("text-sm leading-6", isUser ? "whitespace-pre-wrap" : "")}>
              {isUser ? <p className="whitespace-pre-wrap">{message.content}</p> : <MessageMarkdown content={message.content} />}
            </div>
            {isAssistantStreaming && message.content.trim().length > 0 ? (
              <span className="ml-0.5 inline-block animate-pulse align-text-bottom text-slate-400">▍</span>
            ) : null}
            {message.status === "error" ? (
              <div className="mt-2 text-xs font-medium text-rose-600">
                {message.errorMessage ?? "Response interrupted — try again"}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ChatSidebarConversationItem({
  conversation,
  active,
  onSelect
}: {
  conversation: SidebarConversation;
  active: boolean;
  onSelect: (conversationId: string) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "w-full rounded-2xl border px-3 py-3 text-left transition",
        active
          ? "border-white/20 bg-white/12 shadow-[0_0_0_1px_rgba(255,255,255,0.12)]"
          : "border-transparent hover:border-white/10 hover:bg-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{conversation.label}</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">{conversation.preview}</div>
        </div>
        <div className="shrink-0 rounded-full bg-white/10 px-2 py-1 font-mono text-[11px] font-medium text-white/80">
          {conversation.messageCount}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-white/40">
        <Clock3 className="h-3 w-3" aria-hidden="true" />
        {conversation.meta}
      </div>
    </button>
  );
}

function ChatWorkspace({ authReady, locationId }: { authReady: boolean; locationId: string | null }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const chatSidebarSlot = useSyncExternalStore(subscribeChatSidebarSlot, getChatSidebarSlot, () => null);
  const seededMessage = searchParams.get("message")?.trim() ?? "";
  const [activeConversationId, setActiveConversationId] = useState<string | null>(() => (seededMessage ? createId() : null));
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<ChatConversationMessage[]>([]);
  const [archivedThreads, setArchivedThreads] = useState<ArchivedThread[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const [showBackToBottom, setShowBackToBottom] = useState(false);
  const [pendingScrollToMessageId, setPendingScrollToMessageId] = useState<string | null>(null);
  const [streamingStatusMessage, setStreamingStatusMessage] = useState<string | null>(null);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const streamContentRef = useRef("");
  const streamClosedRef = useRef(false);
  const streamStoppedRef = useRef(false);
  const messageRefs = useRef(new Map<string, HTMLDivElement | null>());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const threadMessagesRef = useRef<ThreadMessage[]>([]);
  const conversationHistoryRef = useRef<ChatConversationMessage[]>([]);

  useEffect(() => {
    threadMessagesRef.current = threadMessages;
  }, [threadMessages]);

  useEffect(() => {
    conversationHistoryRef.current = conversationHistory;
  }, [conversationHistory]);

  const resizeTextarea = useCallback((node: HTMLTextAreaElement | null = textareaRef.current) => {
    if (!node) {
      return;
    }

    node.style.height = "auto";
    const nextHeight = Math.min(node.scrollHeight, 4 * 24 + 20);
    node.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    if (!seededMessage || threadMessagesRef.current.length > 0 || inputValue.trim().length > 0) {
      return;
    }

    setInputValue(seededMessage);
    resizeTextarea();
  }, [inputValue, resizeTextarea, seededMessage]);

  const conversationsQuery = useQuery({
    queryKey: chatConversationsQueryKey(locationId),
    enabled: Boolean(locationId && authReady),
    staleTime: 15_000,
    queryFn: async () => {
      const accessToken = await getChatAccessToken("chat-conversations");
      return listChatConversations(locationId ?? "", accessToken);
    }
  });

  const backendConversationIds = useMemo(
    () => new Set((conversationsQuery.data ?? []).map((conversation) => conversation.conversation_id)),
    [conversationsQuery.data]
  );

  const selectedConversationId = activeConversationId ?? conversationsQuery.data?.[0]?.conversation_id ?? null;

  useEffect(() => {
    activeConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  const activeCachedConversation = useMemo(
    () => archivedThreads.find((thread) => thread.id === selectedConversationId) ?? null,
    [archivedThreads, selectedConversationId]
  );

  const activeBackendConversation = useMemo(
    () => conversationsQuery.data?.find((conversation) => conversation.conversation_id === selectedConversationId) ?? null,
    [conversationsQuery.data, selectedConversationId]
  );

  const activeConversationHistoryQuery = useQuery({
    queryKey: chatConversationHistoryQueryKey(locationId, selectedConversationId),
    enabled: Boolean(locationId && selectedConversationId && activeBackendConversation && !activeCachedConversation && threadMessages.length === 0),
    staleTime: 0,
    queryFn: async () => {
      if (!locationId || !selectedConversationId) {
        return [] as ChatMessageResponse[];
      }

      const accessToken = await getChatAccessToken("chat-conversation-history");
      return listChatConversationHistory(locationId, selectedConversationId, accessToken);
    }
  });

  const activeDraftConversation = useMemo<SidebarConversation | null>(() => {
    if (!activeConversationId || backendConversationIds.has(activeConversationId)) {
      return null;
    }

    if (threadMessages.length === 0) {
      return {
        id: activeConversationId,
        label: "New conversation",
        preview: "No messages yet",
        meta: isStreaming ? "Generating response..." : "Unsaved draft",
        anchorId: activeConversationId,
        messageCount: 0,
        isDraft: true
      };
    }

    const draftSummary = summarizeDraftThread(threadMessages);
    if (!draftSummary) {
      return null;
    }

    return {
      ...draftSummary,
      id: activeConversationId,
      meta: isStreaming ? "Generating response..." : draftSummary.meta
    };
  }, [activeConversationId, backendConversationIds, isStreaming, threadMessages]);

  const sidebarConversations = useMemo(() => {
    const persisted = [...(conversationsQuery.data ?? [])]
      .sort((left, right) => new Date(right.last_message_at).getTime() - new Date(left.last_message_at).getTime())
      .map((conversation) => summarizeConversationSummary(conversation));

    if (activeDraftConversation) {
      return [activeDraftConversation, ...persisted];
    }

    return persisted;
  }, [activeDraftConversation, conversationsQuery.data]);

  const activeThreadMessages = threadMessages;
  const threadIsEmpty = activeThreadMessages.length === 0;
  const characterCount = inputValue.length;
  const characterCountVisible = characterCount >= 1500;
  const characterCountTone = characterCount >= 1800 ? "text-amber-700" : "text-slate-500";
  const conversationLoading = Boolean(
    activeConversationHistoryQuery.isLoading && threadMessages.length === 0 && activeBackendConversation && !activeCachedConversation
  );
  const conversationHistoryError = activeConversationHistoryQuery.isError
    ? "Unable to load this conversation. Try selecting it again."
    : null;
  const conversationsError = conversationsQuery.isError ? "Unable to load conversation history." : null;

  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const thread = threadScrollRef.current;
    if (!thread) {
      return;
    }

    if (typeof thread.scrollTo === "function") {
      thread.scrollTo({
        top: thread.scrollHeight,
        behavior
      });
      return;
    }

    thread.scrollTop = thread.scrollHeight;
  }, []);

  const archiveThread = useCallback((id: string, messages: ThreadMessage[], history: ChatConversationMessage[]) => {
    const nextThread = snapshotThread(id, messages, history);
    if (!nextThread) {
      return;
    }

    setArchivedThreads((current) => {
      const withoutCurrent = current.filter((thread) => thread.id !== id);
      return [nextThread, ...withoutCurrent].slice(0, HISTORY_SIDEBAR_LIMIT);
    });
  }, []);

  const clearCurrentStream = useCallback(
    (options?: { preserveThread: boolean }) => {
      if (!isStreaming) {
        return;
      }

      streamStoppedRef.current = true;
      streamClosedRef.current = true;
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
      setIsStreaming(false);

      const assistantId = activeAssistantIdRef.current;

      if (options?.preserveThread && assistantId) {
        const nextMessages = finalizeInterruptedThread(threadMessagesRef.current, assistantId, streamContentRef.current);
        threadMessagesRef.current = nextMessages;
        setThreadMessages(nextMessages);
      }

      activeAssistantIdRef.current = null;
      streamContentRef.current = "";
      setStreamingStatusMessage(null);
      setShowBackToBottom(false);
      setIsPinnedToBottom(true);
    },
    [isStreaming]
  );

  const refreshConversationQueries = useCallback(() => {
    if (!locationId) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: chatConversationsQueryKey(locationId) });
    if (selectedConversationId) {
      void queryClient.invalidateQueries({
        queryKey: chatConversationHistoryQueryKey(locationId, selectedConversationId)
      });
    }
  }, [locationId, queryClient, selectedConversationId]);

  const hydrateConversation = useCallback(
    (conversationId: string, messages: ThreadMessage[], history: ChatConversationMessage[], anchorId: string) => {
      activeConversationIdRef.current = conversationId;
      setActiveConversationId(conversationId);
      threadMessagesRef.current = messages;
      conversationHistoryRef.current = history;
      setThreadMessages(messages);
      setConversationHistory(history);
      setPendingScrollToMessageId(anchorId);
      setStreamingStatusMessage(null);
      setShowBackToBottom(false);
      setIsPinnedToBottom(true);
      resizeTextarea();
      refreshConversationQueries();
    },
    [refreshConversationQueries, resizeTextarea]
  );

  const openConversation = useCallback(
    (conversationId: string) => {
      const currentConversationId = activeConversationIdRef.current ?? selectedConversationId;
      if (!conversationId || conversationId === currentConversationId) {
        return;
      }

      if (isStreaming) {
        const assistantId = activeAssistantIdRef.current;
        const snapshotMessages = finalizeInterruptedThread(
          threadMessagesRef.current,
          assistantId,
          streamContentRef.current
        );
        archiveThread(activeConversationIdRef.current ?? conversationId, snapshotMessages, conversationHistoryRef.current);
        clearCurrentStream({ preserveThread: false });
      } else if (threadMessagesRef.current.length > 0 && activeConversationIdRef.current) {
        archiveThread(activeConversationIdRef.current, threadMessagesRef.current, conversationHistoryRef.current);
      }

      const cachedConversation = archivedThreads.find((thread) => thread.id === conversationId);
      if (cachedConversation) {
        hydrateConversation(
          cachedConversation.id,
          cachedConversation.messages.map((message) => ({ ...message })),
          cachedConversation.conversationHistory.map((message) => ({ ...message })),
          cachedConversation.sidebar.anchorId
        );
        return;
      }

      activeConversationIdRef.current = conversationId;
      setActiveConversationId(conversationId);
      threadMessagesRef.current = [];
      conversationHistoryRef.current = [];
      setThreadMessages([]);
      setConversationHistory([]);
      setPendingScrollToMessageId(null);
      setStreamingStatusMessage(null);
      setShowBackToBottom(false);
      setIsPinnedToBottom(true);
      resizeTextarea();
      requestAnimationFrame(() => scrollThreadToBottom("auto"));
    },
    [archiveThread, archivedThreads, clearCurrentStream, hydrateConversation, isStreaming, resizeTextarea, scrollThreadToBottom, selectedConversationId]
  );

  const finalizeStream = useCallback(
    (options?: { note?: string }) => {
      const assistantId = activeAssistantIdRef.current;
      if (!assistantId || streamClosedRef.current) {
        return;
      }

      const assistantText = streamContentRef.current;
      const nextMessages = threadMessagesRef.current.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              content: assistantText.length > 0 ? assistantText : message.content,
              status: options?.note ? "error" : undefined,
              errorMessage: options?.note
            }
          : message
      );
      const nextHistory =
        assistantText.trim().length > 0
          ? [...conversationHistoryRef.current, { role: "assistant", content: assistantText }]
          : conversationHistoryRef.current;

      threadMessagesRef.current = nextMessages;
      conversationHistoryRef.current = nextHistory;
      setThreadMessages(nextMessages);
      setConversationHistory(nextHistory);

      if (activeConversationIdRef.current) {
        archiveThread(activeConversationIdRef.current, nextMessages, nextHistory);
      }

      activeAssistantIdRef.current = null;
      activeAbortControllerRef.current = null;
      streamClosedRef.current = true;
      setIsStreaming(false);
      setStreamingStatusMessage(options?.note ?? null);
      setShowBackToBottom(false);
      setIsPinnedToBottom(true);
      refreshConversationQueries();
    },
    [archiveThread, refreshConversationQueries]
  );

  const appendToken = useCallback(
    (token: string) => {
      const assistantId = activeAssistantIdRef.current;
      if (!assistantId) {
        return;
      }

      streamContentRef.current += token;

      const nextMessages = threadMessagesRef.current.map((message) =>
        message.id === assistantId
          ? {
              ...message,
              content: streamContentRef.current,
              status: "streaming",
              errorMessage: undefined
            }
          : message
      );

      threadMessagesRef.current = nextMessages;
      setThreadMessages(nextMessages);
      setStreamingStatusMessage(null);

      if (isPinnedToBottom) {
        requestAnimationFrame(() => scrollThreadToBottom("auto"));
      }
    },
    [isPinnedToBottom, scrollThreadToBottom]
  );

  const openStream = useCallback(
    async (nextMessage: string, conversationId: string, assistantId: string, accessToken: string) => {
      if (!locationId) {
        return;
      }

      streamClosedRef.current = false;
      streamStoppedRef.current = false;
      streamContentRef.current = "";
      setStreamingStatusMessage(null);
      setShowBackToBottom(false);
      setIsPinnedToBottom(true);
      setIsStreaming(true);
      activeAssistantIdRef.current = assistantId;

      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      scrollThreadToBottom("auto");

      try {
        const response = await sendChatMessage(locationId, accessToken, {
          message: nextMessage,
          conversationId,
          conversationHistory: conversationHistoryRef.current,
          signal: controller.signal
        });
        const contentType = response.headers.get("content-type");
        logChatDebug({ type: "response", status: response.status, ok: response.ok, contentType });

        if (!response.ok) {
          const errorMessage = await readJsonError(response);
          finalizeStream({ note: errorMessage ?? "Response interrupted — try again" });
          return;
        }

        if (!response.body || !contentType?.toLowerCase().includes("text/event-stream")) {
          finalizeStream({ note: "Response interrupted — try again" });
          return;
        }

        const result = await readChatStreamResponse(
          response,
          {
            onToken(token) {
              appendToken(token);
            },
            onDone() {
              finalizeStream();
            },
            onError(error) {
              finalizeStream({ note: error.message || "Response interrupted — try again" });
            },
            onDebug(event) {
              logChatDebug(event);
            }
          },
          controller.signal
        );

        if (!result.sawDone && !result.sawError && !streamClosedRef.current && !streamStoppedRef.current) {
          finalizeStream({ note: "Response interrupted — try again" });
        }
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        if (isAbort || streamStoppedRef.current || streamClosedRef.current) {
          return;
        }

        finalizeStream({ note: "Response interrupted — try again" });
      } finally {
        if (activeAbortControllerRef.current === controller) {
          activeAbortControllerRef.current = null;
        }
      }
    },
    [appendToken, finalizeStream, locationId, scrollThreadToBottom]
  );

  const submitMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || isStreaming || !locationId || !authReady) {
        return;
      }

      let accessToken: string | null = null;
      try {
        accessToken = await getChatAccessToken("chat-send");
      } catch {
        accessToken = null;
      }

      if (!accessToken) {
        setStreamingStatusMessage("Response interrupted — try again");
        return;
      }

      const conversationId = activeConversationIdRef.current ?? selectedConversationId ?? createId();
      const userMessageId = createId();
      const assistantMessageId = createId();
      const startedAt = new Date().toISOString();
      const nextHistory = [...conversationHistoryRef.current, { role: "user", content: trimmed }];
      const nextMessages: ThreadMessage[] = [
        ...threadMessagesRef.current,
        {
          id: userMessageId,
          conversationId,
          role: "user",
          content: trimmed,
          createdAt: startedAt
        },
        {
          id: assistantMessageId,
          conversationId,
          role: "assistant",
          content: "",
          createdAt: startedAt,
          status: "streaming"
        }
      ];

      activeConversationIdRef.current = conversationId;
      setActiveConversationId(conversationId);
      conversationHistoryRef.current = nextHistory;
      threadMessagesRef.current = nextMessages;
      setConversationHistory(nextHistory);
      setThreadMessages(nextMessages);
      setInputValue("");
      resizeTextarea();
      setPendingScrollToMessageId(null);
      requestAnimationFrame(() => scrollThreadToBottom("auto"));
      void openStream(trimmed, conversationId, assistantMessageId, accessToken);
    },
    [authReady, isStreaming, locationId, openStream, resizeTextarea, scrollThreadToBottom, selectedConversationId]
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      setInputValue(prompt);
      void submitMessage(prompt);
    },
    [submitMessage]
  );

  const handleNewConversation = useCallback(() => {
    const nextConversationId = createId();
    const currentMessages = threadMessagesRef.current;

    if (currentMessages.length > 0 && activeConversationIdRef.current) {
      const snapshotMessages = isStreaming
        ? finalizeInterruptedThread(currentMessages, activeAssistantIdRef.current, streamContentRef.current)
        : currentMessages;
      archiveThread(activeConversationIdRef.current, snapshotMessages, conversationHistoryRef.current);
    }

    clearCurrentStream({ preserveThread: false });
    activeConversationIdRef.current = nextConversationId;
    setActiveConversationId(nextConversationId);
    threadMessagesRef.current = [];
    conversationHistoryRef.current = [];
    setThreadMessages([]);
    setConversationHistory([]);
    setInputValue("");
    setStreamingStatusMessage(null);
    setShowBackToBottom(false);
    setIsPinnedToBottom(true);
    setPendingScrollToMessageId(null);
    resizeTextarea();
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [archiveThread, clearCurrentStream, isStreaming, resizeTextarea]);

  const handleHistorySelect = useCallback(
    (selectedConversationId: string) => {
      openConversation(selectedConversationId);
    },
    [openConversation]
  );

  const handleThreadScroll = useCallback(() => {
    const thread = threadScrollRef.current;
    if (!thread) {
      return;
    }

    const distanceFromBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    setIsPinnedToBottom(nearBottom);
    setShowBackToBottom(!nearBottom && isStreaming);
  }, [isStreaming]);

  const handleStopGenerating = useCallback(() => {
    clearCurrentStream({ preserveThread: true });
    refreshConversationQueries();
  }, [clearCurrentStream, refreshConversationQueries]);

  const pastConversationsPanel = (
    <div className="space-y-4 text-white">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">Past conversations</h2>
        <span className="text-xs text-white/40">{sidebarConversations.length}</span>
      </div>

      {conversationsError ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">{conversationsError}</div>
      ) : conversationsQuery.isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          Loading conversation history...
        </div>
      ) : sidebarConversations.length > 0 ? (
        <div role="tablist" aria-label="Past conversations" className="space-y-2">
          {sidebarConversations.map((conversation) => (
            <ChatSidebarConversationItem
              key={`${conversation.id}-${conversation.anchorId}`}
              conversation={conversation}
              active={conversation.id === selectedConversationId}
              onSelect={handleHistorySelect}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/60">
          Recent conversations will appear here after you send a message.
        </div>
      )}
    </div>
  );

  useEffect(() => {
    const loadedMessages = activeConversationHistoryQuery.data;
    if (!loadedMessages || threadMessagesRef.current.length > 0) {
      return;
    }

    const nextMessages = loadedMessages.map(toThreadMessage);
    const nextHistory = messageHistoryFromThread(nextMessages);
    threadMessagesRef.current = nextMessages;
    conversationHistoryRef.current = nextHistory;
    setThreadMessages(nextMessages);
    setConversationHistory(nextHistory);
    setPendingScrollToMessageId(nextMessages[0]?.id ?? null);

    if (activeConversationIdRef.current) {
      archiveThread(activeConversationIdRef.current, nextMessages, nextHistory);
    }
  }, [activeConversationHistoryQuery.data, archiveThread]);

  useEffect(() => {
    if (!activeConversationHistoryQuery.isError || threadMessagesRef.current.length > 0) {
      return;
    }

    setThreadMessages([]);
    setConversationHistory([]);
    threadMessagesRef.current = [];
    conversationHistoryRef.current = [];
  }, [activeConversationHistoryQuery.isError]);

  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
      activeAssistantIdRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!pendingScrollToMessageId) {
      return;
    }

    const node = messageRefs.current.get(pendingScrollToMessageId);
    if (node) {
      if (typeof node.scrollIntoView === "function") {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setPendingScrollToMessageId(null);
    }
  }, [pendingScrollToMessageId, threadMessages]);

  useEffect(() => {
    if (!pendingScrollToMessageId && activeThreadMessages.length > 0 && isPinnedToBottom) {
      requestAnimationFrame(() => scrollThreadToBottom("auto"));
    }
  }, [activeThreadMessages.length, isPinnedToBottom, pendingScrollToMessageId, scrollThreadToBottom]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      node.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [locationId]);

  const renderPromptGrid = () => (
    <div className="grid gap-3 sm:grid-cols-2">
      {EMPTY_PROMPTS.map((prompt) => (
        <button
          key={prompt.text}
          type="button"
          onClick={() => handlePromptClick(prompt.text)}
          className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-pharma-teal hover:shadow-md"
        >
          <div className="mb-3 text-2xl">{prompt.icon}</div>
          <div className="text-sm font-medium leading-6 text-slate-900">{prompt.text}</div>
        </button>
      ))}
    </div>
  );

  if (!locationId) {
    return (
      <div className="flex h-[calc(100dvh-7.5rem)] flex-col overflow-hidden lg:h-[calc(100dvh-4rem)]">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/80 px-6 text-center shadow-sm">
          <MessageSquareText className="mb-4 h-10 w-10 text-pharma-teal" aria-hidden="true" />
          <h1 className="text-2xl font-semibold text-slate-900">Chat</h1>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Select a location to start asking inventory questions.
          </p>
        </div>
      </div>
    );
  }

  const sidebarFallback = chatSidebarSlot ? null : (
    <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-primary text-white lg:flex lg:flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">{pastConversationsPanel}</div>
    </aside>
  );

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-4rem)]">
      {sidebarFallback}
      {chatSidebarSlot ? createPortal(pastConversationsPanel, chatSidebarSlot) : null}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(15,31,61,0.06),_transparent_42%)]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-4 backdrop-blur md:px-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Chat</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ask about inventory, reorder risk, and purchasing using live forecast context.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleNewConversation}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New conversation
            </Button>
          </div>
        </div>

        <div ref={threadScrollRef} onScroll={handleThreadScroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
            {conversationLoading ? (
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-pharma-teal" aria-hidden="true" />
                  <span className="text-sm text-slate-600">Loading conversation history...</span>
                </div>
              </div>
            ) : null}

            {!conversationLoading && threadIsEmpty ? (
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg backdrop-blur">
                  <div className="mb-6">
                    <div className="text-sm font-medium uppercase tracking-wide text-slate-400">Suggested prompts</div>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900">Start with a quick inventory question</h2>
                    <p className="mt-1 text-sm text-slate-500">These suggestions are tailored for a fresh conversation.</p>
                  </div>
                  {renderPromptGrid()}
                </div>
              </div>
            ) : null}

            {!conversationLoading &&
              activeThreadMessages.map((message) => (
                <ChatBubble
                  key={message.id}
                  message={message}
                  registerRef={(messageId, node) => {
                    messageRefs.current.set(messageId, node);
                  }}
                />
              ))}

            {conversationHistoryError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {conversationHistoryError}
              </div>
            ) : null}

            {showBackToBottom ? (
              <div className="sticky bottom-4 z-10 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="shadow-lg"
                  onClick={() => {
                    setIsPinnedToBottom(true);
                    setShowBackToBottom(false);
                    scrollThreadToBottom("auto");
                  }}
                >
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  Back to bottom
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white/95 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-6">
          <div className="mx-auto w-full max-w-4xl">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMessage(inputValue);
              }}
            >
              <div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  placeholder="Ask about your inventory..."
                  maxLength={MAX_CHAT_INPUT_LENGTH}
                  rows={1}
                  disabled={!locationId || !authReady || isStreaming}
                  onChange={(event) => {
                    setInputValue(event.target.value);
                    resizeTextarea(event.currentTarget);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Tab") {
                      event.preventDefault();
                      const target = event.currentTarget;
                      const start = target.selectionStart ?? target.value.length;
                      const end = target.selectionEnd ?? target.value.length;
                      const nextValue = `${target.value.slice(0, start)}\t${target.value.slice(end)}`;
                      setInputValue(nextValue);
                      resizeTextarea(target);
                      requestAnimationFrame(() => {
                        target.selectionStart = target.selectionEnd = start + 1;
                      });
                      return;
                    }

                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void submitMessage(inputValue);
                    }
                  }}
                  className="min-h-11 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-h-5 text-[11px]">
                    {characterCountVisible ? (
                      <span className={cn("font-mono font-medium", characterCountTone)}>
                        {characterCount}/{MAX_CHAT_INPUT_LENGTH}
                      </span>
                    ) : (
                      <span className="text-slate-400">Ctrl+Enter or Cmd+Enter to send</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isStreaming ? (
                      <Button type="button" variant="outline" onClick={handleStopGenerating}>
                        <Square className="h-4 w-4" aria-hidden="true" />
                        Stop generating
                      </Button>
                    ) : (
                      <Button type="submit" variant="teal" disabled={!inputValue.trim() || isStreaming}>
                        <Send className="h-4 w-4" aria-hidden="true" />
                        Send
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              {streamingStatusMessage ? <div className="text-sm text-rose-600">{streamingStatusMessage}</div> : null}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ChatPage() {
  const { authReady, currentLocation } = useAppContext();
  const locationId = currentLocation?.id ?? null;

  if (!authReady) {
    return (
      <div className="flex h-[calc(100dvh-7.5rem)] items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-4rem)]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-pharma-teal" aria-hidden="true" />
          Loading chat...
        </div>
      </div>
    );
  }

  return <ChatWorkspace key={locationId ?? "none"} authReady={authReady} locationId={locationId} />;
}

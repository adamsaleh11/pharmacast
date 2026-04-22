"use client";

import Link from "next/link";
import { ArrowDown, Clock3, MessageSquareText, Plus, Send, Square } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { productNavigation } from "@/components/app-shell/navigation";
import { readJsonError, sendChatMessage } from "@/lib/api/chat";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import { readChatStreamResponse } from "@/lib/chat-stream";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/providers/app-context";
import type { ChatStreamDebugEvent } from "@/lib/chat-stream";
import type { ChatConversationMessage, ChatRole } from "@/types/chat";

type ThreadMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  status?: "streaming" | "error";
  errorMessage?: string;
};

type SidebarConversation = {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  anchorId: string;
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

function summarizeThread(messages: ThreadMessage[]): SidebarConversation | null {
  if (messages.length === 0) {
    return null;
  }

  const firstUserMessage = messages.find((message) => message.role === "user");
  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant");
  const anchor = firstUserMessage ?? messages[0];

  return {
    id: anchor.id,
    title: truncate(firstUserMessage?.content ?? "New conversation", 42),
    preview: truncate(lastAssistantMessage?.content || firstUserMessage?.content || "New conversation", 64),
    createdAt: anchor.createdAt,
    anchorId: anchor.id
  };
}

function snapshotThread(
  threadId: string,
  messages: ThreadMessage[],
  conversationHistory: ChatConversationMessage[]
): ArchivedThread | null {
  const sidebar = summarizeThread(messages);
  if (!sidebar) {
    return null;
  }

  return {
    id: threadId,
    messages: messages.map((message) => ({ ...message })),
    conversationHistory: conversationHistory.map((message) => ({ ...message })),
    sidebar: {
      ...sidebar,
      id: threadId,
    }
  };
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
    <div className={cn("group flex w-full", isUser ? "justify-end" : "justify-start")} ref={(node) => registerRef(message.id, node)}>
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

function ChatWorkspace({ authReady, locationId }: { authReady: boolean; locationId: string | null }) {
  const [threadId, setThreadId] = useState<string | null>(null);
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
  const streamContentRef = useRef("");
  const streamClosedRef = useRef(false);
  const streamStoppedRef = useRef(false);
  const messageRefs = useRef(new Map<string, HTMLDivElement | null>());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = useCallback((node: HTMLTextAreaElement | null = textareaRef.current) => {
    if (!node) {
      return;
    }

    node.style.height = "auto";
    const nextHeight = Math.min(node.scrollHeight, 4 * 24 + 20);
    node.style.height = `${nextHeight}px`;
  }, []);

  const activeThreadMessages = threadMessages;
  const sidebarHistory = useMemo(() => archivedThreads.map((thread) => thread.sidebar).slice(0, HISTORY_SIDEBAR_LIMIT), [
    archivedThreads
  ]);
  const threadIsEmpty = activeThreadMessages.length === 0;
  const characterCount = inputValue.length;
  const characterCountVisible = characterCount >= 1500;
  const characterCountTone = characterCount >= 1800 ? "text-amber-700" : "text-slate-500";

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

  const appendToken = useCallback(
    (token: string) => {
      const assistantId = activeAssistantIdRef.current;
      if (!assistantId) {
        return;
      }

      streamContentRef.current += token;

      setThreadMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: streamContentRef.current,
                status: "streaming",
                errorMessage: undefined
              }
            : message
        )
      );

      setStreamingStatusMessage(null);

      if (isPinnedToBottom) {
        requestAnimationFrame(() => scrollThreadToBottom("auto"));
      }
    },
    [isPinnedToBottom, scrollThreadToBottom]
  );

  const finalizeStream = useCallback(
    (options?: { note?: string }) => {
      const assistantId = activeAssistantIdRef.current;
      if (!assistantId || streamClosedRef.current) {
        return;
      }

      const assistantText = streamContentRef.current;

      setThreadMessages((current) => {
        const nextMessages = current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: assistantText.length > 0 ? assistantText : message.content,
                status: options?.note ? "error" : undefined,
                errorMessage: options?.note
              }
            : message
        );

        return nextMessages;
      });

      if (assistantText.trim().length > 0) {
        setConversationHistory((current) => [
          ...current,
          {
            role: "assistant",
            content: assistantText
          }
        ]);
      }

      activeAssistantIdRef.current = null;
      activeAbortControllerRef.current = null;
      streamClosedRef.current = true;
      setIsStreaming(false);
      setStreamingStatusMessage(options?.note ?? null);
      setShowBackToBottom(false);
      setIsPinnedToBottom(true);
    },
    []
  );

  const openStream = useCallback(
    async (nextMessage: string, assistantId: string, accessToken: string) => {
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
          conversationHistory: [],
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
        const supabase = createSupabaseBrowserClient();
        if (!supabase) {
          setStreamingStatusMessage("Response interrupted — try again");
          return;
        }

        accessToken = await getBackendAccessToken(supabase, "chat-stream");
      } catch {
        accessToken = null;
      }

      if (!accessToken) {
        setStreamingStatusMessage("Response interrupted — try again");
        return;
      }

      const nextThreadId = threadId ?? createId();
      const userMessageId = createId();
      const assistantMessageId = createId();
      const startedAt = new Date().toISOString();

      setThreadId(nextThreadId);
      setConversationHistory((current) => [...current, { role: "user", content: trimmed }]);
      setInputValue("");
      resizeTextarea();
      setThreadMessages((current) => [
        ...current,
        {
          id: userMessageId,
          role: "user",
          content: trimmed,
          createdAt: startedAt
        },
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          createdAt: startedAt,
          status: "streaming"
        }
      ]);
      requestAnimationFrame(() => scrollThreadToBottom("auto"));
      void openStream(trimmed, assistantMessageId, accessToken);
    },
    [authReady, isStreaming, locationId, openStream, resizeTextarea, scrollThreadToBottom, threadId]
  );

  const handlePromptClick = useCallback(
    (prompt: string) => {
      setInputValue(prompt);
      submitMessage(prompt);
    },
    [submitMessage]
  );

  const handleNewConversation = useCallback(() => {
    if (isStreaming) {
      streamStoppedRef.current = true;
      streamClosedRef.current = true;
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
      activeAssistantIdRef.current = null;
      streamContentRef.current = "";
      setIsStreaming(false);
    }

    if (threadId && threadMessages.length > 0) {
      archiveThread(threadId, threadMessages, conversationHistory);
    }

    setThreadId(null);
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
  }, [archiveThread, conversationHistory, isStreaming, resizeTextarea, threadId, threadMessages]);

  const handleHistorySelect = useCallback(
    (selectedThreadId: string) => {
      const selectedThread = archivedThreads.find((thread) => thread.id === selectedThreadId);
      if (!selectedThread) {
        return;
      }

      setThreadId(selectedThread.id);
      setThreadMessages(selectedThread.messages.map((message) => ({ ...message })));
      setConversationHistory(selectedThread.conversationHistory.map((message) => ({ ...message })));
      setPendingScrollToMessageId(selectedThread.sidebar.anchorId);
      setInputValue("");
      setShowBackToBottom(false);
      setIsPinnedToBottom(true);
      resizeTextarea();
      requestAnimationFrame(() => scrollThreadToBottom("auto"));
    },
    [archivedThreads, resizeTextarea, scrollThreadToBottom]
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
    if (!isStreaming) {
      return;
    }

    streamStoppedRef.current = true;
    streamClosedRef.current = true;
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    setIsStreaming(false);

    const assistantId = activeAssistantIdRef.current;

    if (assistantId) {
      setThreadMessages((current) => {
        const nextMessages: ThreadMessage[] = [];

        current.forEach((message) => {
          if (message.id !== assistantId) {
            nextMessages.push(message);
            return;
          }

          const partialContent = streamContentRef.current || message.content;
          if (partialContent.trim().length === 0) {
            return;
          }

          nextMessages.push({
            ...message,
            content: partialContent,
            status: undefined,
            errorMessage: undefined
          });
        });

        return nextMessages;
      });
    }

    activeAssistantIdRef.current = null;
    streamContentRef.current = "";
    setStreamingStatusMessage(null);
    setShowBackToBottom(false);
    setIsPinnedToBottom(true);
  }, [isStreaming]);

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

  const renderSidebar = () => (
    <aside className="hidden w-80 shrink-0 border-r border-white/10 bg-primary text-white lg:flex lg:flex-col">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">PharmaCast</p>
              <p className="text-xs text-white/60">Inventory chat</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="New conversation"
            onClick={handleNewConversation}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {productNavigation.map((item) => {
              const active = item.href === "/chat";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/10 hover:text-white",
                    active && "bg-white/12 text-white"
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between px-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-white/40">History</h2>
              <span className="text-xs text-white/40">{sidebarHistory.length}</span>
            </div>

            {sidebarHistory.length > 0 ? (
              <div className="space-y-2">
                {sidebarHistory.map((conversation) => (
                  <button
                    key={`${conversation.id}-${conversation.anchorId}`}
                    type="button"
                    onClick={() => handleHistorySelect(conversation.id)}
                    className="w-full rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-white/10 hover:bg-white/10"
                  >
                    <div className="text-sm font-medium text-white">{conversation.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-white/70">{conversation.preview}</div>
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-white/40">
                      <Clock3 className="h-3 w-3" aria-hidden="true" />
                      {formatTimestamp(conversation.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/60">
                Recent conversations will appear here after you send a message.
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
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

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-4rem)]">
      {renderSidebar()}

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
            {threadIsEmpty ? (
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <div className="w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg backdrop-blur">
                  <div className="mb-6">
                    <div className="text-sm font-medium uppercase tracking-wide text-slate-400">Suggested prompts</div>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900">Start with a quick inventory question</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      These suggestions are tailored for a fresh conversation.
                    </p>
                  </div>
                  {renderPromptGrid()}
                </div>
              </div>
            ) : null}

            {activeThreadMessages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                registerRef={(messageId, node) => {
                  messageRefs.current.set(messageId, node);
                }}
              />
            ))}

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
                submitMessage(inputValue);
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
                      submitMessage(inputValue);
                    }
                  }}
                  className="min-h-11 resize-none border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="min-h-5 text-[11px]">
                    {characterCountVisible ? (
                      <span className={cn("font-medium", characterCountTone)}>
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

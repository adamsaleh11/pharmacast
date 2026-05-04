import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatPage from "./page";
import { listChatConversationHistory, listChatConversations, sendChatMessage } from "@/lib/api/chat";

let mockSearch = "";
let mockAppContext = {
  authReady: true,
  currentLocation: {
    id: "location-1",
    name: "Main Street Pharmacy"
  }
};

vi.mock("@/providers/app-context", () => ({
  useAppContext: vi.fn(() => mockAppContext)
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn(() => ({}))
}));

vi.mock("@/lib/supabase/session", () => ({
  getBackendAccessToken: vi.fn(async () => "access-token")
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch)
}));

vi.mock("@/lib/api/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat")>("@/lib/api/chat");
  return {
    ...actual,
    sendChatMessage: vi.fn(),
    listChatConversations: vi.fn(),
    listChatConversationHistory: vi.fn()
  };
});

const mockSendChatMessage = vi.mocked(sendChatMessage);
const mockListChatConversations = vi.mocked(listChatConversations);
const mockListChatConversationHistory = vi.mocked(listChatConversationHistory);

function renderChatPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ChatPage />
    </QueryClientProvider>
  );
}

function createStreamingResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
    }
  });

  return {
    response: new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream"
      }
    }),
    push(payload: unknown) {
      controller?.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
    },
    close() {
      controller?.close();
    }
  };
}

beforeEach(() => {
  mockAppContext = {
    authReady: true,
    currentLocation: {
      id: "location-1",
      name: "Main Street Pharmacy"
    }
  };
  mockSendChatMessage.mockReset();
  mockListChatConversations.mockReset();
  mockListChatConversationHistory.mockReset();
  mockSearch = "";
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Chat route", () => {
  it("starts a fresh chat without loading prior history", async () => {
    mockListChatConversations.mockResolvedValue([]);

    renderChatPage();

    expect(await screen.findByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByText("Start with a quick inventory question")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading conversation history...")).not.toBeInTheDocument());
    expect(screen.getByText("Recent conversations will appear here after you send a message.")).toBeInTheDocument();
    expect(mockListChatConversations).toHaveBeenCalledWith("location-1", "access-token");
    expect(mockListChatConversationHistory).not.toHaveBeenCalled();
  });

  it("hydrates a saved conversation from the sidebar", async () => {
    mockListChatConversations.mockResolvedValue([
      {
        conversation_id: "conversation-1",
        location_id: "location-1",
        user_id: "user-1",
        started_at: "2026-04-21T10:00:00Z",
        last_message_at: "2026-04-21T10:05:00Z",
        message_count: 2
      }
    ]);
    mockListChatConversationHistory.mockResolvedValue([
      {
        id: "message-1",
        conversation_id: "conversation-1",
        user_id: "user-1",
        role: "user",
        content: "What should I order?",
        created_at: "2026-04-21T10:00:00Z"
      },
      {
        id: "message-2",
        conversation_id: "conversation-1",
        user_id: "user-1",
        role: "assistant",
        content: "Order 10 units of amoxicillin.",
        created_at: "2026-04-21T10:00:01Z"
      }
    ]);

    renderChatPage();

    expect(await screen.findByText("What should I order?")).toBeInTheDocument();
    expect(await screen.findByText("Order 10 units of amoxicillin.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /2 messages/i })).toBeInTheDocument();
    expect(mockListChatConversationHistory).toHaveBeenCalledWith("location-1", "conversation-1", "access-token");
  });

  it("prefills a review prompt from the query string", async () => {
    mockListChatConversations.mockResolvedValue([
      {
        conversation_id: "conversation-1",
        location_id: "location-1",
        user_id: "user-1",
        started_at: "2026-04-21T10:00:00Z",
        last_message_at: "2026-04-21T10:05:00Z",
        message_count: 2
      }
    ]);
    mockSearch = "message=Review%20this%20purchase%20order%3A%20Purchase%20Order%20%E2%80%94%20Apr%2020%2C%202026%20%E2%80%94%201%20item";

    renderChatPage();

    const input = await screen.findByRole("textbox");
    expect(input).toHaveValue("Review this purchase order: Purchase Order — Apr 20, 2026 — 1 item");
    await waitFor(() => expect(screen.queryByText("Loading conversation history...")).not.toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /new conversation.*unsaved draft/i })).toBeInTheDocument();
    expect(screen.getByText("Unsaved draft")).toBeInTheDocument();
    expect(mockListChatConversationHistory).not.toHaveBeenCalled();
  });

  it("sends chat requests with a conversation_id", async () => {
    const user = userEvent.setup();
    const stream = createStreamingResponse();
    mockListChatConversations.mockResolvedValue([]);
    mockSendChatMessage.mockResolvedValue(stream.response);

    renderChatPage();

    const promptButton = await screen.findByRole("button", {
      name: /Which drugs should I reorder this week\?/i
    });

    await user.click(promptButton);

    expect(mockSendChatMessage).toHaveBeenCalledWith(
      "location-1",
      "access-token",
      expect.objectContaining({
        message: "Which drugs should I reorder this week?",
        conversationId: expect.any(String)
      })
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument());

    await act(async () => {
      stream.push({ token: "Amoxicillin" });
      stream.push({ token: " should be reordered." });
      stream.push({ done: true, total_tokens: 2 });
      stream.close();
    });

    expect((await screen.findAllByText(/Amoxicillin should be reordered\./)).length).toBeGreaterThan(0);
  });

  it("stops generation without marking an intentional cancel as an error", async () => {
    const user = userEvent.setup();
    const stream = createStreamingResponse();
    mockListChatConversations.mockResolvedValue([]);
    mockSendChatMessage.mockResolvedValue(stream.response);

    renderChatPage();

    const promptButton = await screen.findByRole("button", {
      name: /Which drugs should I reorder this week\?/i
    });

    await user.click(promptButton);

    await act(async () => {
      stream.push({ token: "Amoxicillin" });
    });

    await waitFor(() => expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument());

    expect((await screen.findAllByText(/Amoxicillin/)).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Stop generating" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop generating" })).not.toBeInTheDocument());
    expect((await screen.findAllByText(/Amoxicillin/)).length).toBeGreaterThan(0);
    expect(screen.queryByText("Response interrupted — try again")).not.toBeInTheDocument();
  });
});

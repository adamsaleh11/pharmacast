import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChatPage from "./page";
import { sendChatMessage } from "@/lib/api/chat";

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

vi.mock("@/lib/api/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat")>("@/lib/api/chat");
  return {
    ...actual,
    sendChatMessage: vi.fn()
  };
});

const mockSendChatMessage = vi.mocked(sendChatMessage);

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
    renderChatPage();

    expect(await screen.findByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Insights" })).toBeInTheDocument();
    expect(screen.getByText("Start with a quick inventory question")).toBeInTheDocument();
    expect(screen.getByText("Recent conversations will appear here after you send a message.")).toBeInTheDocument();
    expect(screen.queryByText("Loading chat history...")).not.toBeInTheDocument();
  });

  it("archives a finished thread locally and can reopen it from the sidebar", async () => {
    const user = userEvent.setup();
    const stream = createStreamingResponse();
    mockSendChatMessage.mockResolvedValue(stream.response);

    renderChatPage();

    expect(await screen.findByText("Start with a quick inventory question")).toBeInTheDocument();

    const promptButton = await screen.findByRole("button", {
      name: /Which drugs should I reorder this week\?/i
    });

    await user.click(promptButton);

    expect(mockSendChatMessage).toHaveBeenCalledWith(
      "location-1",
      "access-token",
      expect.objectContaining({
        message: "Which drugs should I reorder this week?"
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

    await user.click(screen.getAllByRole("button", { name: "New conversation" })[1]);

    const archivedPreview = await screen.findByText("Amoxicillin should be reordered.");
    const archivedThreadButton = archivedPreview.closest("button");
    expect(archivedThreadButton).not.toBeNull();

    await user.click(archivedThreadButton as HTMLButtonElement);

    expect((await screen.findAllByText("Which drugs should I reorder this week?")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Amoxicillin should be reordered\./)).length).toBeGreaterThan(0);
  });

  it("stops generation without marking an intentional cancel as an error", async () => {
    const user = userEvent.setup();
    const stream = createStreamingResponse();
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

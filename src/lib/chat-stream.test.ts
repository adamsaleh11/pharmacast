import { describe, expect, it, vi } from "vitest";
import { readChatStreamResponse } from "./chat-stream";

function createResponseStream() {
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
    push(line: string) {
      controller?.enqueue(encoder.encode(line));
    },
    close() {
      controller?.close();
    }
  };
}

describe("readChatStreamResponse", () => {
  it("reads SSE tokens from line-delimited frames and resolves on done", async () => {
    const stream = createResponseStream();
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const resultPromise = readChatStreamResponse(stream.response, {
      onToken,
      onDone,
      onError
    });

    stream.push('data: {"token":"Hel"}\n');
    stream.push('data: {"token":"lo"}\n');
    stream.push('data: {"done":true,"total_tokens":42}\n');
    stream.close();

    await expect(resultPromise).resolves.toEqual({ sawDone: true, sawError: false });
    expect(onToken).toHaveBeenCalledWith("Hel");
    expect(onToken).toHaveBeenCalledWith("lo");
    expect(onDone).toHaveBeenCalledWith(42);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores non-data lines while continuing to read the stream", async () => {
    const stream = createResponseStream();
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const resultPromise = readChatStreamResponse(stream.response, {
      onToken,
      onDone,
      onError
    });

    stream.push("event: message\n");
    stream.push("retry: 1000\n");
    stream.push('data: {"token":"A"}\n');
    stream.push('data: {"done":true,"total_tokens":1}\n');
    stream.close();

    await expect(resultPromise).resolves.toEqual({ sawDone: true, sawError: false });
    expect(onToken).toHaveBeenCalledWith("A");
    expect(onDone).toHaveBeenCalledWith(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it("parses complete SSE frames when Spring-style chunks use CRLF separators", async () => {
    const stream = createResponseStream();
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const resultPromise = readChatStreamResponse(stream.response, {
      onToken,
      onDone,
      onError
    });

    stream.push('event:message\r\ndata:{"token":"Hel"}\r\n\r\n');
    stream.push('data:{"token":"lo"}\r\n\r\n');
    stream.push('data:{"done":true,"total_tokens":2}\r\n\r\n');
    stream.close();

    await expect(resultPromise).resolves.toEqual({ sawDone: true, sawError: false });
    expect(onToken).toHaveBeenCalledWith("Hel");
    expect(onToken).toHaveBeenCalledWith("lo");
    expect(onDone).toHaveBeenCalledWith(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("buffers partial chunks until a full SSE event is available", async () => {
    const stream = createResponseStream();
    const onToken = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const resultPromise = readChatStreamResponse(stream.response, {
      onToken,
      onDone,
      onError
    });

    stream.push('data: {"tok');
    stream.push('en":"Hel"}\n\n');
    stream.push('data: {"done":');
    stream.push('true,"total_tokens":1}');
    stream.push("\n\n");
    stream.close();

    await expect(resultPromise).resolves.toEqual({ sawDone: true, sawError: false });
    expect(onToken).toHaveBeenCalledWith("Hel");
    expect(onDone).toHaveBeenCalledWith(1);
    expect(onError).not.toHaveBeenCalled();
  });
});

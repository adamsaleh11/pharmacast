import type { ChatStreamPayload } from "@/types/chat";
import type { ChatStreamEvent } from "@/types/chat";

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("binary");

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function serializeChatStreamPayload(payload: ChatStreamPayload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function deserializeChatStreamPayload(value: string): ChatStreamPayload | null {
  try {
    const bytes = base64UrlToBytes(value);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as ChatStreamPayload;

    if (
      !parsed ||
      typeof parsed.locationId !== "string" ||
      typeof parsed.conversationId !== "string" ||
      typeof parsed.message !== "string" ||
      !Array.isArray(parsed.conversationHistory)
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export type ChatStreamReadHandlers = {
  onToken(token: string): void;
  onDone(totalTokens: number | null): void;
  onError(error: Extract<ChatStreamEvent, { error: string }>): void;
  onDebug?(event: ChatStreamDebugEvent): void;
};

export type ChatStreamReadResult = {
  sawDone: boolean;
  sawError: boolean;
};

export type ChatStreamDebugEvent =
  | { type: "chunk"; byteLength: number; bufferLength: number }
  | { type: "event"; dataLineCount: number; payloadCount: number }
  | { type: "payload"; kind: "token"; tokenLength: number }
  | { type: "payload"; kind: "done"; totalTokens: number | null }
  | { type: "payload"; kind: "error"; error: string; messageLength: number }
  | { type: "payload"; kind: "malformed"; payloadLength: number }
  | { type: "closed"; sawDone: boolean; sawError: boolean; remainingBufferLength: number };

function normalizeSseLine(rawLine: string) {
  return rawLine.replace(/^\uFEFF/, "").trimEnd();
}

function parseSseEvent(rawEvent: string): { payloads: string[]; dataLineCount: number } {
  const dataLines: string[] = [];

  for (const rawLine of rawEvent.split("\n")) {
    const line = normalizeSseLine(rawLine);
    const fieldSeparatorIndex = line.indexOf(":");
    const field = fieldSeparatorIndex === -1 ? line : line.slice(0, fieldSeparatorIndex);

    if (field !== "data") {
      continue;
    }

    let value = fieldSeparatorIndex === -1 ? "" : line.slice(fieldSeparatorIndex + 1);
    if (value.startsWith(" ")) {
      value = value.slice(1);
    }
    dataLines.push(value);
  }

  const payload = dataLines.join("\n").trim();
  if (!payload) {
    return { payloads: [], dataLineCount: dataLines.length };
  }

  if (dataLines.length <= 1) {
    return { payloads: [payload], dataLineCount: dataLines.length };
  }

  try {
    JSON.parse(payload);
    return { payloads: [payload], dataLineCount: dataLines.length };
  } catch {
    return { payloads: dataLines.map((line) => line.trim()).filter(Boolean), dataLineCount: dataLines.length };
  }
}

export async function readChatStreamResponse(
  response: Response,
  handlers: ChatStreamReadHandlers,
  signal?: AbortSignal
): Promise<ChatStreamReadResult> {
  if (!response.body) {
    throw new Error("Missing chat stream body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDone = false;
  let sawError = false;

  const dispatchPayload = (payloadText: string) => {
    if (!payloadText) {
      return false;
    }

    try {
      const parsed = JSON.parse(payloadText) as ChatStreamEvent;
      if (parsed && typeof parsed === "object") {
        if ("token" in parsed && typeof parsed.token === "string") {
          handlers.onDebug?.({ type: "payload", kind: "token", tokenLength: parsed.token.length });
          handlers.onToken(parsed.token);
          return false;
        }

        if ("done" in parsed && parsed.done) {
          sawDone = true;
          const totalTokens = typeof parsed.total_tokens === "number" ? parsed.total_tokens : null;
          handlers.onDebug?.({ type: "payload", kind: "done", totalTokens });
          handlers.onDone(totalTokens);
          return true;
        }

        if ("error" in parsed && typeof parsed.error === "string") {
          sawError = true;
          handlers.onDebug?.({
            type: "payload",
            kind: "error",
            error: parsed.error,
            messageLength: typeof parsed.message === "string" ? parsed.message.length : 0
          });
          handlers.onError(parsed);
          return true;
        }
      }
    } catch {
      handlers.onDebug?.({ type: "payload", kind: "malformed", payloadLength: payloadText.length });
      // Ignore malformed frames and keep reading subsequent data lines.
    }

    return false;
  };

  try {
    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      const { done, value } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      handlers.onDebug?.({ type: "chunk", byteLength: value?.byteLength ?? 0, bufferLength: buffer.length });

      let eventBoundaryIndex = buffer.indexOf("\n\n");
      while (eventBoundaryIndex !== -1) {
        const rawEvent = buffer.slice(0, eventBoundaryIndex);
        buffer = buffer.slice(eventBoundaryIndex + 2);

        const { payloads: payloadTexts, dataLineCount } = parseSseEvent(rawEvent);
        handlers.onDebug?.({ type: "event", dataLineCount, payloadCount: payloadTexts.length });
        for (const payloadText of payloadTexts) {
          if (dispatchPayload(payloadText)) {
            return { sawDone, sawError };
          }
        }

        eventBoundaryIndex = buffer.indexOf("\n\n");
      }

      if (!done) {
        continue;
      }

      break;
    }

    const { payloads: trailingPayloads, dataLineCount } = parseSseEvent(buffer);
    if (buffer.length > 0) {
      handlers.onDebug?.({ type: "event", dataLineCount, payloadCount: trailingPayloads.length });
    }
    for (const trailingPayload of trailingPayloads) {
      if (dispatchPayload(trailingPayload)) {
        return { sawDone, sawError };
      }
    }

    handlers.onDebug?.({ type: "closed", sawDone, sawError, remainingBufferLength: buffer.length });
    return { sawDone, sawError };
  } finally {
    reader.releaseLock();
  }
}

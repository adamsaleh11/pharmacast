import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { deserializeChatStreamPayload } from "@/lib/chat-stream";
import { getPublicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function streamHeaders() {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  };
}

function fallbackStream(error: { error: string; message: string }) {
  return new Response(`data: ${JSON.stringify(error)}\n\n`, {
    status: 200,
    headers: streamHeaders()
  });
}

export async function GET(request: NextRequest) {
  const env = getPublicEnv();
  const payloadValue = request.nextUrl.searchParams.get("payload");
  const accessTokenFromQuery = request.nextUrl.searchParams.get("accessToken");

  if (!env.hasSupabaseConfig || !env.hasApiConfig) {
    return fallbackStream({ error: "LLM_UNAVAILABLE", message: "Try again in a moment" });
  }

  if (!payloadValue) {
    return new Response(JSON.stringify({ error: "MISSING_PAYLOAD" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  const payload = deserializeChatStreamPayload(payloadValue);

  if (!payload) {
    return new Response(JSON.stringify({ error: "INVALID_PAYLOAD" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }

  let accessToken = accessTokenFromQuery;

  if (!accessToken) {
    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          return undefined;
        }
      }
    });

    const { data } = await supabase.auth.getSession();
    accessToken = data.session?.access_token;
  }

  if (!accessToken) {
    return fallbackStream({ error: "AUTHENTICATION_REQUIRED", message: "Try again in a moment" });
  }

  const response = await fetch(`${env.apiUrl}/locations/${payload.locationId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      message: payload.message,
      conversation_id: payload.conversationId,
      conversation_history: payload.conversationHistory
    })
  });

  if (!response.ok || !response.body) {
    return fallbackStream({ error: "LLM_UNAVAILABLE", message: "Try again in a moment" });
  }

  const reader = response.body.getReader();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: streamHeaders()
  });
}

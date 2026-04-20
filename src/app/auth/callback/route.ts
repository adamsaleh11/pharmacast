import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

function getSafeNextPath(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }

  return next;
}

export async function GET(request: NextRequest) {
  const env = getPublicEnv();
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = getSafeNextPath(request);
  redirectUrl.search = "";

  if (!env.hasSupabaseConfig) {
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("error", "supabase_not_configured");
    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.redirect(redirectUrl);
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirectUrl.pathname = "/login";
      redirectUrl.search = "";
      redirectUrl.searchParams.set("error", "auth_callback_failed");
      response = NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

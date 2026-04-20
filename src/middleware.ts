import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env";

const publicRoutes = new Set(["/login", "/onboarding", "/reset-password", "/auth/callback"]);

function isPublicRoute(pathname: string) {
  return publicRoutes.has(pathname);
}

function redirectToLogin(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";

  if (request.nextUrl.pathname !== "/") {
    redirectUrl.searchParams.set("redirectTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }

  return NextResponse.redirect(redirectUrl);
}

export async function middleware(request: NextRequest) {
  const env = getPublicEnv();
  const pathname = request.nextUrl.pathname;

  if (!env.hasSupabaseConfig) {
    return isPublicRoute(pathname) ? NextResponse.next() : redirectToLogin(request);
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute(pathname)) {
    return redirectToLogin(request);
  }

  if (user && pathname === "/login") {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};

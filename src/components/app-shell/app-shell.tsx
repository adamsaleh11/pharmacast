"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bell, Building2, LogOut, MapPin, Menu, Pill } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { productNavigation } from "@/components/app-shell/navigation";
import { acknowledgeBackendLogout } from "@/lib/api/auth";
import { setChatSidebarSlot } from "@/lib/chat-sidebar-slot";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/providers/app-context";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { authError, authReady, user, organization, currentLocation } = useAppContext();
  const isChatRoute = pathname === "/chat";
  const organizationName = organization?.name ?? "Organization";
  const locationName = currentLocation?.name ?? "Location";
  const userLabel = user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : "User";
  const fallback = user?.email ? user.email.slice(0, 2).toUpperCase() : "PF";

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    const accessToken = (await supabase?.auth.getSession())?.data.session?.access_token;

    await supabase?.auth.signOut();
    await acknowledgeBackendLogout(accessToken).catch(() => undefined);
    window.location.assign("/login");
  }

  useEffect(() => {
    if (authReady && authError === "USER_PROFILE_NOT_BOOTSTRAPPED") {
      router.replace("/onboarding");
    }
  }, [authError, authReady, router]);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-primary text-white lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-pharma-teal">
            <Pill className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold">PharmaCast</span>
            <span className="block text-xs text-white/60">Inventory intelligence</span>
          </span>
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <nav aria-label="Primary navigation" className="space-y-1 px-3 py-4">
            {productNavigation.map((item) => {
              const active = pathname === item.href;
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
          </nav>
          {isChatRoute ? <div ref={setChatSidebarSlot} className="border-t border-white/10 px-3 py-4" /> : null}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Button className="lg:hidden" variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:flex">
              <Building2 className="h-4 w-4 text-pharma-teal" aria-hidden="true" />
              {organizationName}
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:flex">
              <MapPin className="h-4 w-4 text-pharma-teal" aria-hidden="true" />
              {locationName}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
              <Avatar>
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-slate-700 sm:inline">{userLabel}</span>
              <Button className="hidden h-7 w-7 sm:inline-flex" variant="ghost" size="icon" aria-label="Sign out" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </header>

        <nav aria-label="Mobile navigation" className="grid grid-cols-5 border-b border-slate-200 bg-white lg:hidden">
          {productNavigation.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                  active && "text-pharma-teal"
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <main className={cn("mx-auto w-full max-w-7xl px-4 py-6 lg:px-6", isChatRoute && "max-w-none px-0 py-0 lg:px-0")}>{children}</main>
      </div>
    </div>
  );
}

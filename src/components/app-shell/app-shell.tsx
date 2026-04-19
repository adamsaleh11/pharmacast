"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, LogOut, MapPin, Menu, Pill } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { productNavigation } from "@/components/app-shell/navigation";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-primary text-white lg:flex lg:flex-col">
        <Link href="/dashboard" className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-pharma-teal">
            <Pill className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold">PharmaForecast</span>
            <span className="block text-xs text-white/60">Inventory intelligence</span>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-3 py-4">
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
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Button className="lg:hidden" variant="ghost" size="icon" aria-label="Open navigation">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:flex">
              <Building2 className="h-4 w-4 text-pharma-teal" aria-hidden="true" />
              Ottawa Independent Pharmacy
            </div>
            <div className="hidden items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 md:flex">
              <MapPin className="h-4 w-4 text-pharma-teal" aria-hidden="true" />
              Bank Street
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
              <Avatar>
                <AvatarFallback>PF</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-slate-700 sm:inline">Owner</span>
              <LogOut className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
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

        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}

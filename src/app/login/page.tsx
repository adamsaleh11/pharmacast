import { Pill } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
            <Pill className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Sign in to PharmaForecast</h1>
            <p className="text-sm text-muted-foreground">Authentication will be connected in a later slice.</p>
          </div>
        </div>
        <form className="space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm" placeholder="pharmacist@example.ca" type="email" />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm" placeholder="Password" type="password" />
          </label>
          <Button className="w-full" type="button" variant="teal">
            Sign in
          </Button>
        </form>
      </section>
    </main>
  );
}

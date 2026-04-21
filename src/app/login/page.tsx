"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertCircle, MailCheck, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function getLoginErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed") || normalized.includes("not confirmed")) {
    return "Email not confirmed. Check your inbox before signing in.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  return "Unable to sign in. Try again in a moment.";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError(null);
    setSuccess(null);

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setIsSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setIsSubmitting(false);

    if (signInError) {
      const errorMessage = signInError.message;

      if (errorMessage.includes("rate limit") || errorMessage.includes("Too many requests")) {
        setError("Too many attempts. Please wait a moment and try again.");
        return;
      }

      setError(getLoginErrorMessage(errorMessage));
      return;
    }

    setSuccess("Signed in. Opening your dashboard.");
    router.push(searchParams.get("redirectTo") ?? "/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
            <Pill className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Sign in to PharmaCast</h1>
            <p className="text-sm text-muted-foreground">Access your pharmacy forecasting workspace.</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 flex gap-2 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-700" role="status">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{success}</span>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium" htmlFor="email">
            Email
            <input
              id="email"
              className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="pharmacist@example.ca"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium" htmlFor="password">
            Password
            <input
              id="password"
              className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <div className="flex items-center justify-end">
            <Link className="text-sm font-medium text-pharma-teal hover:underline" href="/reset-password">
              Forgot password?
            </Link>
          </div>
          <Button className="w-full" type="submit" variant="teal" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          New to PharmaCast?{" "}
          <span
            role="link"
            tabIndex={0}
            className="font-medium text-pharma-teal hover:underline cursor-pointer"
            onClick={async () => {
              const supabase = createSupabaseBrowserClient();
              await supabase?.auth.signOut();
              window.location.replace("/onboarding");
            }}
          >
            Create an account
          </span>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

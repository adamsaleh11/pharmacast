"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertCircle, MailCheck, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError(null);

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setIsSubmitting(true);
    const redirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}/login`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setIsSubmitting(false);

    if (resetError) {
      const errorMessage = resetError.message;

      if (errorMessage.includes("rate limit") || errorMessage.includes("Too many requests")) {
        setError("Too many attempts. Please wait a moment and try again.");
        return;
      }

      setError("Unable to send reset instructions. Try again in a moment.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
            <Pill className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Reset password</h1>
            <p className="text-sm text-muted-foreground">Receive a secure recovery link by email.</p>
          </div>
        </div>

        {sent ? (
          <div className="rounded-md border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800" role="status">
            <div className="flex gap-2">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p>If an account exists for that email, reset instructions will arrive shortly.</p>
            </div>
            <Button className="mt-4 w-full" asChild variant="outline">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium" htmlFor="reset-email">
                Email
                <input
                  id="reset-email"
                  className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="owner@example.ca"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <Button className="w-full" type="submit" variant="teal" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

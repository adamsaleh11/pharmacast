"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bootstrapFirstOwner, getCurrentAuthUser, ApiError } from "@/lib/api/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBackendAccessToken } from "@/lib/supabase/session";
import type { SignupBootstrapMetadata } from "@/types/auth";

const SIGNUP_COOLDOWN_MS = 60 * 1000;
const SIGNUP_IDEMPOTENCY_KEY = "pharmacast_signup_idempotency";
const LAST_SIGNUP_ATTEMPT_KEY = "pharmacast_last_signup_attempt";
const BACKEND_AUTH_REJECTION_MESSAGE =
  "Your Supabase session is active, but the backend could not verify it yet. Ask the backend engineer to enable Supabase JWT validation for onboarding.";

function getSignupIdempotencyKey(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const stored = localStorage.getItem(SIGNUP_IDEMPOTENCY_KEY);
  if (stored) return stored;
  const key = crypto.randomUUID();
  localStorage.setItem(SIGNUP_IDEMPOTENCY_KEY, key);
  return key;
}

function getSignupCooldownRemaining(): number {
  if (typeof window === "undefined") return 0;
  const lastAttempt = localStorage.getItem(LAST_SIGNUP_ATTEMPT_KEY);
  if (!lastAttempt) return 0;
  const elapsed = Date.now() - parseInt(lastAttempt, 10);
  return elapsed < SIGNUP_COOLDOWN_MS ? SIGNUP_COOLDOWN_MS - elapsed : 0;
}

function recordSignupAttempt(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_SIGNUP_ATTEMPT_KEY, Date.now().toString());
}

function clearSignupAttemptState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LAST_SIGNUP_ATTEMPT_KEY);
  localStorage.removeItem(SIGNUP_IDEMPOTENCY_KEY);
}

function getSignupRedirectUrl(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", "/onboarding");
  return callbackUrl.toString();
}

function openDashboard() {
  if (typeof window === "undefined") return;
  window.location.replace("/dashboard");
}

type OnboardingStep = 1 | 2 | 3;

const steps: { id: OnboardingStep; label: string }[] = [
  { id: 1, label: "Account" },
  { id: 2, label: "Location" },
  { id: 3, label: "CSV" }
];

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmationRequired, setConfirmationRequired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [hasExistingSession, setHasExistingSession] = useState(false);

  useEffect(() => {
    const checkCooldown = () => setCooldownRemaining(getSignupCooldownRemaining());
    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      setHasExistingSession(Boolean(session));

      const metadata = session?.user?.user_metadata as Partial<SignupBootstrapMetadata> | undefined;
      if (metadata) {
        setPharmacyName((current) => current || metadata.organization_name || "");
        setLocationName((current) => current || metadata.location_name || "");
        setLocationAddress((current) => current || metadata.location_address || "");
      }

      if (!session?.access_token) return;

      try {
        const profile = await getCurrentAuthUser(session.access_token);
        if (profile.organization_id) {
          openDashboard();
        }
      } catch (profileError) {
        if (profileError instanceof ApiError && profileError.code === "USER_PROFILE_NOT_BOOTSTRAPPED") {
          return;
        }
      }
    });
  }, []);

  async function completeBootstrap(
    supabase: NonNullable<ReturnType<typeof createSupabaseBrowserClient>>,
    metadata: SignupBootstrapMetadata,
    label: string
  ) {
    try {
      const accessToken = await getBackendAccessToken(supabase, label);
      if (!accessToken) {
        throw new Error("No Supabase session access token. Please sign in again.");
      }

      await bootstrapFirstOwner(accessToken, metadata);
    } catch (bootstrapError) {
      if (bootstrapError instanceof ApiError && bootstrapError.status === 401) {
        const { data } = await supabase.auth.refreshSession();
        if (data.session?.access_token) {
          try {
            await bootstrapFirstOwner(data.session.access_token, metadata);
            return;
          } catch (retryError) {
            bootstrapError = retryError;
          }
        }
      }

      if (bootstrapError instanceof ApiError && bootstrapError.status === 400) {
        if (bootstrapError.code === "USER_ALREADY_BOOTSTRAPPED") {
          return;
        }
        throw new Error("Check the pharmacy and location details before continuing.");
      }

      if (bootstrapError instanceof ApiError && bootstrapError.status === 401) {
        throw new Error(BACKEND_AUTH_REJECTION_MESSAGE);
      }

      throw new Error("Unable to finish pharmacy setup. Try again in a moment.");
    }
  }

  function validateStep(nextStep: OnboardingStep) {
    setError(null);

    if (step === 1 && (!email.trim() || !password.trim() || !pharmacyName.trim())) {
      setError("Add your email, password, and pharmacy name.");
      return;
    }

    if (step === 2 && (!locationName.trim() || !locationAddress.trim())) {
      setError("Add the first location name and address.");
      return;
    }

    setStep(nextStep);
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    setError(null);

    if (!locationName.trim() || !locationAddress.trim()) {
      setError("Add the first location name and address.");
      setStep(2);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    const metadata: SignupBootstrapMetadata = {
      organization_name: pharmacyName.trim(),
      location_name: locationName.trim(),
      location_address: locationAddress.trim()
    };

    setIsSubmitting(true);

    const existingSession = await supabase.auth.getSession();

    if (existingSession.data.session?.access_token) {
      try {
        await completeBootstrap(supabase, metadata, "auth/bootstrap existing session");
        clearSignupAttemptState();
        openDashboard();
      } catch (bootstrapError) {
        setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to finish pharmacy setup.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const cooldown = getSignupCooldownRemaining();
    if (cooldown > 0) {
      setIsSubmitting(false);
      setError(`Please wait ${Math.ceil(cooldown / 1000)} seconds before trying again.`);
      return;
    }

    recordSignupAttempt();
    const idempotencyKey = getSignupIdempotencyKey();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { ...metadata, idempotencyKey },
        emailRedirectTo: getSignupRedirectUrl()
      }
    });

    if (signUpError) {
      setIsSubmitting(false);

      const errorMessage = signUpError.message;

      if (errorMessage.includes("rate limit") || errorMessage.includes("over_email_send_rate_limit")) {
        setError("Too many attempts. Please wait a moment and try again.");
        return;
      }

      if (errorMessage.includes("invalid") || errorMessage.includes("Invalid")) {
        setError("Please enter a valid email address.");
        return;
      }

      if (errorMessage.includes("already registered")) {
        setError("An account already exists for that email.");
        return;
      }

      setError("Unable to create account. Try again in a moment.");
      return;
    }

    if (!data.session) {
      setIsSubmitting(false);
      setConfirmationRequired(true);
      return;
    }

    try {
      await completeBootstrap(supabase, metadata, "auth/bootstrap after signup");
      clearSignupAttemptState();
      openDashboard();
    } catch (bootstrapError) {
      if (bootstrapError instanceof ApiError && bootstrapError.status === 401) {
        setError(BACKEND_AUTH_REJECTION_MESSAGE);
        return;
      }
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to finish pharmacy setup.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignInNavigation() {
    const supabase = createSupabaseBrowserClient();
    await supabase?.auth.signOut();
    window.location.assign("/login");
  }

  if (confirmationRequired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <section className="w-full max-w-lg rounded-lg border border-border bg-white p-6 shadow-sm">
          <div className="flex gap-3 rounded-md border border-teal-200 bg-teal-50 p-4 text-teal-800" role="status">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold">Confirm your email</h1>
              <p className="mt-1 text-sm">Check your inbox to confirm your account before signing in.</p>
              <Button className="mt-4" asChild variant="outline">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-2xl rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-white">
            <Pill className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Create your PharmaCast account</h1>
            <p className="text-sm text-muted-foreground">Set up your pharmacy and first operating location.</p>
          </div>
        </div>

        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Onboarding progress">
          {steps.map((item) => (
            <li
              key={item.id}
              className={`rounded-md border px-3 py-2 text-center text-sm font-medium ${
                item.id === step ? "border-pharma-teal bg-teal-50 text-teal-700" : "border-border bg-slate-50 text-muted-foreground"
              }`}
            >
              {item.label}
            </li>
          ))}
        </ol>

        {error ? (
          <div className="mb-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {step === 1 ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              validateStep(2);
            }}
          >
            <label className="block text-sm font-medium" htmlFor="signup-email">
              Email
              <input
                id="signup-email"
                className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="owner@example.ca"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="signup-password">
              Password
              <input
                id="signup-password"
                className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Create a password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="pharmacy-name">
              Pharmacy name
              <input
                id="pharmacy-name"
                className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ottawa Independent Pharmacy"
                type="text"
                value={pharmacyName}
                onChange={(event) => setPharmacyName(event.target.value)}
                required
              />
            </label>
            <Button className="w-full" type="submit" variant="teal">
              Continue
            </Button>
          </form>
        ) : null}

        {step === 2 ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              validateStep(3);
            }}
          >
            <label className="block text-sm font-medium" htmlFor="location-name">
              First location name
              <input
                id="location-name"
                className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Bank Street"
                type="text"
                value={locationName}
                onChange={(event) => setLocationName(event.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-medium" htmlFor="location-address">
              First location address
              <input
                id="location-address"
                className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="100 Bank St, Ottawa, ON"
                type="text"
                value={locationAddress}
                onChange={(event) => setLocationAddress(event.target.value)}
                required
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="sm:w-auto" type="button" variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button className="flex-1" type="submit" variant="teal">
                Continue
              </Button>
            </div>
          </form>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <FileUp className="mx-auto h-8 w-8 text-pharma-teal" aria-hidden="true" />
              <h2 className="mt-3 text-base font-semibold">CSV upload</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Dispensing history upload will be available after account setup.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="sm:w-auto" type="button" variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                className="flex-1"
                type="button"
                variant="teal"
                onClick={handleSubmit}
                disabled={isSubmitting || (!hasExistingSession && cooldownRemaining > 0)}
              >
                {isSubmitting ? "Creating account..." : !hasExistingSession && cooldownRemaining > 0 ? "Please wait..." : "Skip CSV and finish"}
              </Button>
            </div>
          </div>
        ) : null}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <button className="font-medium text-pharma-teal hover:underline" type="button" onClick={handleSignInNavigation}>
            Sign in
          </button>
        </p>
      </section>
    </main>
  );
}

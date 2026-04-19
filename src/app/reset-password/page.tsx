import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Password reset delivery is not implemented yet.</p>
        <form className="mt-6 space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input className="mt-1 h-10 w-full rounded-md border border-input px-3 text-sm" placeholder="owner@example.ca" type="email" />
          </label>
          <Button className="w-full" type="button" variant="teal">
            Send reset link
          </Button>
        </form>
      </section>
    </main>
  );
}

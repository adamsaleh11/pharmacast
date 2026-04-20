import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./login/page";
import OnboardingPage from "./onboarding/page";
import ResetPasswordPage from "./reset-password/page";
import { bootstrapFirstOwner, getCurrentAuthUser } from "@/lib/api/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh
  }),
  useSearchParams: () => new URLSearchParams()
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: vi.fn()
}));

vi.mock("@/lib/api/auth", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly code?: string
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
  bootstrapFirstOwner: vi.fn(),
  getCurrentAuthUser: vi.fn()
}));

const mockCreateSupabaseBrowserClient = vi.mocked(createSupabaseBrowserClient);
const mockBootstrapFirstOwner = vi.mocked(bootstrapFirstOwner);
const mockGetCurrentAuthUser = vi.mocked(getCurrentAuthUser);

describe("auth pages", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockReset();
    refresh.mockReset();
    mockCreateSupabaseBrowserClient.mockReset();
    mockBootstrapFirstOwner.mockReset();
    mockGetCurrentAuthUser.mockReset();
    mockGetCurrentAuthUser.mockRejectedValue({ code: "USER_PROFILE_NOT_BOOTSTRAPPED" });
  });

  it("shows invalid credentials on failed login", async () => {
    mockCreateSupabaseBrowserClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: "Invalid login credentials" }
        })
      }
    } as never);

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText("Email"), "owner@example.ca");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(push).not.toHaveBeenCalled();
  });

  it("passes backend bootstrap metadata during onboarding signup", async () => {
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: { access_token: "token" } } });
    const signUp = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null
    });
    mockBootstrapFirstOwner.mockResolvedValue({
      organization_id: "organization-1",
      location_id: "location-1",
      user_id: "user-1"
    });
    mockCreateSupabaseBrowserClient.mockReturnValue({
      auth: {
        getSession,
        refreshSession: vi.fn(),
        signUp
      }
    } as never);

    render(<OnboardingPage />);

    await userEvent.type(screen.getByLabelText("Email"), "owner@example.ca");
    await userEvent.type(screen.getByLabelText("Password"), "secure-password");
    await userEvent.type(screen.getByLabelText("Pharmacy name"), "Ottawa Independent Pharmacy");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await userEvent.type(screen.getByLabelText("First location name"), "Bank Street");
    await userEvent.type(screen.getByLabelText("First location address"), "100 Bank St, Ottawa, ON");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await userEvent.click(screen.getByRole("button", { name: "Skip CSV and finish" }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "owner@example.ca",
          password: "secure-password",
          options: expect.objectContaining({
            data: {
              idempotencyKey: expect.any(String),
              organization_name: "Ottawa Independent Pharmacy",
              location_name: "Bank Street",
              location_address: "100 Bank St, Ottawa, ON"
            }
          })
        })
      )
    );
    expect(mockBootstrapFirstOwner).toHaveBeenCalledWith("token", {
      organization_name: "Ottawa Independent Pharmacy",
      location_name: "Bank Street",
      location_address: "100 Bank St, Ottawa, ON"
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("bootstraps an existing signed-in onboarding session without creating another Supabase user", async () => {
    const signUp = vi.fn();
    mockBootstrapFirstOwner.mockResolvedValue({
      organization_id: "organization-1",
      location_id: "location-1",
      user_id: "user-1"
    });
    mockCreateSupabaseBrowserClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "existing-token"
            }
          }
        }),
        refreshSession: vi.fn(),
        signUp
      }
    } as never);

    render(<OnboardingPage />);

    await userEvent.type(screen.getByLabelText("Email"), "owner@example.ca");
    await userEvent.type(screen.getByLabelText("Password"), "secure-password");
    await userEvent.type(screen.getByLabelText("Pharmacy name"), "Ottawa Independent Pharmacy");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    await userEvent.type(screen.getByLabelText("First location name"), "Bank Street");
    await userEvent.type(screen.getByLabelText("First location address"), "100 Bank St, Ottawa, ON");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(screen.getByRole("button", { name: "Skip CSV and finish" }));

    await waitFor(() =>
      expect(mockBootstrapFirstOwner).toHaveBeenCalledWith("existing-token", {
        organization_name: "Ottawa Independent Pharmacy",
        location_name: "Bank Street",
        location_address: "100 Bank St, Ottawa, ON"
      })
    );
    expect(signUp).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a success confirmation after requesting a password reset", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    mockCreateSupabaseBrowserClient.mockReturnValue({
      auth: {
        resetPasswordForEmail
      }
    } as never);

    render(<ResetPasswordPage />);

    await userEvent.type(screen.getByLabelText("Email"), "owner@example.ca");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("status")).toHaveTextContent("reset instructions will arrive shortly");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("owner@example.ca", expect.any(Object));
  });
});

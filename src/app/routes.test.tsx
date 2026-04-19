import { render, screen } from "@testing-library/react";
import OverviewPage from "./(app)/overview/page";
import ChatPage from "./(app)/chat/page";
import InsightsPage from "./(app)/insights/page";
import SettingsPage from "./(app)/settings/page";
import LoginPage from "./login/page";
import ResetPasswordPage from "./reset-password/page";
import OnboardingPage from "./onboarding/page";

describe("route stubs", () => {
  it("renders product page surfaces without live API calls", () => {
    render(
      <div>
        <OverviewPage />
        <ChatPage />
        <InsightsPage />
        <SettingsPage />
      </div>
    );

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chat" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Insights" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
  });

  it("renders plain auth-era pages without requiring authentication", () => {
    render(
      <div>
        <LoginPage />
        <ResetPasswordPage />
        <OnboardingPage />
      </div>
    );

    expect(screen.getByRole("heading", { name: "Sign in to PharmaForecast" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reset password" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Onboarding" })).toBeInTheDocument();
  });
});

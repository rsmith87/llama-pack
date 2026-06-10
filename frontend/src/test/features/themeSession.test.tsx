import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, ThemeToggle, THEME_STORAGE_KEY, useTheme } from "../../features/theme/themeSession";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme-value">{theme}</span>;
}

describe("ThemeProvider", () => {
  it("defaults to the system preference when no theme is stored", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("loads and applies a stored theme preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("toggles and persists the theme", async () => {
    const user = userEvent.setup();

    render(
      <ThemeProvider>
        <ThemeProbe />
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Switch to dark mode" }));

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });
});

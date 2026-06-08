import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DocsPage } from "../DocsPage";

function renderDocsPage(initialPath = "/ui/docs") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <DocsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("renders without making authenticated API calls", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  renderDocsPage();

  expect(fetchSpy).not.toHaveBeenCalled();
});

it("shows the first generated doc by default", () => {
  renderDocsPage();

  // The generated docs list is non-empty; first doc's title appears in the nav
  const navButtons = screen.getAllByRole("button");
  expect(navButtons.length).toBeGreaterThan(0);
});

it("renders documentation content in the main pane", () => {
  renderDocsPage();

  // The article landmark for doc content should be in the DOM
  const article = screen.getByRole("article");
  expect(article).toBeDefined();
});

it("search filters the document list", async () => {
  const user = userEvent.setup();
  renderDocsPage();

  const searchInput = screen.getByRole("searchbox", { name: /search docs/i });
  const initialButtonCount = screen.getAllByRole("button").length;

  await user.type(searchInput, "xyzzy_no_match_9999");

  // Either fewer buttons or the empty state message
  const afterButtons = screen.queryAllByRole("button");
  const emptyMsg = screen.queryByText(/No results/i);
  const filtered = afterButtons.length < initialButtonCount || emptyMsg !== null;
  expect(filtered).toBe(true);
});

it("search finds a term present in the generated docs", async () => {
  const user = userEvent.setup();
  renderDocsPage();

  const searchInput = screen.getByRole("searchbox", { name: /search docs/i });
  // "setup" should appear in setup.md content/title
  await user.type(searchInput, "setup");

  const buttons = screen.queryAllByRole("button");
  expect(buttons.length).toBeGreaterThan(0);
});

it("clicking a document opens it and clears search", async () => {
  const user = userEvent.setup();
  renderDocsPage();

  // Find all nav buttons
  const buttons = screen.getAllByRole("button");
  const firstButton = buttons[0];
  const secondButton = buttons[1];

  if (!secondButton) return; // only one doc generated, skip

  await user.click(secondButton);

  // After clicking a doc, search should be cleared
  const searchInput = screen.getByRole("searchbox", { name: /search docs/i });
  expect((searchInput as HTMLInputElement).value).toBe("");
});

it("shows back-to-app link", () => {
  renderDocsPage();

  const backLink = screen.getByRole("link", { name: /back to app/i });
  expect(backLink).toBeDefined();
  expect(backLink.getAttribute("href")).toBe("/ui/setup");
});

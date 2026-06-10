import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DataTable, EmptyState, ErrorBanner, Modal, Panel, StatusBadge } from ".";

describe("shared UI primitives", () => {
  it("renders panel title, eyebrow, actions, and children", () => {
    render(<Panel eyebrow="Ops" title="System" actions={<button>Refresh</button>}>Body</Panel>);

    expect(screen.getByText("Ops")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("renders empty and error states", () => {
    const { rerender } = render(<ErrorBanner />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    rerender(<ErrorBanner message="Failed" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");

    render(<EmptyState message="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("maps status badge tones to classes", () => {
    render(<StatusBadge tone="danger">offline</StatusBadge>);

    expect(screen.getByText("offline")).toHaveClass("status-badge", "status-badge-danger");
  });

  it("renders data table rows and empty state", () => {
    const columns = [{ key: "name", header: "Name", render: (row: { name: string }) => row.name }];
    const { rerender } = render(<DataTable columns={columns} rows={[]} emptyMessage="No rows" getRowKey={(row) => row.name} />);

    expect(screen.getByText("No rows")).toBeInTheDocument();

    rerender(<DataTable columns={columns} rows={[{ name: "mac" }]} emptyMessage="No rows" getRowKey={(row) => row.name} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "mac" })).toBeInTheDocument();
  });

  it("handles modal close action", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<Modal title="Logs" open onClose={onClose}>content</Modal>);
    await user.click(screen.getByRole("button", { name: "Close Logs" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addWorkspaceMember,
  changeWorkspaceMemberRole,
  listWorkspaceMembers,
  removeWorkspaceMember,
} from "../api";
import type { WorkspaceRole } from "../types";
import { WorkspaceMembers } from "./WorkspaceMembers";

vi.mock("../api", () => ({
  addWorkspaceMember: vi.fn(),
  changeWorkspaceMemberRole: vi.fn(),
  listWorkspaceMembers: vi.fn(),
  removeWorkspaceMember: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const members = [
  { userId: "owner-1", email: "owner@example.test", role: "OWNER" as const, joinedAt: "", updatedAt: "" },
  { userId: "member-1", email: "member@example.test", role: "MEMBER" as const, joinedAt: "", updatedAt: "" },
  { userId: "orphan-1", email: null, role: "MEMBER" as const, joinedAt: "", updatedAt: "" },
];

function renderMembers(actorRole: WorkspaceRole) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WorkspaceMembers actorRole={actorRole} workspaceId="workspace-1" />
    </QueryClientProvider>,
  );
}

describe("WorkspaceMembers", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listWorkspaceMembers).mockResolvedValue(members);
    vi.mocked(addWorkspaceMember).mockResolvedValue();
    vi.mocked(changeWorkspaceMemberRole).mockResolvedValue();
    vi.mocked(removeWorkspaceMember).mockResolvedValue();
  });

  it("lets an owner add a member by email and refreshes the list", async () => {
    renderMembers("OWNER");
    await screen.findByText("member@example.test");
    expect(screen.getByText("orphan-1")).toBeInTheDocument();
    expect(within(screen.getByRole("combobox", { name: "New member role" })).getByRole("option", { name: "OWNER" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Member email" }), { target: { value: " new@example.test " } });
    fireEvent.change(screen.getByRole("combobox", { name: "New member role" }), { target: { value: "ADMIN" } });
    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() =>
      expect(addWorkspaceMember).toHaveBeenCalledWith("workspace-1", { email: "new@example.test", role: "ADMIN" }),
    );
    await waitFor(() => expect(listWorkspaceMembers).toHaveBeenCalledTimes(2));
  });

  it("keeps owner memberships out of an admin's reach", async () => {
    renderMembers("ADMIN");
    await screen.findByText("member@example.test");

    expect(within(screen.getByRole("combobox", { name: "New member role" })).queryByRole("option", { name: "OWNER" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Role for owner@example.test" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Role for member@example.test" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
  });

  it("shows a read-only list to a member", async () => {
    renderMembers("MEMBER");
    await screen.findByText("member@example.test");

    expect(screen.queryByRole("textbox", { name: "Member email" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("changes a role and removes a member only after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm");
    renderMembers("OWNER");
    await screen.findByText("member@example.test");

    fireEvent.change(screen.getByRole("combobox", { name: "Role for member@example.test" }), { target: { value: "ADMIN" } });
    await waitFor(() => expect(changeWorkspaceMemberRole).toHaveBeenCalledWith("workspace-1", "member-1", "ADMIN"));

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    confirm.mockReturnValueOnce(false);
    fireEvent.click(removeButtons[1]);
    expect(removeWorkspaceMember).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    fireEvent.click(removeButtons[1]);
    await waitFor(() => expect(removeWorkspaceMember).toHaveBeenCalledWith("workspace-1", "member-1"));
    confirm.mockRestore();
  });

  it("reports a failed addition", async () => {
    vi.mocked(addWorkspaceMember).mockRejectedValue(new Error("network"));
    renderMembers("OWNER");
    await screen.findByText("member@example.test");

    fireEvent.change(screen.getByRole("textbox", { name: "Member email" }), { target: { value: "nobody@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: /add member/i }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Could not add member"));
  });
});

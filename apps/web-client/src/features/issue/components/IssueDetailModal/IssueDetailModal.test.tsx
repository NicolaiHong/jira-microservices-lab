import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  updateIssue: vi.fn(),
  assignIssue: vi.fn(),
}));

vi.mock("../../api", () => ({
  updateIssue: apiMocks.updateIssue,
  assignIssue: apiMocks.assignIssue,
  getIssueErrorCode: () => undefined,
  isConcurrentIssueModification: () => false,
}));

vi.mock("../../hooks/useIssue", () => ({
  useComments: () => ({ data: [] }),
  useHistory: () => ({ data: [] }),
  useAddComment: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { IssueDetailModal } from "./IssueDetailModal";

const issue = {
  id: "issue-1",
  projectId: "project-1",
  number: 1,
  key: "CORE-1",
  summary: "Original summary",
  description: "Original description",
  type: "TASK" as const,
  priority: "MEDIUM" as const,
  status: "TODO" as const,
  reporterUserId: "reporter-1",
  assigneeUserId: null,
  epicId: null,
  sprintId: null,
  version: 7,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

function renderDetails(isProjectWritable = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <IssueDetailModal
        isProjectWritable={isProjectWritable}
        issue={issue}
        issueId={issue.id}
      />
    </QueryClientProvider>,
  );
}

describe("Issue details mutations", () => {
  afterEach(cleanup);

  beforeEach(() => {
    apiMocks.updateIssue.mockReset();
    apiMocks.assignIssue.mockReset();
    apiMocks.updateIssue.mockResolvedValue(issue);
    apiMocks.assignIssue.mockResolvedValue(issue);
  });

  it("uses the issue version currently rendered for details and assignment", async () => {
    const { container } = renderDetails();
    fireEvent.change(screen.getByDisplayValue("Original summary"), {
      target: { value: "Edited summary" },
    });
    fireEvent.submit(container.querySelectorAll("form")[0]);
    await waitFor(() => {
      expect(apiMocks.updateIssue).toHaveBeenCalledWith(
        "issue-1",
        {
          summary: "Edited summary",
          description: "Original description",
          type: "TASK",
          priority: "MEDIUM",
        },
        7,
      );
    });

    fireEvent.change(screen.getByPlaceholderText("Member UUID; empty to unassign"), {
      target: { value: "member-2" },
    });
    fireEvent.submit(container.querySelectorAll("form")[2]);
    await waitFor(() => {
      expect(apiMocks.assignIssue).toHaveBeenCalledWith("issue-1", "member-2", 7);
    });
  });

  it("keeps details, comments, and history readable while disabling archived-project writes", () => {
    const { container } = renderDetails(false);

    expect(screen.getByText("Original summary")).toBeInTheDocument();
    expect(screen.getByText("Comments")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Original summary")).toBeDisabled();
    expect(
      screen.getByPlaceholderText("Member UUID; empty to unassign"),
    ).toBeDisabled();
    expect(screen.getByPlaceholderText("Write a comment")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save issue" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Update assignee" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();

    fireEvent.submit(container.querySelectorAll("form")[0]);
    fireEvent.submit(container.querySelectorAll("form")[2]);

    expect(apiMocks.updateIssue).not.toHaveBeenCalled();
    expect(apiMocks.assignIssue).not.toHaveBeenCalled();
  });
});

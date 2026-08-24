import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  updateIssue: vi.fn(),
  assignIssue: vi.fn(),
  isConcurrentIssueModification: vi.fn(),
}));

vi.mock("../../api", () => ({
  updateIssue: apiMocks.updateIssue,
  assignIssue: apiMocks.assignIssue,
  getIssueErrorCode: () => undefined,
  isConcurrentIssueModification: apiMocks.isConcurrentIssueModification,
}));

const commentMocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock("../../hooks/useIssue", () => ({
  useComments: () => ({ data: [] }),
  useHistory: () => ({ data: [] }),
  useAddComment: () => ({ isPending: false, mutateAsync: commentMocks.mutateAsync }),
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
    apiMocks.isConcurrentIssueModification.mockReset();
    apiMocks.isConcurrentIssueModification.mockReturnValue(false);
    commentMocks.mutateAsync.mockReset();
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

  it("trims valid comment input and rejects whitespace-only comments locally", async () => {
    const { container } = renderDetails();
    const commentInput = screen.getByPlaceholderText("Write a comment");

    fireEvent.change(commentInput, { target: { value: "  useful comment  " } });
    fireEvent.submit(container.querySelectorAll("form")[1]);

    await waitFor(() => {
      expect(commentMocks.mutateAsync).toHaveBeenCalledWith("useful comment");
    });

    commentMocks.mutateAsync.mockClear();
    fireEvent.change(commentInput, { target: { value: " \t\n " } });
    fireEvent.submit(container.querySelectorAll("form")[1]);

    expect(commentMocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("clears the input only after success, keeping a conflicted comment for the user", async () => {
    const { container } = renderDetails();
    const commentInput = screen.getByPlaceholderText("Write a comment");
    commentMocks.mutateAsync.mockRejectedValueOnce({
      response: { data: { code: "CONCURRENT_ISSUE_MODIFICATION" } },
    });
    apiMocks.isConcurrentIssueModification.mockReturnValue(true);

    fireEvent.change(commentInput, { target: { value: "Keep this comment" } });
    fireEvent.submit(container.querySelectorAll("form")[1]);

    await waitFor(() => {
      expect(commentMocks.mutateAsync).toHaveBeenCalledWith("Keep this comment");
    });
    expect(commentInput).toHaveValue("Keep this comment");

    commentMocks.mutateAsync.mockResolvedValueOnce({ id: "comment-1" });
    apiMocks.isConcurrentIssueModification.mockReturnValue(false);
    fireEvent.submit(container.querySelectorAll("form")[1]);

    await waitFor(() => {
      expect(commentInput).toHaveValue("");
    });
  });

  it("limits comments to 5,000 characters", () => {
    renderDetails();

    expect(screen.getByPlaceholderText("Write a comment")).toHaveAttribute(
      "maxlength",
      "5000",
    );
  });
});

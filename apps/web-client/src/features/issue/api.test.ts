import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/http", () => ({
  http: {
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

import { http } from "@/lib/http";
import {
  addComment,
  assignIssue,
  createIssue,
  isConcurrentIssueModification,
  transitionIssue,
  updateIssue,
} from "./api";

const issue = {
  id: "issue-1",
  projectId: "project-1",
  number: 1,
  key: "CORE-1",
  summary: "Summary",
  description: null,
  type: "TASK" as const,
  priority: "MEDIUM" as const,
  status: "TODO" as const,
  reporterUserId: "reporter-1",
  assigneeUserId: null,
  epicId: null,
  sprintId: null,
  version: 2,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

describe("Issue Core API client", () => {
  beforeEach(() => {
    vi.mocked(http.patch).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.patch).mockResolvedValue({ data: { issue } });
    vi.mocked(http.post).mockResolvedValue({ data: { issue } });
  });

  it("preserves expectedVersion in details, assignment, and transition bodies", async () => {
    await updateIssue("issue-1", { summary: "Changed" }, 7);
    await assignIssue("issue-1", null, 8);
    await transitionIssue("issue-1", "IN_PROGRESS", 9);

    expect(http.patch).toHaveBeenNthCalledWith(1, "/api/issues/issue-1", {
      summary: "Changed",
      expectedVersion: 7,
    });
    expect(http.patch).toHaveBeenNthCalledWith(2, "/api/issues/issue-1/assignee", {
      assigneeUserId: null,
      expectedVersion: 8,
    });
    expect(http.post).toHaveBeenCalledWith("/api/issues/issue-1/transitions", {
      status: "IN_PROGRESS",
      expectedVersion: 9,
    });
  });

  it("returns a created issue and preserves create failures for the form to display", async () => {
    await expect(
      createIssue("project-1", {
        summary: "Created",
        type: "TASK",
        priority: "LOW",
      }),
    ).resolves.toEqual(issue);
    expect(http.post).toHaveBeenCalledWith("/api/projects/project-1/issues", {
      summary: "Created",
      type: "TASK",
      priority: "LOW",
    });

    vi.mocked(http.post).mockRejectedValueOnce(new Error("validation failed"));
    await expect(
      createIssue("project-1", {
        summary: "Rejected",
        type: "TASK",
        priority: "LOW",
      }),
    ).rejects.toThrow("validation failed");
  });

  it("posts a comment body unchanged after the form has validated and trimmed it", async () => {
    const comment = {
      id: "comment-1",
      issueId: "issue-1",
      authorUserId: "user-1",
      body: "A comment",
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    };
    vi.mocked(http.post).mockResolvedValueOnce({ data: { comment } });

    await expect(addComment("issue-1", "A comment")).resolves.toEqual(comment);
    expect(http.post).toHaveBeenCalledWith("/api/issues/issue-1/comments", {
      body: "A comment",
    });
  });

  it("recognizes only the documented concurrency conflict", () => {
    expect(
      isConcurrentIssueModification({
        isAxiosError: true,
        response: { status: 409, data: { code: "CONCURRENT_ISSUE_MODIFICATION" } },
      }),
    ).toBe(true);
    expect(
      isConcurrentIssueModification({
        isAxiosError: true,
        response: { status: 409, data: { code: "PROJECT_ARCHIVED" } },
      }),
    ).toBe(false);
  });
});

import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const issueApi = vi.hoisted(() => ({
  addComment: vi.fn(),
  isConcurrentIssueModification: vi.fn(),
}));

vi.mock("../api", () => ({
  addComment: issueApi.addComment,
  getIssue: vi.fn(),
  isConcurrentIssueModification: issueApi.isConcurrentIssueModification,
  listComments: vi.fn(),
  listHistory: vi.fn(),
}));

import { useAddComment } from "./useIssue";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: true },
      queries: { retry: false },
    },
  });
}

function wrapperFor(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("Comment mutation cache handling", () => {
  beforeEach(() => {
    issueApi.addComment.mockReset();
    issueApi.isConcurrentIssueModification.mockReset();
  });

  it("does not retry and refreshes issue, project list, comments, and history after success", async () => {
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    issueApi.addComment.mockResolvedValue({ id: "comment-1" });
    const { result } = renderHook(() => useAddComment("issue-1", "project-1"), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("A comment");
    });

    expect(issueApi.addComment).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["issues", "issue-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["issues", "project-1"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["issues", "issue-1", "comments"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["issues", "issue-1", "history"],
    });
  });

  it("does not repost a concurrency conflict and refreshes all affected data", async () => {
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const conflict = { code: "CONCURRENT_ISSUE_MODIFICATION" };
    issueApi.addComment.mockRejectedValue(conflict);
    issueApi.isConcurrentIssueModification.mockReturnValue(true);
    const { result } = renderHook(() => useAddComment("issue-1", "project-1"), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await expect(result.current.mutateAsync("Keep this draft")).rejects.toEqual(conflict);
    });

    expect(issueApi.addComment).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["issues", "issue-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["issues", "project-1"] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["issues", "issue-1", "comments"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["issues", "issue-1", "history"],
    });
  });
});

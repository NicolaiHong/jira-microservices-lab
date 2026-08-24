import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";

const issueApi = vi.hoisted(() => ({
  transitionIssue: vi.fn(),
}));

vi.mock("../api", () => ({
  completeSprint: vi.fn(),
  createEpic: vi.fn(),
  createIssue: vi.fn(),
  createSprint: vi.fn(),
  isConcurrentIssueModification: (error: unknown) =>
    (error as { code?: string })?.code === "CONCURRENT_ISSUE_MODIFICATION",
  listEpics: vi.fn(),
  listIssues: vi.fn(),
  listSprints: vi.fn(),
  transitionIssue: issueApi.transitionIssue,
}));

import { useTransitionIssue } from "./useIssues";

describe("Issue transition conflicts", () => {
  it("does not retry a 409 and refetches without overwriting the rendered query data", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const oldIssue = { id: "issue-1", version: 2, summary: "Current data" };
    queryClient.setQueryData(["issues", "project-1"], [oldIssue]);
    queryClient.setQueryData(["issues", "issue-1"], oldIssue);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    issueApi.transitionIssue.mockRejectedValueOnce({
      code: "CONCURRENT_ISSUE_MODIFICATION",
    });

    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useTransitionIssue("project-1"), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          issueId: "issue-1",
          status: "IN_PROGRESS",
          expectedVersion: 2,
        }),
      ).rejects.toEqual({ code: "CONCURRENT_ISSUE_MODIFICATION" });
    });

    expect(issueApi.transitionIssue).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["issues", "project-1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["issues", "issue-1"] });
    expect(queryClient.getQueryData(["issues", "issue-1"])).toEqual(oldIssue);
  });
});

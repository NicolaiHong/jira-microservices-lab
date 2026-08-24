import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const issueApi = vi.hoisted(() => ({
  getIssueErrorCode: vi.fn(),
  transitionIssue: vi.fn(),
}));

vi.mock("../api", () => ({
  completeSprint: vi.fn(),
  createEpic: vi.fn(),
  createIssue: vi.fn(),
  createSprint: vi.fn(),
  getIssueErrorCode: issueApi.getIssueErrorCode,
  listEpics: vi.fn(),
  listIssues: vi.fn(),
  listSprints: vi.fn(),
  transitionIssue: issueApi.transitionIssue,
}));

import { useTransitionIssue } from "./useIssues";

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
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("Issue transition cache handling", () => {
  beforeEach(() => {
    issueApi.getIssueErrorCode.mockReset();
    issueApi.transitionIssue.mockReset();
  });

  it("invalidates the list and detail query after a successful transition", async () => {
    const queryClient = makeQueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    issueApi.transitionIssue.mockResolvedValue({ id: "issue-1", version: 3 });
    const { result } = renderHook(() => useTransitionIssue("project-1"), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        issueId: "issue-1",
        status: "IN_PROGRESS",
        expectedVersion: 2,
      });
    });

    expect(issueApi.transitionIssue).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["issues", "project-1"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["issues", "issue-1"],
    });
  });

  it.each([
    "CONCURRENT_ISSUE_MODIFICATION",
    "INVALID_ISSUE_TRANSITION",
    "PROJECT_ARCHIVED",
    undefined,
  ])(
    "does not retry and refreshes issue data after a %s transition failure",
    async (code) => {
      const queryClient = makeQueryClient();
      const oldIssue = {
        id: "issue-1",
        status: "TODO",
        version: 2,
        summary: "Current data",
      };
      queryClient.setQueryData(["issues", "project-1"], [oldIssue]);
      queryClient.setQueryData(["issues", "issue-1"], oldIssue);
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const failure = { code };
      issueApi.getIssueErrorCode.mockReturnValue(code);
      issueApi.transitionIssue.mockRejectedValueOnce(failure);
      const { result } = renderHook(() => useTransitionIssue("project-1"), {
        wrapper: wrapperFor(queryClient),
      });

      await act(async () => {
        await expect(
          result.current.mutateAsync({
            issueId: "issue-1",
            status: "IN_PROGRESS",
            expectedVersion: 2,
          }),
        ).rejects.toEqual(failure);
      });

      expect(issueApi.transitionIssue).toHaveBeenCalledTimes(1);
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["issues", "project-1"],
      });
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: ["issues", "issue-1"],
      });
      expect(queryClient.getQueryData(["issues", "issue-1"])).toEqual(oldIssue);

      if (code === "PROJECT_ARCHIVED") {
        expect(invalidate).toHaveBeenCalledWith({
          queryKey: ["project", "project-1"],
        });
      } else {
        expect(invalidate).not.toHaveBeenCalledWith({
          queryKey: ["project", "project-1"],
        });
      }
    },
  );
});

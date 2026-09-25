import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

const projectApi = vi.hoisted(() => ({
  archiveProject: vi.fn(),
  createProject: vi.fn(),
  createWorkspace: vi.fn(),
  getProject: vi.fn(),
  listProjects: vi.fn(),
  listWorkspaces: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("../api", () => projectApi);

import { useManageProject, useProject } from "./useProjects";

describe("useProject", () => {
  it("uses the existing Project API and a project-specific React Query cache entry", async () => {
    const project = {
      id: "project-1",
      workspaceId: "workspace-1",
      name: "Archived project",
      key: "ARCH",
      description: null,
      status: "ARCHIVED" as const,
      createdByUserId: "user-1",
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    };
    projectApi.getProject.mockResolvedValue(project);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useProject("project-1"), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual(project));

    expect(projectApi.getProject).toHaveBeenCalledWith("project-1");
    expect(queryClient.getQueryData(["project", "project-1"])).toEqual(project);
  });
});

describe("useManageProject", () => {
  it.each(["update", "archive"] as const)(
    "refreshes the project list and detail after %s",
    async (action) => {
      projectApi.updateProject.mockResolvedValue({});
      projectApi.archiveProject.mockResolvedValue(undefined);
      const queryClient = new QueryClient();
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const wrapper = ({ children }: PropsWithChildren) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
      const { result } = renderHook(
        () => useManageProject({ id: "project-1", workspaceId: "workspace-1" }),
        { wrapper },
      );

      await act(async () => {
        if (action === "update") await result.current.update.mutateAsync({ description: null });
        else await result.current.archive.mutateAsync();
      });

      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects", "workspace-1"] });
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["project", "project-1"] });
    },
  );
});

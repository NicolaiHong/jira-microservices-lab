import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createProject,
  createWorkspace,
  listProjects,
  listWorkspaces,
} from "../api";
import { WorkspaceProjectDashboard } from "./WorkspaceProjectDashboard";

vi.mock("../api", () => ({
  createProject: vi.fn(),
  createWorkspace: vi.fn(),
  listProjects: vi.fn(),
  listWorkspaces: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const existingWorkspace = {
  id: "workspace-existing",
  name: "Platform",
  slug: "platform",
  role: "OWNER" as const,
  createdAt: "2026-08-24T00:00:00.000Z",
};

const listWorkspacesMock = vi.mocked(listWorkspaces);
const createWorkspaceMock = vi.mocked(createWorkspace);
const listProjectsMock = vi.mocked(listProjects);
const createProjectMock = vi.mocked(createProject);

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProjectDashboard />
    </QueryClientProvider>,
  );
}

describe("WorkspaceProjectDashboard", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    listProjectsMock.mockResolvedValue([]);
    createProjectMock.mockResolvedValue({
      id: "project-1",
      workspaceId: existingWorkspace.id,
      name: "Ignored",
      key: "IGN",
      description: null,
      status: "ACTIVE",
      createdByUserId: "user-1",
      createdAt: "2026-08-24T00:00:00.000Z",
      updatedAt: "2026-08-24T00:00:00.000Z",
    });
  });

  it("lists the caller's workspaces", async () => {
    listWorkspacesMock.mockResolvedValue([existingWorkspace]);

    renderDashboard();

    expect(await screen.findByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("OWNER · platform")).toBeInTheDocument();
  });

  it("creates a workspace and refreshes the visible workspace state", async () => {
    const createdWorkspace = {
      id: "workspace-created",
      name: "Research",
      slug: "research",
      role: "OWNER" as const,
      createdAt: "2026-08-24T00:01:00.000Z",
    };
    listWorkspacesMock
      .mockResolvedValueOnce([existingWorkspace])
      .mockResolvedValueOnce([existingWorkspace, createdWorkspace]);
    createWorkspaceMock.mockResolvedValue(createdWorkspace);

    renderDashboard();
    await screen.findByText("Platform");
    fireEvent.change(screen.getByPlaceholderText("Workspace name"), {
      target: { value: "Research" },
    });
    fireEvent.change(screen.getByPlaceholderText("workspace-slug"), {
      target: { value: "research" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    await waitFor(() =>
      expect(createWorkspaceMock).toHaveBeenCalledWith({
        name: "Research",
        slug: "research",
      }),
    );
    expect(await screen.findByText("Research")).toBeInTheDocument();
  });

  it("shows a creation error without changing the visible workspace list", async () => {
    listWorkspacesMock.mockResolvedValue([existingWorkspace]);
    createWorkspaceMock.mockRejectedValue(new Error("duplicate slug"));

    renderDashboard();
    await screen.findByText("Platform");
    fireEvent.change(screen.getByPlaceholderText("Workspace name"), {
      target: { value: "Duplicate" },
    });
    fireEvent.change(screen.getByPlaceholderText("workspace-slug"), {
      target: { value: "platform" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    await waitFor(async () => {
      const { toast } = await import("sonner");
      expect(toast.error).toHaveBeenCalledWith("Could not create workspace");
    });
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.queryByText("Duplicate")).not.toBeInTheDocument();
  });

  it.each(["OWNER", "ADMIN"] as const)(
    "%s can see the project creation form",
    async (role) => {
      listWorkspacesMock.mockResolvedValue([{ ...existingWorkspace, role }]);

      renderDashboard();

      expect(await screen.findByText("New project")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Create$/ })).toBeInTheDocument();
    },
  );

  it("hides the project creation form from a member", async () => {
    listWorkspacesMock.mockResolvedValue([{ ...existingWorkspace, role: "MEMBER" }]);

    renderDashboard();

    await screen.findByText("Platform");
    expect(screen.queryByText("New project")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Project name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Create$/ })).not.toBeInTheDocument();
  });

  it("creates a project in the selected workspace", async () => {
    listWorkspacesMock.mockResolvedValue([existingWorkspace]);

    renderDashboard();
    await screen.findByText("Platform");
    fireEvent.change(screen.getByPlaceholderText("Project name"), {
      target: { value: "Learning" },
    });
    fireEvent.change(screen.getByPlaceholderText("KEY"), {
      target: { value: "LRN" },
    });
    fireEvent.change(screen.getByPlaceholderText("What is this project for?"), {
      target: { value: "Course materials" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));

    await waitFor(() =>
      expect(createProjectMock).toHaveBeenCalledWith(existingWorkspace.id, {
        name: "Learning",
        key: "LRN",
        description: "Course materials",
      }),
    );
    const { toast } = await import("sonner");
    expect(toast.success).toHaveBeenCalledWith("Project created");
  });

  it("shows an error when project creation fails", async () => {
    listWorkspacesMock.mockResolvedValue([existingWorkspace]);
    createProjectMock.mockRejectedValue(new Error("duplicate key"));

    renderDashboard();
    await screen.findByText("Platform");
    fireEvent.change(screen.getByPlaceholderText("Project name"), {
      target: { value: "Learning" },
    });
    fireEvent.change(screen.getByPlaceholderText("KEY"), {
      target: { value: "LRN" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Create$/ }));

    await waitFor(async () => {
      const { toast } = await import("sonner");
      expect(toast.error).toHaveBeenCalledWith("Could not create project");
    });
  });
});

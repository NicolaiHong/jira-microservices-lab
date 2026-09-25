import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveProject,
  createProject,
  createWorkspace,
  listProjects,
  listWorkspaceMembers,
  listWorkspaces,
  updateProject,
} from "../api";
import { WorkspaceProjectDashboard } from "./WorkspaceProjectDashboard";

vi.mock("../api", () => ({
  archiveProject: vi.fn(),
  createProject: vi.fn(),
  createWorkspace: vi.fn(),
  listProjects: vi.fn(),
  listWorkspaceMembers: vi.fn(),
  listWorkspaces: vi.fn(),
  updateProject: vi.fn(),
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

const activeProject = {
  id: "project-1",
  workspaceId: existingWorkspace.id,
  name: "Payments",
  key: "PAY",
  description: "Card payments",
  status: "ACTIVE" as const,
  createdByUserId: "user-1",
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
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
    vi.mocked(listWorkspaceMembers).mockResolvedValue([]);
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

  it("hides project edit and archive controls from a member", async () => {
    listWorkspacesMock.mockResolvedValue([{ ...existingWorkspace, role: "MEMBER" }]);
    listProjectsMock.mockResolvedValue([activeProject]);

    renderDashboard();

    expect(await screen.findByRole("link", { name: "Payments" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Payments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive Payments" })).not.toBeInTheDocument();
  });

  it.each([
    ["renames", "Payments v2", "Card payments", { name: "Payments v2" }],
    ["clears the description of", "Payments", "  ", { description: null }],
  ])("sends only the changed field when an owner %s a project", async (_, name, description, expected) => {
    listWorkspacesMock.mockResolvedValue([existingWorkspace]);
    listProjectsMock.mockResolvedValue([activeProject]);
    vi.mocked(updateProject).mockResolvedValue(activeProject);

    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Payments" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit project name" }), {
      target: { value: name },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Edit project description" }), {
      target: { value: description },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(updateProject).toHaveBeenCalledWith("project-1", expected));
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Edit project name" })).not.toBeInTheDocument(),
    );
  });

  it("archives only after confirmation, then shows the project as archived and read-only", async () => {
    const confirm = vi.spyOn(window, "confirm");
    listWorkspacesMock.mockResolvedValue([existingWorkspace]);
    listProjectsMock
      .mockResolvedValueOnce([activeProject])
      .mockResolvedValue([{ ...activeProject, status: "ARCHIVED" }]);
    vi.mocked(archiveProject).mockResolvedValue();

    renderDashboard();
    const archiveButton = await screen.findByRole("button", { name: "Archive Payments" });
    confirm.mockReturnValueOnce(false);
    fireEvent.click(archiveButton);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("cannot be undone"));
    expect(archiveProject).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    fireEvent.click(archiveButton);

    await waitFor(() => expect(archiveProject).toHaveBeenCalledWith("project-1"));
    expect(await screen.findByText("Archived")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit Payments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive Payments" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute(
      "href",
      "/projects/project-1/board",
    );
    confirm.mockRestore();
  });

  it("shows a 409 PROJECT_ARCHIVED rejection without retrying", async () => {
    listWorkspacesMock.mockResolvedValue([existingWorkspace]);
    listProjectsMock.mockResolvedValue([activeProject]);
    vi.mocked(updateProject).mockRejectedValue(
      new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
        status: 409,
        data: { code: "PROJECT_ARCHIVED", message: "Project is archived" },
      } as AxiosResponse),
    );

    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Payments" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit project name" }), {
      target: { value: "Renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Project is archived"));
    expect(updateProject).toHaveBeenCalledTimes(1);
  });
});

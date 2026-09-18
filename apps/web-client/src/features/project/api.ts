import { http } from "@/lib/http";
import type {
  AddWorkspaceMemberPayload,
  CreateProjectPayload,
  CreateWorkspacePayload,
  ListResponse,
  Project,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from "./types";

export async function listWorkspaces(): Promise<Workspace[]> {
  const { data } = await http.get<ListResponse<Workspace>>("/api/workspaces");
  return data.items;
}

export async function createWorkspace(
  payload: CreateWorkspacePayload,
): Promise<Workspace> {
  const { data } = await http.post<{ workspace: Workspace }>(
    "/api/workspaces",
    payload,
  );
  return { ...data.workspace, role: "OWNER" };
}

export async function listProjects(workspaceId: string): Promise<Project[]> {
  const { data } = await http.get<ListResponse<Project>>(
    `/api/workspaces/${workspaceId}/projects`,
  );
  return data.items;
}

export async function createProject(
  workspaceId: string,
  payload: CreateProjectPayload,
): Promise<Project> {
  const { data } = await http.post<{ project: Project }>(
    `/api/workspaces/${workspaceId}/projects`,
    payload,
  );
  return data.project;
}

export async function getProject(projectId: string): Promise<Project> {
  const { data } = await http.get<Project>(`/api/projects/${projectId}`);
  return data;
}

export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const { data } = await http.get<ListResponse<WorkspaceMember>>(
    `/api/workspaces/${workspaceId}/members`,
  );
  return data.items;
}

export async function addWorkspaceMember(
  workspaceId: string,
  payload: AddWorkspaceMemberPayload,
): Promise<void> {
  await http.post(`/api/workspaces/${workspaceId}/members`, payload);
}

export async function changeWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<void> {
  await http.patch(`/api/workspaces/${workspaceId}/members/${userId}`, { role });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
): Promise<void> {
  await http.delete(`/api/workspaces/${workspaceId}/members/${userId}`);
}

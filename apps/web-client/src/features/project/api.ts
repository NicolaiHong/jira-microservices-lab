import { http } from "@/lib/http";
import type {
  CreateProjectPayload,
  CreateWorkspacePayload,
  ListResponse,
  Project,
  Workspace,
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

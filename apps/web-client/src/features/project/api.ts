import { http } from "@/lib/http";

import type { CreateProjectPayload, Project } from "./types";

/**
 * Lists project-context records through the API gateway. The current gateway
 * exposes the project service through workspace routes.
 */
export async function listProjects(): Promise<Project[]> {
  const { data } = await http.get<Project[]>("/api/workspaces");
  return data;
}

/**
 * Creates a project inside a workspace via the gateway's project-service route.
 */
export async function createProject(
  workspaceId: string,
  payload: CreateProjectPayload,
): Promise<Project> {
  const { data } = await http.post<Project>(
    `/api/workspaces/${workspaceId}/projects`,
    payload,
  );

  return data;
}

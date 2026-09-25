"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addWorkspaceMember,
  archiveProject,
  changeWorkspaceMemberRole,
  createProject,
  createWorkspace,
  getProject,
  listProjects,
  listWorkspaceMembers,
  listWorkspaces,
  removeWorkspaceMember,
  updateProject,
} from "../api";
import type {
  AddWorkspaceMemberPayload,
  CreateProjectPayload,
  CreateWorkspacePayload,
  Project,
  UpdateProjectPayload,
  WorkspaceRole,
} from "../types";

export function useWorkspaces() {
  return useQuery({ queryKey: ["workspaces"], queryFn: listWorkspaces });
}

export function useProjects(workspaceId?: string) {
  return useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => listProjects(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

export function useProject(projectId?: string) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkspacePayload) => createWorkspace(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

export function useCreateProject(workspaceId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      createProject(workspaceId as string, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] }),
  });
}

export function useManageProject(project: Pick<Project, "id" | "workspaceId">) {
  const queryClient = useQueryClient();
  // Settled, not only success: a 409 PROJECT_ARCHIVED also means the cached status is stale.
  const onSettled = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects", project.workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ["project", project.id] }),
    ]);
  return {
    update: useMutation({
      mutationFn: (payload: UpdateProjectPayload) => updateProject(project.id, payload),
      onSettled,
    }),
    archive: useMutation({
      mutationFn: () => archiveProject(project.id),
      onSettled,
    }),
  };
}

export function useWorkspaceMembers(workspaceId?: string) {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: () => listWorkspaceMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

/** Members of the workspace that owns the project; shares the project and member caches. */
export function useProjectMembers(projectId?: string) {
  const project = useProject(projectId);
  return useWorkspaceMembers(project.data?.workspaceId);
}

export function useManageWorkspaceMembers(workspaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
  return {
    add: useMutation({
      mutationFn: (payload: AddWorkspaceMemberPayload) =>
        addWorkspaceMember(workspaceId, payload),
      onSuccess,
    }),
    changeRole: useMutation({
      mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
        changeWorkspaceMemberRole(workspaceId, userId, role),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => removeWorkspaceMember(workspaceId, userId),
      onSuccess,
    }),
  };
}

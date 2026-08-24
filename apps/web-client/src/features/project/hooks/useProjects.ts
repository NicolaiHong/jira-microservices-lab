"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProject,
  createWorkspace,
  getProject,
  listProjects,
  listWorkspaces,
} from "../api";
import type { CreateProjectPayload, CreateWorkspacePayload } from "../types";

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

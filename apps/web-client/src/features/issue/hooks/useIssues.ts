"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeSprint,
  createEpic,
  createIssue,
  createSprint,
  getIssueErrorCode,
  listEpics,
  listIssues,
  listSprints,
  transitionIssue,
} from "../api";
import type { CreateEpicPayload, CreateIssuePayload, CreateSprintPayload, IssueStatus } from "../types";

export function useIssues(projectId?: string) {
  return useQuery({
    queryKey: ["issues", projectId],
    queryFn: () => listIssues(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useCreateIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateIssuePayload) => createIssue(projectId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["issues", projectId] }),
  });
}

export function useEpics(projectId?: string) {
  return useQuery({ queryKey: ["epics", projectId], queryFn: () => listEpics(projectId as string), enabled: Boolean(projectId) });
}

export function useCreateEpic(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (payload: CreateEpicPayload) => createEpic(projectId, payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["epics", projectId] }) });
}

export function useSprints(projectId?: string) {
  return useQuery({ queryKey: ["sprints", projectId], queryFn: () => listSprints(projectId as string), enabled: Boolean(projectId) });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (payload: CreateSprintPayload) => createSprint(projectId, payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sprints", projectId] }) });
}

export function useCompleteSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (sprintId: string) => completeSprint(sprintId), onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["sprints", projectId] });
    queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
  } });
}

export function useTransitionIssue(projectId: string) {
  const queryClient = useQueryClient();

  function invalidateIssueQueries(issueId: string) {
    queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
    queryClient.invalidateQueries({ queryKey: ["issues", issueId] });
  }

  return useMutation({
    mutationFn: ({
      issueId,
      status,
      expectedVersion,
    }: {
      issueId: string;
      status: IssueStatus;
      expectedVersion: number;
    }) => transitionIssue(issueId, status, expectedVersion),
    retry: false,
    onSuccess: (_, variables) => {
      invalidateIssueQueries(variables.issueId);
    },
    onError: (error, variables) => {
      invalidateIssueQueries(variables.issueId);

      if (getIssueErrorCode(error) === "PROJECT_ARCHIVED") {
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      }
    },
  });
}

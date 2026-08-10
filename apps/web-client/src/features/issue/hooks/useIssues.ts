"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createIssue, listIssues, transitionIssue } from "../api";
import type { CreateIssuePayload, IssueStatus } from "../types";

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

export function useTransitionIssue(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: IssueStatus }) =>
      transitionIssue(issueId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
      queryClient.invalidateQueries({ queryKey: ["issues", variables.issueId] });
    },
  });
}

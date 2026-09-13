"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addComment,
  getIssue,
  isConcurrentIssueModification,
  listComments,
  listHistory,
} from "../api";

export function useIssue(issueId?: string) {
  return useQuery({ queryKey: ["issue", issueId], queryFn: () => getIssue(issueId as string), enabled: Boolean(issueId) });
}

export function useComments(issueId?: string) {
  return useQuery({ queryKey: ["issue", issueId, "comments"], queryFn: () => listComments(issueId as string), enabled: Boolean(issueId) });
}

export function useHistory(issueId?: string) {
  return useQuery({ queryKey: ["issue", issueId, "history"], queryFn: () => listHistory(issueId as string), enabled: Boolean(issueId) });
}

export function useAddComment(issueId: string, projectId?: string) {
  const queryClient = useQueryClient();

  async function refreshCommentDependencies() {
    const queryKeys = [
      ["issue", issueId],
      ["issue", issueId, "comments"],
      ["issue", issueId, "history"],
    ];

    if (projectId) {
      queryKeys.push(["issues", "list", projectId]);
    }

    await Promise.all(
      queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }

  return useMutation({
    mutationFn: (body: string) => addComment(issueId, body),
    retry: false,
    onSuccess: refreshCommentDependencies,
    onError: async (error) => {
      if (isConcurrentIssueModification(error)) {
        await refreshCommentDependencies();
      }
    },
  });
}

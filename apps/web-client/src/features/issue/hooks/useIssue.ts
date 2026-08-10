"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addComment, getIssue, listComments, listHistory } from "../api";

export function useIssue(issueId?: string) {
  return useQuery({ queryKey: ["issues", issueId], queryFn: () => getIssue(issueId as string), enabled: Boolean(issueId) });
}

export function useComments(issueId?: string) {
  return useQuery({ queryKey: ["issues", issueId, "comments"], queryFn: () => listComments(issueId as string), enabled: Boolean(issueId) });
}

export function useHistory(issueId?: string) {
  return useQuery({ queryKey: ["issues", issueId, "history"], queryFn: () => listHistory(issueId as string), enabled: Boolean(issueId) });
}

export function useAddComment(issueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addComment(issueId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["issues", issueId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["issues", issueId, "history"] });
    },
  });
}

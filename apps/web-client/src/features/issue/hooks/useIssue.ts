"use client";

import { useQuery } from "@tanstack/react-query";

import { getIssue } from "../api";

export function useIssue(issueId?: string) {
  return useQuery({
    queryKey: ["issues", issueId],
    queryFn: () => getIssue(issueId as string),
    enabled: Boolean(issueId),
  });
}

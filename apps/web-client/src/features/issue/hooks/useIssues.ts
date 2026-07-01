"use client";

import { useQuery } from "@tanstack/react-query";

import { listIssues } from "../api";

export function useIssues(projectId?: string) {
  return useQuery({
    queryKey: ["issues", { projectId }],
    queryFn: () => listIssues({ projectId }),
    enabled: Boolean(projectId),
  });
}

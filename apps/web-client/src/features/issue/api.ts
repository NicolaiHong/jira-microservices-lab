import { http } from "@/lib/http";

import type { CreateIssuePayload, Issue, ListIssuesParams } from "./types";

/**
 * Lists issues through the API gateway. The issue service route is not wired in
 * this repo yet, so callers should render an error or empty placeholder.
 */
export async function listIssues(
  params: ListIssuesParams = {},
): Promise<Issue[]> {
  const { data } = await http.get<Issue[]>("/api/issues", { params });
  return data;
}

/**
 * Reads a single issue by id through the gateway.
 */
export async function getIssue(issueId: string): Promise<Issue> {
  const { data } = await http.get<Issue>(`/api/issues/${issueId}`);
  return data;
}

/**
 * Creates an issue through the gateway once the issue-service API is exposed.
 */
export async function createIssue(payload: CreateIssuePayload): Promise<Issue> {
  const { data } = await http.post<Issue>("/api/issues", payload);
  return data;
}

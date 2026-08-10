import { http } from "@/lib/http";
import type {
  CreateIssuePayload,
  Issue,
  IssueComment,
  IssueHistory,
  IssueStatus,
} from "./types";

export async function listIssues(projectId: string): Promise<Issue[]> {
  const { data } = await http.get<{ items: Issue[] }>(`/api/projects/${projectId}/issues`);
  return data.items;
}

export async function getIssue(issueId: string): Promise<Issue> {
  const { data } = await http.get<{ issue: Issue }>(`/api/issues/${issueId}`);
  return data.issue;
}

export async function createIssue(projectId: string, payload: CreateIssuePayload): Promise<Issue> {
  const { data } = await http.post<{ issue: Issue }>(`/api/projects/${projectId}/issues`, payload);
  return data.issue;
}

export async function transitionIssue(issueId: string, status: IssueStatus): Promise<Issue> {
  const { data } = await http.post<{ issue: Issue }>(`/api/issues/${issueId}/transitions`, { status });
  return data.issue;
}

export async function assignIssue(issueId: string, assigneeUserId: string | null): Promise<Issue> {
  const { data } = await http.patch<{ issue: Issue }>(`/api/issues/${issueId}/assignee`, { assigneeUserId });
  return data.issue;
}

export async function updateIssue(
  issueId: string,
  payload: Partial<Pick<Issue, "summary" | "description" | "type" | "priority">>,
): Promise<Issue> {
  const { data } = await http.patch<{ issue: Issue }>(`/api/issues/${issueId}`, payload);
  return data.issue;
}

export async function listComments(issueId: string): Promise<IssueComment[]> {
  const { data } = await http.get<{ items: IssueComment[] }>(`/api/issues/${issueId}/comments`);
  return data.items;
}

export async function addComment(issueId: string, body: string): Promise<IssueComment> {
  const { data } = await http.post<{ comment: IssueComment }>(`/api/issues/${issueId}/comments`, { body });
  return data.comment;
}

export async function listHistory(issueId: string): Promise<IssueHistory[]> {
  const { data } = await http.get<{ items: IssueHistory[] }>(`/api/issues/${issueId}/history`);
  return data.items;
}

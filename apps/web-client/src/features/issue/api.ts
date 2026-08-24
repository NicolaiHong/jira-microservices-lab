import axios from "axios";
import { http } from "@/lib/http";
import type {
  CreateIssuePayload,
  Issue,
  IssueComment,
  IssueHistory,
  IssueStatus,
  Epic,
  Sprint,
  CreateEpicPayload,
  CreateSprintPayload,
} from "./types";

export type IssueDetailsUpdate = Partial<
  Pick<Issue, "summary" | "description" | "type" | "priority">
>;

export function isConcurrentIssueModification(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 409 &&
    error.response.data?.code === "CONCURRENT_ISSUE_MODIFICATION"
  );
}

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

export async function transitionIssue(
  issueId: string,
  status: IssueStatus,
  expectedVersion: number,
): Promise<Issue> {
  const { data } = await http.post<{ issue: Issue }>(`/api/issues/${issueId}/transitions`, {
    status,
    expectedVersion,
  });
  return data.issue;
}

export async function assignIssue(
  issueId: string,
  assigneeUserId: string | null,
  expectedVersion: number,
): Promise<Issue> {
  const { data } = await http.patch<{ issue: Issue }>(`/api/issues/${issueId}/assignee`, {
    assigneeUserId,
    expectedVersion,
  });
  return data.issue;
}

export async function updateIssue(
  issueId: string,
  payload: IssueDetailsUpdate,
  expectedVersion: number,
): Promise<Issue> {
  const { data } = await http.patch<{ issue: Issue }>(`/api/issues/${issueId}`, {
    ...payload,
    expectedVersion,
  });
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

export async function listEpics(projectId: string): Promise<Epic[]> {
  const { data } = await http.get<{ items: Epic[] }>(`/api/projects/${projectId}/epics`);
  return data.items;
}

export async function createEpic(projectId: string, payload: CreateEpicPayload): Promise<Epic> {
  const { data } = await http.post<{ epic: Epic }>(`/api/projects/${projectId}/epics`, payload);
  return data.epic;
}

export async function listSprints(projectId: string): Promise<Sprint[]> {
  const { data } = await http.get<{ items: Sprint[] }>(`/api/projects/${projectId}/sprints`);
  return data.items;
}

export async function createSprint(projectId: string, payload: CreateSprintPayload): Promise<Sprint> {
  const { data } = await http.post<{ sprint: Sprint }>(`/api/projects/${projectId}/sprints`, payload);
  return data.sprint;
}

export async function completeSprint(sprintId: string): Promise<Sprint> {
  const { data } = await http.post<{ sprint: Sprint }>(`/api/sprints/${sprintId}/complete`);
  return data.sprint;
}

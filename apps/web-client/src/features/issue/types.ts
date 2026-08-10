export type IssueStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IssueType = "TASK" | "BUG" | "STORY";

export interface Issue {
  id: string;
  projectId: string;
  number: number;
  key: string;
  summary: string;
  description: string | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  reporterUserId: string;
  assigneeUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface IssueHistory {
  id: string;
  issueId: string;
  actorUserId: string;
  action: string;
  fromValue: unknown;
  toValue: unknown;
  createdAt: string;
}

export interface CreateIssuePayload {
  summary: string;
  description?: string;
  type: IssueType;
  priority: IssuePriority;
  assigneeUserId?: string;
}

export type IssueStatus = "todo" | "in_progress" | "done";
export type IssuePriority = "low" | "medium" | "high" | "critical";

export interface IssueAssignee {
  id: string;
  email: string;
}

export interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  assignee?: IssueAssignee | null;
  sprintId?: string | null;
  projectId: string;
}

export interface CreateIssuePayload {
  title: string;
  projectId: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeId?: string;
  sprintId?: string;
}

export interface ListIssuesParams {
  projectId?: string;
  sprintId?: string;
}

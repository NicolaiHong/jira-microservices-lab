export type IssueStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IssueType = "TASK" | "BUG" | "STORY";
export type EpicColor = "PURPLE" | "BLUE" | "GREEN" | "YELLOW" | "ORANGE";
export type SprintStatus = "ACTIVE" | "COMPLETED";

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
  epicId: string | null;
  sprintId: string | null;
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
  epicId?: string;
  sprintId?: string;
}

export interface Epic {
  id: string;
  projectId: string;
  name: string;
  color: EpicColor;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateEpicPayload {
  name: string;
  color?: EpicColor;
  startDate?: string;
  targetDate?: string;
}

export interface CreateSprintPayload {
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
}

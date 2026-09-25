export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  ownerUserId?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkspacePayload {
  name: string;
  slug: string;
}

export interface CreateProjectPayload {
  name: string;
  key: string;
  description?: string;
}

/** Presence-aware: omitted fields are kept; `description: null` clears it. */
export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
}

export interface ListResponse<T> {
  items: T[];
}

export type WorkspaceRole = Workspace["role"];

export interface WorkspaceMember {
  userId: string;
  email: string | null;
  role: WorkspaceRole;
  joinedAt: string;
  updatedAt: string;
}

export interface AddWorkspaceMemberPayload {
  email: string;
  role: WorkspaceRole;
}

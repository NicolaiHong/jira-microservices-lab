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

export interface ListResponse<T> {
  items: T[];
}

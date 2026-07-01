export interface ProjectMember {
  id: string;
  email: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  members: ProjectMember[];
}

export interface CreateProjectPayload {
  name: string;
  key: string;
  description?: string;
}

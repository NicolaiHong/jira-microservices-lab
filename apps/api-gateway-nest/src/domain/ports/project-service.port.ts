export const PROJECT_SERVICE_PORT = 'IProjectServicePort';

export interface ProjectServiceRequestContext {
  userId: string;
  correlationId: string;
}

export interface IProjectServicePort {
  createWorkspace(
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown>;

  listWorkspaces(context: ProjectServiceRequestContext): Promise<unknown>;

  createProject(
    workspaceId: string,
    body: unknown,
    context: ProjectServiceRequestContext,
  ): Promise<unknown>;
}

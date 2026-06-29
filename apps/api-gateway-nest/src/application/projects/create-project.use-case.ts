import { AppException } from '../../domain/errors/app.exception';
import type { IProjectServicePort } from '../../domain/ports/project-service.port';

export interface CreateProjectInput {
  workspaceId: string;
  body: unknown;
  authenticatedUserId?: string;
  correlationId: string;
}

export class CreateProjectUseCase {
  constructor(private readonly projectService: IProjectServicePort) {}

  execute(input: CreateProjectInput): Promise<unknown> {
    return this.projectService.createProject(input.workspaceId, input.body, {
      userId: this.requireUserId(input.authenticatedUserId),
      correlationId: input.correlationId,
    });
  }

  private requireUserId(userId: string | undefined): string {
    if (!userId) {
      throw new AppException(
        401,
        'UNAUTHORIZED',
        'Authentication token is required',
      );
    }

    return userId;
  }
}

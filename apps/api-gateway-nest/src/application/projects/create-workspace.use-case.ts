import { AppException } from '../../domain/errors/app.exception';
import type { IProjectServicePort } from '../../domain/ports/project-service.port';

export interface CreateWorkspaceInput {
  body: unknown;
  authenticatedUserId?: string;
  correlationId: string;
}

export class CreateWorkspaceUseCase {
  constructor(private readonly projectService: IProjectServicePort) {}

  execute(input: CreateWorkspaceInput): Promise<unknown> {
    return this.projectService.createWorkspace(input.body, {
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

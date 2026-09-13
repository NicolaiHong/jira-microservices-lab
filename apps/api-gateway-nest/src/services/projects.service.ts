import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ProjectServiceAdapter } from '../infrastructure/http-clients/project-service.adapter';
import { RedisRateLimitAdapter } from '../infrastructure/rate-limit/redis-rate-limit.adapter';

const MEMBER_ADD_LIMIT = 20;
const MEMBER_ADD_WINDOW_SECONDS = 600;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectClient: ProjectServiceAdapter,
    private readonly rateLimiter: RedisRateLimitAdapter,
  ) {}

  createWorkspace(body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.createWorkspace(body, this.context(userId, correlationId));
  }
  listWorkspaces(userId: string | undefined, correlationId: string) {
    return this.projectClient.listWorkspaces(this.context(userId, correlationId));
  }
  createProject(workspaceId: string, body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.createProject(workspaceId, body, this.context(userId, correlationId));
  }
  listWorkspaceMembers(workspaceId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.listWorkspaceMembers(workspaceId, this.context(userId, correlationId));
  }
  async addWorkspaceMember(workspaceId: string, body: unknown, userId: string | undefined, correlationId: string) {
    const context = this.context(userId, correlationId);
    // Bounds how fast a member manager can probe whether emails are registered (ADR 0003).
    const limit = await this.rateLimiter.hit(
      `rate:workspace-member-add:user:${context.userId}`,
      MEMBER_ADD_LIMIT,
      MEMBER_ADD_WINDOW_SECONDS,
    );
    if (limit.limited) {
      throw new AppException(429, 'RATE_LIMITED', 'Too many requests', {
        rule: 'workspace_member_add_user',
        limit: limit.limit,
        count: limit.count,
        retryAfterSeconds: Math.max(limit.ttlSeconds, 0),
      });
    }
    return this.projectClient.addWorkspaceMember(workspaceId, body, context);
  }
  changeWorkspaceMemberRole(workspaceId: string, memberId: string, body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.changeWorkspaceMemberRole(workspaceId, memberId, body, this.context(userId, correlationId));
  }
  removeWorkspaceMember(workspaceId: string, memberId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.removeWorkspaceMember(workspaceId, memberId, this.context(userId, correlationId));
  }
  listProjects(workspaceId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.listProjects(workspaceId, this.context(userId, correlationId));
  }
  getProject(projectId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.getProject(projectId, this.context(userId, correlationId));
  }
  updateProject(projectId: string, body: unknown, userId: string | undefined, correlationId: string) {
    return this.projectClient.updateProject(projectId, body, this.context(userId, correlationId));
  }
  archiveProject(projectId: string, userId: string | undefined, correlationId: string) {
    return this.projectClient.archiveProject(projectId, this.context(userId, correlationId));
  }

  private context(userId: string | undefined, correlationId: string) {
    if (!userId) throw new AppException(401, 'UNAUTHORIZED', 'Authentication token is required');
    return { userId, correlationId };
  }
}

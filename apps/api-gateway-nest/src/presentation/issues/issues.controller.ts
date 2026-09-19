import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IssueServiceAdapter } from '../../infrastructure/http-clients/issue-service.adapter';
import { getCorrelationId } from '../common/errors/correlation-id';
import type { AuthenticatedRequest } from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(private readonly issues: IssueServiceAdapter) {}

  @Post('projects/:projectId/issues')
  createIssue(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.createIssue(projectId, body, this.context(request));
  }

  @Get('projects/:projectId/issues')
  listIssues(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listIssues(projectId, this.context(request));
  }

  @Get('issues/:issueId')
  getIssue(@Param('issueId') issueId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.getIssue(issueId, this.context(request));
  }

  @Patch('issues/:issueId')
  updateIssue(@Param('issueId') issueId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.updateIssue(issueId, body, this.context(request));
  }

  @Patch('issues/:issueId/assignee')
  assignIssue(@Param('issueId') issueId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.assignIssue(issueId, body, this.context(request));
  }

  @Post('issues/:issueId/transitions')
  @HttpCode(200)
  transitionIssue(@Param('issueId') issueId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.transitionIssue(issueId, body, this.context(request));
  }

  @Post('issues/:issueId/comments')
  addComment(@Param('issueId') issueId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.addComment(issueId, body, this.context(request));
  }

  @Get('issues/:issueId/comments')
  listComments(@Param('issueId') issueId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listComments(issueId, this.context(request));
  }

  @Get('issues/:issueId/history')
  listHistory(@Param('issueId') issueId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listHistory(issueId, this.context(request));
  }

  @Get('projects/:projectId/epics')
  listEpics(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listEpics(projectId, this.context(request));
  }

  @Post('projects/:projectId/epics')
  createEpic(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.createEpic(projectId, body, this.context(request));
  }

  @Patch('epics/:epicId')
  updateEpic(@Param('epicId') epicId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.updateEpic(epicId, body, this.context(request));
  }

  @Get('projects/:projectId/sprints')
  listSprints(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listSprints(projectId, this.context(request));
  }

  @Post('projects/:projectId/sprints')
  createSprint(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.createSprint(projectId, body, this.context(request));
  }

  @Post('sprints/:sprintId/complete')
  completeSprint(@Param('sprintId') sprintId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.completeSprint(sprintId, this.context(request));
  }

  // JwtAuthGuard sets request.user before any handler runs.
  private context(request: AuthenticatedRequest) {
    return { userId: request.user!.id, correlationId: getCorrelationId(request) };
  }
}

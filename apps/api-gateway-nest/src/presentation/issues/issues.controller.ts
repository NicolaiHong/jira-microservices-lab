import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IssuesService } from '../../services/issues.service';
import { getCorrelationId } from '../common/errors/correlation-id';
import type { AuthenticatedRequest } from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api')
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Post('projects/:projectId/issues')
  createIssue(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.createIssue(projectId, body, request.user?.userId, getCorrelationId(request));
  }

  @Get('projects/:projectId/issues')
  listIssues(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listIssues(projectId, request.user?.userId, getCorrelationId(request));
  }

  @Get('issues/:issueId')
  getIssue(@Param('issueId') issueId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.getIssue(issueId, request.user?.userId, getCorrelationId(request));
  }

  @Patch('issues/:issueId')
  updateIssue(@Param('issueId') issueId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.updateIssue(issueId, body, request.user?.userId, getCorrelationId(request));
  }

  @Patch('issues/:issueId/assignee')
  assignIssue(@Param('issueId') issueId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.assignIssue(issueId, body, request.user?.userId, getCorrelationId(request));
  }

  @Post('issues/:issueId/transitions')
  transitionIssue(@Param('issueId') issueId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.transitionIssue(issueId, body, request.user?.userId, getCorrelationId(request));
  }

  @Post('issues/:issueId/comments')
  addComment(@Param('issueId') issueId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.addComment(issueId, body, request.user?.userId, getCorrelationId(request));
  }

  @Get('issues/:issueId/comments')
  listComments(@Param('issueId') issueId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listComments(issueId, request.user?.userId, getCorrelationId(request));
  }

  @Get('issues/:issueId/history')
  listHistory(@Param('issueId') issueId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listHistory(issueId, request.user?.userId, getCorrelationId(request));
  }

  @Get('projects/:projectId/epics')
  listEpics(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listEpics(projectId, request.user?.userId, getCorrelationId(request));
  }

  @Post('projects/:projectId/epics')
  createEpic(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.createEpic(projectId, body, request.user?.userId, getCorrelationId(request));
  }

  @Patch('epics/:epicId')
  updateEpic(@Param('epicId') epicId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.updateEpic(epicId, body, request.user?.userId, getCorrelationId(request));
  }

  @Get('projects/:projectId/sprints')
  listSprints(@Param('projectId') projectId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.listSprints(projectId, request.user?.userId, getCorrelationId(request));
  }

  @Post('projects/:projectId/sprints')
  createSprint(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: AuthenticatedRequest) {
    return this.issues.createSprint(projectId, body, request.user?.userId, getCorrelationId(request));
  }

  @Post('sprints/:sprintId/complete')
  completeSprint(@Param('sprintId') sprintId: string, @Req() request: AuthenticatedRequest) {
    return this.issues.completeSprint(sprintId, request.user?.userId, getCorrelationId(request));
  }

}

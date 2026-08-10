import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { IssueApplicationService } from '../application/issue-application.service';
import { requestContext } from './request-context';

@Controller('internal')
export class IssuesController {
  constructor(private readonly issues: IssueApplicationService) {}

  @Post('projects/:projectId/issues')
  createIssue(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.createIssue(projectId, body, requestContext(request));
  }

  @Get('projects/:projectId/issues')
  listIssues(
    @Param('projectId') projectId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.listIssues(projectId, requestContext(request));
  }

  @Get('issues/:issueId')
  getIssue(
    @Param('issueId') issueId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.getIssue(issueId, requestContext(request));
  }

  @Patch('issues/:issueId')
  updateIssue(
    @Param('issueId') issueId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.updateIssue(issueId, body, requestContext(request));
  }

  @Patch('issues/:issueId/assignee')
  assignIssue(
    @Param('issueId') issueId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.assignIssue(issueId, body, requestContext(request));
  }

  @Post('issues/:issueId/transitions')
  transitionIssue(
    @Param('issueId') issueId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.transitionIssue(issueId, body, requestContext(request));
  }

  @Post('issues/:issueId/comments')
  addComment(
    @Param('issueId') issueId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.addComment(issueId, body, requestContext(request));
  }

  @Get('issues/:issueId/comments')
  listComments(
    @Param('issueId') issueId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.listComments(issueId, requestContext(request));
  }

  @Get('issues/:issueId/history')
  listHistory(
    @Param('issueId') issueId: string,
    @Req() request: FastifyRequest,
  ) {
    return this.issues.listHistory(issueId, requestContext(request));
  }
}

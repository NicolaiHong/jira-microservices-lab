import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PlanningApplicationService } from '../application/planning-application.service';
import { requestContext } from './request-context';

@Controller('internal')
export class PlanningController {
  constructor(private readonly planning: PlanningApplicationService) {}

  @Get('projects/:projectId/epics')
  listEpics(@Param('projectId') projectId: string, @Req() request: FastifyRequest) {
    return this.planning.listEpics(projectId, requestContext(request));
  }

  @Post('projects/:projectId/epics')
  createEpic(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: FastifyRequest) {
    return this.planning.createEpic(projectId, body, requestContext(request));
  }

  @Patch('epics/:epicId')
  updateEpic(@Param('epicId') epicId: string, @Body() body: unknown, @Req() request: FastifyRequest) {
    return this.planning.updateEpic(epicId, body, requestContext(request));
  }

  @Get('projects/:projectId/sprints')
  listSprints(@Param('projectId') projectId: string, @Req() request: FastifyRequest) {
    return this.planning.listSprints(projectId, requestContext(request));
  }

  @Post('projects/:projectId/sprints')
  createSprint(@Param('projectId') projectId: string, @Body() body: unknown, @Req() request: FastifyRequest) {
    return this.planning.createSprint(projectId, body, requestContext(request));
  }

  @Post('sprints/:sprintId/complete')
  completeSprint(@Param('sprintId') sprintId: string, @Req() request: FastifyRequest) {
    return this.planning.completeSprint(sprintId, requestContext(request));
  }
}

import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IssueApplicationService } from './application/issue-application.service';
import { PlanningApplicationService } from './application/planning-application.service';
import { ISSUE_REPOSITORY, PLANNING_REPOSITORY, PROJECT_ACCESS_PORT } from './application/ports';
import { Database } from './infrastructure/database';
import { OutboxPublisher } from './infrastructure/outbox.publisher';
import { PostgresIssueRepository } from './infrastructure/postgres-issue.repository';
import { PostgresPlanningRepository } from './infrastructure/postgres-planning.repository';
import { ProjectAccessHttpClient } from './infrastructure/project-access.client';
import { IssuesController } from './presentation/issues.controller';
import { PlanningController } from './presentation/planning.controller';

@Module({
  imports: [HealthModule],
  controllers: [IssuesController, PlanningController],
  providers: [
    Database,
    IssueApplicationService,
    PlanningApplicationService,
    OutboxPublisher,
    {
      provide: ISSUE_REPOSITORY,
      useClass: PostgresIssueRepository,
    },
    {
      provide: PLANNING_REPOSITORY,
      useClass: PostgresPlanningRepository,
    },
    {
      provide: PROJECT_ACCESS_PORT,
      useClass: ProjectAccessHttpClient,
    },
  ],
})
export class AppModule {}

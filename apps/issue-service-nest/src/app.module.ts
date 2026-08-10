import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { IssueApplicationService } from './application/issue-application.service';
import { ISSUE_REPOSITORY, PROJECT_ACCESS_PORT } from './application/ports';
import { Database } from './infrastructure/database';
import { OutboxPublisher } from './infrastructure/outbox.publisher';
import { PostgresIssueRepository } from './infrastructure/postgres-issue.repository';
import { ProjectAccessHttpClient } from './infrastructure/project-access.client';
import { IssuesController } from './presentation/issues.controller';

@Module({
  imports: [HealthModule],
  controllers: [IssuesController],
  providers: [
    Database,
    IssueApplicationService,
    OutboxPublisher,
    {
      provide: ISSUE_REPOSITORY,
      useClass: PostgresIssueRepository,
    },
    {
      provide: PROJECT_ACCESS_PORT,
      useClass: ProjectAccessHttpClient,
    },
  ],
})
export class AppModule {}

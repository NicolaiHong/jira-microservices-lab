import { Module } from '@nestjs/common';
import { IssueServiceAdapter } from '../../infrastructure/http-clients/issue-service.adapter';
import { IssuesService } from '../../services/issues.service';
import { AuthModule } from '../auth/auth.module';
import { IssuesController } from './issues.controller';

@Module({
  imports: [AuthModule],
  controllers: [IssuesController],
  providers: [
    IssueServiceAdapter,
    IssuesService,
  ],
})
export class IssuesModule {}

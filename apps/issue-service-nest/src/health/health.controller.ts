import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'issue-service',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: 'not_checked',
        redis: 'not_applicable',
        kafka: 'not_checked',
      },
    };
  }
}

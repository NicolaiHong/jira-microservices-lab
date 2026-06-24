import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getGatewayHealth();
  }

  @Get('services')
  getServicesHealth() {
    return this.healthService.getServicesHealth();
  }
}

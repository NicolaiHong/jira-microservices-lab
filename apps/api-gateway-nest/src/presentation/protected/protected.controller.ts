import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  AuthenticatedRequest,
  GatewayUser,
} from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('api/protected')
@UseGuards(JwtAuthGuard)
export class ProtectedController {
  @Get('profile-test')
  profileTest(@Req() request: AuthenticatedRequest): {
    message: string;
    user: GatewayUser;
  } {
    return {
      message: 'Protected profile test passed',
      user: this.requireUser(request),
    };
  }

  private requireUser(request: AuthenticatedRequest): GatewayUser {
    if (!request.user) {
      throw new Error('Authenticated request is missing user context');
    }

    return request.user;
  }
}

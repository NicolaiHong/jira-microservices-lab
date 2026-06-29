import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { LoginUseCase } from '../../application/auth/login.use-case';
import { RegisterUseCase } from '../../application/auth/register.use-case';
import {
  AuthenticatedRequest,
  GatewayUser,
} from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getCorrelationId } from '../common/errors/correlation-id';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
  ) {}

  @Post('register')
  register(@Body() body: unknown, @Req() request: FastifyRequest) {
    return this.registerUseCase.execute({
      body,
      clientIp: this.clientIp(request),
      correlationId: getCorrelationId(request),
    });
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Req() request: FastifyRequest) {
    return this.loginUseCase.execute({
      body,
      clientIp: this.clientIp(request),
      correlationId: getCorrelationId(request),
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): { user: GatewayUser } {
    return { user: this.requireUser(request) };
  }

  private requireUser(request: AuthenticatedRequest): GatewayUser {
    if (!request.user) {
      throw new Error('Authenticated request is missing user context');
    }

    return request.user;
  }

  private clientIp(request: FastifyRequest): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    return request.ip ?? 'unknown';
  }
}

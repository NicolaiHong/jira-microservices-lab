import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  AuthenticatedRequest,
  GatewayUser,
} from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: unknown, @Req() request: FastifyRequest) {
    return this.authService.register(body, request);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Req() request: FastifyRequest) {
    return this.authService.login(body, request);
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
}

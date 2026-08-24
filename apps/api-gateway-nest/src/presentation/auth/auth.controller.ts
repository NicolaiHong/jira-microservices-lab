import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from '../../services/auth.service';
import {
  AuthenticatedRequest,
  GatewayUser,
} from '../common/guards/authenticated-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { getCorrelationId } from '../common/errors/correlation-id';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  register(@Body() body: unknown, @Req() request: FastifyRequest) {
    return this.authService.register(body, this.clientIp(request), getCorrelationId(request));
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.login(
      body,
      this.clientIp(request),
      getCorrelationId(request),
    );
    return this.withRefreshCookie(result, reply);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const refreshToken = this.refreshTokenFromRequest(request);
    if (!refreshToken) {
      throw new AppException(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is required');
    }

    try {
      const result = await this.authService.refresh(
        { refreshToken },
        getCorrelationId(request),
      );
      return this.withRefreshCookie(result, reply);
    } catch (error) {
      this.clearRefreshCookie(reply);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const refreshToken = this.refreshTokenFromRequest(request);
    try {
      if (refreshToken) {
        await this.authService.logout({ refreshToken }, getCorrelationId(request));
      }
    } finally {
      this.clearRefreshCookie(reply);
    }
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

  private withRefreshCookie(result: unknown, reply: FastifyReply): unknown {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new AppException(502, 'IAM_AUTH_ERROR', 'IAM returned an invalid authentication response');
    }
    const { refreshToken, ...publicResult } = result as Record<string, unknown>;
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw new AppException(502, 'IAM_AUTH_ERROR', 'IAM returned an invalid authentication response');
    }
    this.setRefreshCookie(reply, refreshToken);
    return publicResult;
  }

  private refreshTokenFromRequest(request: FastifyRequest): string | null {
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) return null;
    const refreshCookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('refresh_token='));
    if (!refreshCookie) return null;
    try {
      return decodeURIComponent(refreshCookie.slice('refresh_token='.length));
    } catch {
      return null;
    }
  }

  private setRefreshCookie(reply: FastifyReply, refreshToken: string): void {
    const attributes = [
      `refresh_token=${encodeURIComponent(refreshToken)}`,
      'HttpOnly',
      'Path=/api/auth',
      'SameSite=Strict',
      'Max-Age=2592000',
    ];
    if (process.env.NODE_ENV === 'production') attributes.push('Secure');
    reply.header('set-cookie', attributes.join('; '));
  }

  private clearRefreshCookie(reply: FastifyReply): void {
    const attributes = [
      'refresh_token=',
      'HttpOnly',
      'Path=/api/auth',
      'SameSite=Strict',
      'Max-Age=0',
    ];
    if (process.env.NODE_ENV === 'production') attributes.push('Secure');
    reply.header('set-cookie', attributes.join('; '));
  }
}

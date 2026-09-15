import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  Param,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { 
  LoginDto,
  RefreshTokenDto,
  LogoutDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto 
} from '../dto';
import { AuthGuard } from '../../../common/guards';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Login — rate limited to 5 per 60s ────────────────────────────────
  @Public()
  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Login with username and password (rate limited: 5/min)' })
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return this.authService.login(
      loginDto,
      req.ip || req.socket?.remoteAddress,
      req.headers['user-agent']
    );
  }

  // ── Refresh (token rotation) ──────────────────────────────────────────
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token — returns new access + refresh tokens (old token revoked)' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  // ── Logout ────────────────────────────────────────────────────────────
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Logout: revoke refresh token and clear sessions' })
  async logout(@CurrentUser() user: JwtPayload, @Body() dto: LogoutDto) {
    return this.authService.logout(user.sub, dto);
  }

  // ── Me ────────────────────────────────────────────────────────────────
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user with roles, permissions, and branch' })
  async me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }

  // ── Login History ─────────────────────────────────────────────────────
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('login-history')
  @ApiOperation({ summary: 'Paginated login history for the current user' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async loginHistory(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20'
  ) {
    return this.authService.getLoginHistory(user.sub, Number(page), Number(limit));
  }

  // ── Sessions ──────────────────────────────────────────────────────────
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List all active sessions for the current user' })
  async getSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getSessions(user.sub);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/others')
  @ApiOperation({ summary: 'Revoke all sessions except the current one' })
  async revokeOtherSessions(
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogoutDto
  ) {
    return this.authService.revokeOtherSessions(user.sub, dto.refreshToken);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Revoke a specific session by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) sessionId: string
  ) {
    return this.authService.revokeSession(user.sub, sessionId);
  }

  // ── Password Reset ────────────────────────────────────────────────────
  @Public()
  @Post('forgot-password')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @ApiOperation({ summary: 'Request a password reset token (rate limited: 3/min)' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a valid reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @ApiOperation({ summary: 'Change password while authenticated' })
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto
  ) {
    return this.authService.changePassword(user.sub, dto);
  }
}

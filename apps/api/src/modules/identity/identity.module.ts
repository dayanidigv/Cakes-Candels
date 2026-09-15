import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { OrganizationController } from './controllers/organization.controller';
import { BranchController } from './controllers/branch.controller';
import { POSRegisterController } from './controllers/pos-register.controller';
import { RoleController } from './controllers/role.controller';
import { PermissionController } from './controllers/permission.controller';
import { UserController } from './controllers/user.controller';

// Services
import { AuthService } from './services/auth.service';
import { OrganizationService } from './services/organization.service';
import { BranchService } from './services/branch.service';
import { POSRegisterService } from './services/pos-register.service';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { UserService } from './services/user.service';

// Config
import { ConfigService } from '../../config/config.service';

// Guards
import { AuthGuard } from '../../common/guards/auth.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RedisProvider } from '../../common/providers/redis.provider';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: { expiresIn: configService.jwtAccessExpiresIn }
      }),
      inject: [ConfigService]
    })
  ],
  controllers: [
    AuthController,
    OrganizationController,
    BranchController,
    POSRegisterController,
    RoleController,
    PermissionController,
    UserController,
  ],
  providers: [
    // Services
    AuthService,
    OrganizationService,
    BranchService,
    POSRegisterService,
    RoleService,
    PermissionService,
    UserService,
    // Guards
    AuthGuard,
    JwtAuthGuard,
    PermissionsGuard,
    RolesGuard,
    // Shared
    Reflector,
    RedisProvider,
  ],
  exports: [
    AuthService,
    OrganizationService,
    BranchService,
    POSRegisterService,
    RoleService,
    PermissionService,
    UserService,
    AuthGuard,
    JwtAuthGuard,
    PermissionsGuard,
    RolesGuard,
    JwtModule,
    RedisProvider,
  ]
})
export class IdentityModule {}

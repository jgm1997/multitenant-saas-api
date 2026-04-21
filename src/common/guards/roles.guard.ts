import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ROLE_HIERARCHY: Role[] = [Role.MEMBER, Role.ADMIN, Role.OWNER];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('No user found on request');

    const userRoleLevel = ROLE_HIERARCHY.indexOf(user.role);
    const hasPermission = requiredRoles.some(
      (required) => userRoleLevel >= ROLE_HIERARCHY.indexOf(required),
    );
    if (!hasPermission)
      throw new ForbiddenException(
        `Access denied. Required: ${requiredRoles.join(' or ')}, you have: ${user.role}`,
      );
    return true;
  }
}

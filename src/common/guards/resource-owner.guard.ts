import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export const RESOURCE_KEY = 'resource';
export const Resource = (model: string) => SetMetadata(RESOURCE_KEY, model);

@Injectable()
export class ResourceOwnerGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const model = this.reflector.getAllAndOverride<string>(RESOURCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!model) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params.id;

    if ([Role.ADMIN, Role.OWNER].includes(user.role)) return true;

    const resource = await (this.prisma as any)[model].findFirst({
      where: { id: resourceId },
      select: { ownerId: true },
    });
    if (!resource) throw new NotFoundException(`${model} not found`);
    if (resource.ownerId !== user.id)
      throw new ForbiddenException('You do not own this resource');

    return true;
  }
}

import {
  BadRequestException,
  Injectable,
  NestMiddleware,
  NotFoundException,
} from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { tenantStorage } from 'src/common/tenant-context';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const slug = req.headers['x-tenant-slug'] as string;

    if (!slug) throw new BadRequestException('Missing x-tenant-slug header');

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (!tenant) throw new NotFoundException(`Tenant "${slug}" not found`);

    tenantStorage.run({ tenantId: tenant.id, tenantSlug: tenant.slug }, () => {
      next();
    });
  }
}

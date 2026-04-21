import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { getTenantContext } from 'src/common/tenant-context';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    super({ adapter: new PrismaPg(pool) });

    const extendedClient = this.$extends({
      query: {
        user: {
          $allOperations: async ({ operation, args, query }) => {
            const nextArgs = this.applyTenantScope(operation, args);
            return query(nextArgs);
          },
        },
        project: {
          $allOperations: async ({ operation, args, query }) => {
            const nextArgs = this.applyTenantScope(operation, args);
            return query(nextArgs);
          },
        },
      },
    });

    Object.defineProperty(this, 'user', {
      configurable: true,
      get: () => (extendedClient as PrismaClient).user,
    });

    Object.defineProperty(this, 'project', {
      configurable: true,
      get: () => (extendedClient as PrismaClient).project,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  private applyTenantScope(operation: string, args: any) {
    let context;
    try {
      context = getTenantContext();
    } catch {
      return args;
    }

    const { tenantId } = context;
    const scopedArgs = args ?? {};

    if (['findUnique', 'findFirst', 'findMany', 'count'].includes(operation)) {
      scopedArgs.where = { ...scopedArgs.where, tenantId };
    }

    if (operation === 'create') {
      scopedArgs.data = { ...scopedArgs.data, tenantId };
    }

    if (operation === 'createMany') {
      const rows = Array.isArray(scopedArgs.data)
        ? scopedArgs.data
        : scopedArgs.data?.data;

      if (Array.isArray(rows)) {
        const withTenant = rows.map((item: any) => ({ ...item, tenantId }));
        if (Array.isArray(scopedArgs.data)) {
          scopedArgs.data = withTenant;
        } else {
          scopedArgs.data = { ...scopedArgs.data, data: withTenant };
        }
      }
    }

    if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
      scopedArgs.where = {
        ...scopedArgs.where,
        tenantId,
      };
    }

    return scopedArgs;
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { tenantStorage } from 'src/common/tenant-context';

type PrismaArgs = Record<string, unknown>;

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
          $allOperations: ({ operation, args, query }) => {
            const nextArgs = this.applyTenantScope(operation, args);
            return query(nextArgs);
          },
        },
        project: {
          $allOperations: ({ operation, args, query }) => {
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

  private applyTenantScope(operation: string, args: PrismaArgs): PrismaArgs {
    const context = tenantStorage.getStore();
    if (!context) return args;

    const { tenantId } = context;
    const scopedArgs: PrismaArgs = args ?? {};

    if (['findUnique', 'findFirst', 'findMany', 'count'].includes(operation)) {
      scopedArgs['where'] = {
        ...(scopedArgs['where'] as PrismaArgs),
        tenantId,
      };
    }

    if (operation === 'create') {
      scopedArgs['data'] = { ...(scopedArgs['data'] as PrismaArgs), tenantId };
    }

    if (operation === 'createMany') {
      const data = scopedArgs['data'];
      const rows = Array.isArray(data)
        ? data
        : (data as PrismaArgs | undefined)?.['data'];

      if (Array.isArray(rows)) {
        const withTenant = (rows as PrismaArgs[]).map((item) => ({
          ...item,
          tenantId,
        }));
        if (Array.isArray(data)) {
          scopedArgs['data'] = withTenant;
        } else {
          scopedArgs['data'] = { ...(data as PrismaArgs), data: withTenant };
        }
      }
    }

    if (['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)) {
      scopedArgs['where'] = {
        ...(scopedArgs['where'] as PrismaArgs),
        tenantId,
      };
    }

    return scopedArgs;
  }
}

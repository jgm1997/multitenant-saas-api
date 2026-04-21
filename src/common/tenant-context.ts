import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const context = tenantStorage.getStore();
  if (!context)
    throw new Error(
      'Tenant context not found. Are you inside a tenant-scoped request?',
    );
  return context;
}

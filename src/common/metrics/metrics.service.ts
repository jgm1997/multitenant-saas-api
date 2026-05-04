import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, metrics } from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal: Counter;
  private readonly httpRequestDuration: Histogram;
  private readonly activeConnections: Gauge;
  private readonly tenantOperationsTotal: Counter;
  private readonly authAttemptsTotal: Counter;

  constructor() {
    const meter = metrics.getMeter('multitenant-saas-api');

    this.httpRequestsTotal = meter.createCounter('http_requests_total', {
      description: 'Total number of HTTP requests',
    });

    this.httpRequestDuration = meter.createHistogram(
      'http_request_duration_seconds',
      {
        description: 'HTTP request duration in milliseconds',
        unit: 'ms',
      },
    );

    this.activeConnections = meter.createGauge('active_connections', {
      description: 'Number of active connections',
    });

    this.tenantOperationsTotal = meter.createCounter(
      'tenant_operations_total',
      {
        description: 'Total operations per tenant',
      },
    );

    this.authAttemptsTotal = meter.createCounter('auth_attempts_total', {
      description: 'Total authentication attempts',
    });
  }

  recordRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
  ) {
    const labels = { method, path, status_code: statusCode.toString() };
    this.httpRequestsTotal.add(1, labels);
    this.httpRequestDuration.record(durationMs, labels);
  }

  recordTenantOperations(tenantSlug: string, operation: string) {
    this.tenantOperationsTotal.add(1, {
      tenant: tenantSlug,
      operation,
    });
  }

  recordAuthAttempt(success: boolean, tenantSlug: string) {
    this.authAttemptsTotal.add(1, {
      success: success.toString(),
      tenant: tenantSlug,
    });
  }
}

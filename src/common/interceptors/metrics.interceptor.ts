import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

interface HttpError {
  status?: number;
}

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> | Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();
    const path = this.normalizePath(
      (request.route as { path?: string } | undefined)?.path ?? request.url,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<Response>();
          const duration = Date.now() - startTime;
          this.metricsService.recordRequest(
            request.method,
            path,
            response.statusCode,
            duration,
          );
        },
        error: (error: HttpError) => {
          const duration = Date.now() - startTime;
          this.metricsService.recordRequest(
            request.method,
            path,
            error.status ?? 500,
            duration,
          );
        },
      }),
    );
  }

  private normalizePath(path: string): string {
    return path
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
      )
      .replace(/\/\d+/g, '/:id');
  }
}

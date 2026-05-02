import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { Observable, tap } from 'rxjs';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;

          this.metricsService.recordRequest(
            request.method,
            this.normalizePath(request.route?.path || request.url),
            response.statusCode,
            duration,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.metricsService.recordRequest(
            request.method,
            this.normalizePath(request.route?.path || request.url),
            error.status || 500,
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

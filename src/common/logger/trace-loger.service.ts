import { Injectable, LoggerService } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

@Injectable()
export class TraceLoggerService implements LoggerService {
  private formatMessage(
    level: string,
    message: string,
    context?: string,
  ): string {
    const span = trace.getActiveSpan();
    const traceId = span?.spanContext()?.traceId || 'no-trace';
    const spanId = span?.spanContext()?.spanId || 'no-span';

    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      traceId, // ← Link to Jaeger trace
      spanId,
      service: 'multitenant-saas-api',
      environment: process.env.NODE_ENV,
    });
  }

  log(message: string, context?: string) {
    console.log(this.formatMessage('INFO', message, context));
  }

  error(message: string, trace?: string, context?: string) {
    console.error(
      this.formatMessage('ERROR', `${message} ${trace || ''}`, context),
    );
  }

  warn(message: string, context?: string) {
    console.warn(this.formatMessage('WARN', message, context));
  }

  debug(message: string, context?: string) {
    console.debug(this.formatMessage('DEBUG', message, context));
  }
}

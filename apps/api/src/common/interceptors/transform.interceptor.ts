import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const path = request.url || '';

    if (path.endsWith('/health') || path.endsWith('/ready') || path.endsWith('/live')) {
      return next.handle();
    }

    const message = request.customMessage || 'Operation successful';

    return next.handle().pipe(
      map(data => ({
        success: true,
        message,
        data: data ?? null
      }))
    );
  }
}

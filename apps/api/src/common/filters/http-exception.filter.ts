import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { prisma } from '@cc-erp/database';

// Error code map: HTTP status → machine-readable code
const ERROR_CODE_MAP: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  423: 'ACCOUNT_LOCKED',
  429: 'RATE_LIMIT_EXCEEDED',
  500: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected internal error occurred';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as any;

        // If the exception already carries errorCode (our custom exceptions), use it directly
        if (resObj.errorCode) {
          errorCode = resObj.errorCode;
        } else {
          errorCode = ERROR_CODE_MAP[status] ?? 'ERROR';
        }

        if (Array.isArray(resObj.message)) {
          message = resObj.message.join(', ');
        } else if (typeof resObj.message === 'string') {
          message = resObj.message;
        } else {
          message = exception.message;
        }
      } else if (typeof res === 'string') {
        message = res;
        errorCode = ERROR_CODE_MAP[status] ?? 'ERROR';
      }
    } else {
      // Unhandled non-HTTP errors
      message = 'An unexpected internal error occurred';
      errorCode = 'INTERNAL_SERVER_ERROR';
    }

    // Persist error to ErrorLog (best-effort — never throw from here)
    try {
      const userId = (request as any).user?.sub || null;
      if (status >= 500) {
        await prisma.errorLog.create({
          data: {
            message: exception instanceof Error ? exception.message : String(exception),
            stack: exception instanceof Error ? exception.stack ?? null : null,
            path: request.url,
            module: 'API_GATEWAY',
            userId,
          },
        });
      }
    } catch {
      // Silently swallow DB write failures in the filter
    }

    response.status(status).json({
      success: false,
      errorCode,
      message,
      data: null,
    });
  }
}

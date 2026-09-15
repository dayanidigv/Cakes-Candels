import { HttpException } from '@nestjs/common';

export class RateLimitException extends HttpException {
  constructor(message = 'Too many requests. Please slow down.') {
    super(
      {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        message,
        data: null,
      },
      429
    );
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

export class AccountLockedException extends HttpException {
  constructor(message: string) {
    super(
      {
        success: false,
        errorCode: 'ACCOUNT_LOCKED',
        message,
        data: null,
      },
      423
    );
  }
}

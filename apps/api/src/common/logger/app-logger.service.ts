import { LoggerService, Injectable } from '@nestjs/common';
import { prisma, LogLevel } from '@cc-erp/database';

@Injectable()
export class AppLogger implements LoggerService {
  log(message: any, ...optionalParams: any[]) {
    console.log(`[INFO] ${message}`, ...optionalParams);
  }

  error(message: any, stack?: string, context?: string) {
    console.error(`[ERROR] ${message}`, stack);
    this.saveToDb(LogLevel.ERROR, message, context || stack);
  }

  warn(message: any, ...optionalParams: any[]) {
    console.warn(`[WARN] ${message}`, ...optionalParams);
    this.saveToDb(LogLevel.WARN, message);
  }

  debug?(message: any, ...optionalParams: any[]) {
    console.debug(`[DEBUG] ${message}`, ...optionalParams);
  }

  verbose?(message: any, ...optionalParams: any[]) {
    console.log(`[VERBOSE] ${message}`, ...optionalParams);
  }

  private async saveToDb(level: LogLevel, message: string, context?: string) {
    try {
      await prisma.systemLog.create({
        data: {
          level,
          message,
          context: context || null
        }
      });
    } catch (e) {
      console.error('[AppLogger] Failed to persist system log to database', e);
    }
  }
}

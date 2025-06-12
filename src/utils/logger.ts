import winston from 'winston';
import path from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return `${timestamp} [${level}]: ${message}${stack ? '\n' + stack : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'error.log'),
          level: 'error'
        }),
        new winston.transports.File({
          filename: path.join(process.cwd(), 'logs', 'combined.log')
        })
      ]
    });

    // Create logs directory if it doesn't exist
    const fs = require('fs');
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  info(message: string, ...args: any[]): void {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logger.warn(message, ...args);
  }

  error(message: string, error?: any, ...args: any[]): void {
    this.logger.error(message, error, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.logger.debug(message, ...args);
  }

  verbose(message: string, ...args: any[]): void {
    this.logger.verbose(message, ...args);
  }

  // Security logging for sensitive operations
  security(event: string, userId: string, metadata?: any): void {
    this.logger.info(`[SECURITY] ${event}`, {
      userId,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  // Audit logging for admin operations
  audit(action: string, adminId: string, targetId?: string, metadata?: any): void {
    this.logger.info(`[AUDIT] ${action}`, {
      adminId,
      targetId,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }
}
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor() {
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(({ timestamp, level, message, stack }) => {
                return `${timestamp} [${level}]: ${message}${stack ? '\n' + stack : ''}`;
            })),
            transports: [
                new winston_1.default.transports.Console(),
                new winston_1.default.transports.File({
                    filename: path_1.default.join(process.cwd(), 'logs', 'error.log'),
                    level: 'error'
                }),
                new winston_1.default.transports.File({
                    filename: path_1.default.join(process.cwd(), 'logs', 'combined.log')
                })
            ]
        });
        // Create logs directory if it doesn't exist
        const fs = require('fs');
        const logsDir = path_1.default.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }
    info(message, ...args) {
        this.logger.info(message, ...args);
    }
    warn(message, ...args) {
        this.logger.warn(message, ...args);
    }
    error(message, error, ...args) {
        this.logger.error(message, error, ...args);
    }
    debug(message, ...args) {
        this.logger.debug(message, ...args);
    }
    verbose(message, ...args) {
        this.logger.verbose(message, ...args);
    }
    // Security logging for sensitive operations
    security(event, userId, metadata) {
        this.logger.info(`[SECURITY] ${event}`, {
            userId,
            timestamp: new Date().toISOString(),
            ...metadata
        });
    }
    // Audit logging for admin operations
    audit(action, adminId, targetId, metadata) {
        this.logger.info(`[AUDIT] ${action}`, {
            adminId,
            targetId,
            timestamp: new Date().toISOString(),
            ...metadata
        });
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map
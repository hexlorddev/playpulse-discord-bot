export declare class Logger {
    private logger;
    constructor();
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, error?: any, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    verbose(message: string, ...args: any[]): void;
    security(event: string, userId: string, metadata?: any): void;
    audit(action: string, adminId: string, targetId?: string, metadata?: any): void;
}
//# sourceMappingURL=logger.d.ts.map
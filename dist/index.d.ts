import { ExtendedClient } from './types';
import { Logger } from './utils/logger';
import { DatabaseManager } from './database/manager';
import { RateLimiter } from './middleware/rateLimiter';
import { SecurityManager } from './services/security';
declare class PlaypulseBot {
    private client;
    private logger;
    private database;
    private rateLimiter;
    private security;
    constructor();
    start(): Promise<void>;
    private loadCommands;
    private loadEvents;
    getClient(): ExtendedClient;
    getLogger(): Logger;
    getDatabase(): DatabaseManager;
    getRateLimiter(): RateLimiter;
    getSecurity(): SecurityManager;
}
export { PlaypulseBot };
//# sourceMappingURL=index.d.ts.map
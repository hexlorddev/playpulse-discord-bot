import { CommandInteraction } from 'discord.js';
export declare class RateLimiter {
    private globalLimiter;
    private userLimiter;
    private guildLimiter;
    private premiumLimiter;
    constructor();
    checkRateLimit(interaction: CommandInteraction): Promise<{
        allowed: boolean;
        retryAfter?: number;
        reason?: string;
    }>;
    private isPremiumUser;
    checkCriticalOperationLimit(userId: string): Promise<{
        allowed: boolean;
        retryAfter?: number;
    }>;
    checkAuthLimit(userId: string): Promise<{
        allowed: boolean;
        retryAfter?: number;
    }>;
    resetUserLimit(userId: string): Promise<void>;
    getUserLimitStatus(userId: string): Promise<{
        remainingPoints: number;
        totalHits: number;
        msBeforeNext: number;
    }>;
}
//# sourceMappingURL=rateLimiter.d.ts.map
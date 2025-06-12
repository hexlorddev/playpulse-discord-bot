"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
class RateLimiter {
    constructor() {
        // Global rate limiter (applies to all users)
        this.globalLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
            keyPrefix: 'global',
            points: 100, // Number of requests
            duration: 60, // Per 60 seconds
        });
        // User-specific rate limiter
        this.userLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
            keyPrefix: 'user',
            points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10'),
            duration: parseInt(process.env.RATE_LIMIT_WINDOW || '60000') / 1000,
        });
        // Guild-specific rate limiter
        this.guildLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
            keyPrefix: 'guild',
            points: 50, // Number of requests per guild
            duration: 60, // Per 60 seconds
        });
        // Premium users get higher limits
        this.premiumLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
            keyPrefix: 'premium',
            points: 25, // Higher limit for premium users
            duration: 60,
        });
    }
    async checkRateLimit(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        try {
            // Check global rate limit first
            await this.globalLimiter.consume('global');
            // Check guild rate limit
            if (guildId) {
                await this.guildLimiter.consume(guildId);
            }
            // Check if user is premium
            const isPremium = await this.isPremiumUser(interaction);
            if (isPremium) {
                await this.premiumLimiter.consume(userId);
            }
            else {
                await this.userLimiter.consume(userId);
            }
            return { allowed: true };
        }
        catch (rateLimiterRes) {
            // Rate limit exceeded
            const retryAfter = Math.round(rateLimiterRes.msBeforeNext / 1000);
            return {
                allowed: false,
                retryAfter,
                reason: 'Rate limit exceeded. Please try again later.'
            };
        }
    }
    async isPremiumUser(interaction) {
        if (!interaction.guild || !interaction.member)
            return false;
        const member = interaction.member;
        const premiumRoleId = process.env.PREMIUM_ROLE_ID;
        if (!premiumRoleId)
            return false;
        return member.roles.cache.has(premiumRoleId);
    }
    // Special rate limiter for critical operations (server creation, deletion, etc.)
    async checkCriticalOperationLimit(userId) {
        const criticalLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
            keyPrefix: 'critical',
            points: 3, // Only 3 critical operations per hour
            duration: 3600, // 1 hour
        });
        try {
            await criticalLimiter.consume(userId);
            return { allowed: true };
        }
        catch (rateLimiterRes) {
            const retryAfter = Math.round(rateLimiterRes.msBeforeNext / 1000);
            return {
                allowed: false,
                retryAfter
            };
        }
    }
    // Anti-abuse rate limiter for failed authentication attempts
    async checkAuthLimit(userId) {
        const authLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
            keyPrefix: 'auth',
            points: 5, // 5 failed attempts
            duration: 900, // 15 minutes
        });
        try {
            await authLimiter.consume(userId);
            return { allowed: true };
        }
        catch (rateLimiterRes) {
            const retryAfter = Math.round(rateLimiterRes.msBeforeNext / 1000);
            return {
                allowed: false,
                retryAfter
            };
        }
    }
    // Reset rate limit for a specific user (admin function)
    async resetUserLimit(userId) {
        await this.userLimiter.delete(userId);
        await this.premiumLimiter.delete(userId);
    }
    // Get current rate limit status for a user
    async getUserLimitStatus(userId) {
        const res = await this.userLimiter.get(userId);
        if (!res) {
            return {
                remainingPoints: 10,
                totalHits: 0,
                msBeforeNext: 0
            };
        }
        return {
            remainingPoints: res.remainingPoints || 0,
            totalHits: res.totalHits || 0,
            msBeforeNext: res.msBeforeNext || 0
        };
    }
}
exports.RateLimiter = RateLimiter;
//# sourceMappingURL=rateLimiter.js.map
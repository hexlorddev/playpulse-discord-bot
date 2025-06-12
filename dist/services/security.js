"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityManager = void 0;
const discord_js_1 = require("discord.js");
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const manager_1 = require("../database/manager");
const logger_1 = require("../utils/logger");
class SecurityManager {
    constructor() {
        this.db = new manager_1.DatabaseManager();
        this.logger = new logger_1.Logger();
    }
    // Generate 2FA secret for user
    async generate2FASecret(userId) {
        const secret = speakeasy_1.default.generateSecret({
            name: `Playpulse Bot (${userId})`,
            issuer: 'Playpulse Hosting'
        });
        // Generate QR code
        const qrCode = await qrcode_1.default.toDataURL(secret.otpauth_url);
        // Generate backup codes
        const backupCodes = this.generateBackupCodes();
        return {
            secret: secret.base32,
            qrCode,
            backupCodes
        };
    }
    // Verify 2FA token
    verify2FAToken(secret, token) {
        return speakeasy_1.default.totp.verify({
            secret,
            encoding: 'base32',
            token,
            window: 2 // Allow 2 time steps (60 seconds) variance
        });
    }
    // Generate backup codes for 2FA
    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            const code = Math.random().toString(36).substring(2, 10).toUpperCase();
            codes.push(code);
        }
        return codes;
    }
    // Hash API key for storage
    async hashApiKey(apiKey) {
        const saltRounds = 12;
        return bcryptjs_1.default.hash(apiKey, saltRounds);
    }
    // Verify API key
    async verifyApiKey(apiKey, hashedKey) {
        return bcryptjs_1.default.compare(apiKey, hashedKey);
    }
    // Generate JWT for secure operations
    generateSecureToken(userId, operation, expiresIn = '15m') {
        const payload = {
            userId,
            operation,
            timestamp: Date.now()
        };
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET not configured');
        }
        return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
    }
    // Verify JWT token
    verifySecureToken(token) {
        try {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET not configured');
            }
            const payload = jsonwebtoken_1.default.verify(token, secret);
            return {
                userId: payload.userId,
                operation: payload.operation,
                timestamp: payload.timestamp
            };
        }
        catch (error) {
            return null;
        }
    }
    // Log security event
    async logSecurityEvent(event) {
        await this.db.logSecurityEvent(event);
        // Send to security webhook if configured
        if (process.env.SECURITY_WEBHOOK_URL) {
            await this.sendSecurityAlert(event);
        }
        this.logger.security(event.event, event.userId, event.metadata);
    }
    // Send security alert to webhook
    async sendSecurityAlert(event) {
        try {
            const axios = require('axios');
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('🚨 Security Alert')
                .setDescription(`**Event:** ${event.event}`)
                .addFields({ name: 'User ID', value: event.userId, inline: true }, { name: 'IP Address', value: event.ip || 'Unknown', inline: true }, { name: 'Timestamp', value: new Date(event.timestamp).toISOString(), inline: true })
                .setColor(0xFF0000)
                .setTimestamp();
            if (event.metadata && Object.keys(event.metadata).length > 0) {
                embed.addFields({
                    name: 'Additional Info',
                    value: '```json\n' + JSON.stringify(event.metadata, null, 2) + '\n```'
                });
            }
            await axios.post(process.env.SECURITY_WEBHOOK_URL, {
                embeds: [embed.toJSON()]
            });
        }
        catch (error) {
            this.logger.error('Failed to send security alert:', error);
        }
    }
    // Check if user requires 2FA for operation
    async requires2FA(userId, operation) {
        const user = await this.db.getUser(userId);
        if (!user || !user.twoFactorEnabled)
            return false;
        // Operations that always require 2FA
        const critical2FAOperations = [
            'create-server',
            'delete-server',
            'change-plan',
            'api-access',
            'security-settings'
        ];
        return critical2FAOperations.includes(operation);
    }
    // Verify user has completed 2FA for current session
    async verify2FASession(interaction, operation) {
        const userId = interaction.user.id;
        if (!await this.requires2FA(userId, operation)) {
            return true; // 2FA not required
        }
        // Check if user has valid 2FA session token
        const sessionToken = await this.getUser2FASession(userId);
        if (!sessionToken)
            return false;
        const tokenData = this.verifySecureToken(sessionToken);
        if (!tokenData || tokenData.userId !== userId)
            return false;
        // Check if token is for the same operation or general auth
        if (tokenData.operation !== operation && tokenData.operation !== 'general-auth') {
            return false;
        }
        return true;
    }
    // Get user's current 2FA session (this would be stored in memory/redis in production)
    async getUser2FASession(userId) {
        // In production, this would check Redis/memory store
        // For now, return null to force 2FA verification
        return null;
    }
    // Create 2FA challenge embed
    create2FAChallenge(userId, operation) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🔐 Two-Factor Authentication Required')
            .setDescription(`This operation requires 2FA verification.`)
            .addFields({ name: 'Operation', value: operation, inline: true }, { name: 'User', value: `<@${userId}>`, inline: true })
            .setColor(0xFFA500) // Orange color
            .setFooter({ text: 'Enter your 6-digit authenticator code' })
            .setTimestamp();
        return embed;
    }
    // Validate IP address (basic validation)
    isValidIP(ip) {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        return ipv4Regex.test(ip) || ipv6Regex.test(ip);
    }
    // Get user's IP from interaction (if available)
    getUserIP(interaction) {
        // Discord doesn't provide real IP addresses for privacy
        // This would be handled by your API/proxy layer
        return 'Discord-Hidden';
    }
    // Check for suspicious activity patterns
    async checkSuspiciousActivity(userId, operation) {
        // Get recent security events for user
        // This is a simplified implementation
        const riskScore = 0; // Calculate based on various factors
        if (riskScore > 0.7) {
            return {
                suspicious: true,
                reason: 'High risk activity pattern detected',
                riskScore
            };
        }
        return {
            suspicious: false,
            riskScore
        };
    }
    // Create security summary embed for admin
    createSecuritySummaryEmbed(userId, events) {
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🛡️ Security Summary')
            .setDescription(`Security events for <@${userId}>`)
            .setColor(0x0099FF)
            .setTimestamp();
        if (events.length === 0) {
            embed.addFields({ name: 'Status', value: 'No recent security events' });
        }
        else {
            const recentEvents = events.slice(0, 5);
            const eventList = recentEvents.map(event => `• **${event.event}** - ${new Date(event.timestamp).toLocaleString()}`).join('\n');
            embed.addFields({ name: 'Recent Events', value: eventList }, { name: 'Total Events', value: events.length.toString(), inline: true });
        }
        return embed;
    }
}
exports.SecurityManager = SecurityManager;
//# sourceMappingURL=security.js.map
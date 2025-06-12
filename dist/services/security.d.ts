import { CommandInteraction, EmbedBuilder } from 'discord.js';
import { SecurityEvent } from '../types';
export declare class SecurityManager {
    private db;
    private logger;
    constructor();
    generate2FASecret(userId: string): Promise<{
        secret: string;
        qrCode: string;
        backupCodes: string[];
    }>;
    verify2FAToken(secret: string, token: string): boolean;
    private generateBackupCodes;
    hashApiKey(apiKey: string): Promise<string>;
    verifyApiKey(apiKey: string, hashedKey: string): Promise<boolean>;
    generateSecureToken(userId: string, operation: string, expiresIn?: string): string;
    verifySecureToken(token: string): {
        userId: string;
        operation: string;
        timestamp: number;
    } | null;
    logSecurityEvent(event: SecurityEvent): Promise<void>;
    private sendSecurityAlert;
    requires2FA(userId: string, operation: string): Promise<boolean>;
    verify2FASession(interaction: CommandInteraction, operation: string): Promise<boolean>;
    private getUser2FASession;
    create2FAChallenge(userId: string, operation: string): EmbedBuilder;
    isValidIP(ip: string): boolean;
    getUserIP(interaction: CommandInteraction): string;
    checkSuspiciousActivity(userId: string, operation: string): Promise<{
        suspicious: boolean;
        reason?: string;
        riskScore: number;
    }>;
    createSecuritySummaryEmbed(userId: string, events: SecurityEvent[]): EmbedBuilder;
}
//# sourceMappingURL=security.d.ts.map
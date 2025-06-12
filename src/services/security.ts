import { CommandInteraction, EmbedBuilder, User } from 'discord.js';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DatabaseManager } from '../database/manager';
import { Logger } from '../utils/logger';
import { SecurityEvent } from '../types';

export class SecurityManager {
  private db: DatabaseManager;
  private logger: Logger;
  
  constructor() {
    this.db = new DatabaseManager();
    this.logger = new Logger();
  }

  // Generate 2FA secret for user
  async generate2FASecret(userId: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const secret = speakeasy.generateSecret({
      name: `Playpulse Bot (${userId})`,
      issuer: 'Playpulse Ultimate'
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    return {
      secret: secret.base32!,
      qrCode,
      backupCodes
    };
  }

  // Verify 2FA token
  verify2FAToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps (60 seconds) variance
    });
  }

  // Generate backup codes for 2FA
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  // Hash API key for storage
  async hashApiKey(apiKey: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(apiKey, saltRounds);
  }

  // Verify API key
  async verifyApiKey(apiKey: string, hashedKey: string): Promise<boolean> {
    return bcrypt.compare(apiKey, hashedKey);
  }

  // Generate JWT for secure operations
  generateSecureToken(userId: string, operation: string, expiresIn: string = '15m'): string {
    const payload = {
      userId,
      operation,
      timestamp: Date.now()
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    return jwt.sign(payload, secret, { expiresIn });
  }

  // Verify JWT token
  verifySecureToken(token: string): { userId: string; operation: string; timestamp: number } | null {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET not configured');
      }
      const payload = jwt.verify(token, secret) as any;
      return {
        userId: payload.userId,
        operation: payload.operation,
        timestamp: payload.timestamp
      };
    } catch (error) {
      return null;
    }
  }

  // Log security event
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    await this.db.logSecurityEvent(event);
    
    // Send to security webhook if configured
    if (process.env.SECURITY_WEBHOOK_URL) {
      await this.sendSecurityAlert(event);
    }

    this.logger.security(event.event, event.userId, event.metadata);
  }

  // Send security alert to webhook
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      const axios = require('axios');
      
      const embed = new EmbedBuilder()
        .setTitle('🚨 Security Alert')
        .setDescription(`**Event:** ${event.event}`)
        .addFields(
          { name: 'User ID', value: event.userId, inline: true },
          { name: 'IP Address', value: event.ip || 'Unknown', inline: true },
          { name: 'Timestamp', value: new Date(event.timestamp).toISOString(), inline: true }
        )
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
    } catch (error) {
      this.logger.error('Failed to send security alert:', error);
    }
  }

  // Check if user requires 2FA for operation
  async requires2FA(userId: string, operation: string): Promise<boolean> {
    const user = await this.db.getUser(userId);
    if (!user || !user.twoFactorEnabled) return false;

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
  async verify2FASession(interaction: CommandInteraction, operation: string): Promise<boolean> {
    const userId = interaction.user.id;
    
    if (!await this.requires2FA(userId, operation)) {
      return true; // 2FA not required
    }

    // Check if user has valid 2FA session token
    const sessionToken = await this.getUser2FASession(userId);
    if (!sessionToken) return false;

    const tokenData = this.verifySecureToken(sessionToken);
    if (!tokenData || tokenData.userId !== userId) return false;

    // Check if token is for the same operation or general auth
    if (tokenData.operation !== operation && tokenData.operation !== 'general-auth') {
      return false;
    }

    return true;
  }

  // Get user's current 2FA session (this would be stored in memory/redis in production)
  private async getUser2FASession(userId: string): Promise<string | null> {
    // In production, this would check Redis/memory store
    // For now, return null to force 2FA verification
    return null;
  }

  // Create 2FA challenge embed
  create2FAChallenge(userId: string, operation: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('🔐 Two-Factor Authentication Required')
      .setDescription(`This operation requires 2FA verification.`)
      .addFields(
        { name: 'Operation', value: operation, inline: true },
        { name: 'User', value: `<@${userId}>`, inline: true }
      )
      .setColor(0xFFA500) // Orange color
      .setFooter({ text: 'Enter your 6-digit authenticator code' })
      .setTimestamp();

    return embed;
  }

  // Validate IP address (basic validation)
  isValidIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  // Get user's IP from interaction (if available)
  getUserIP(interaction: CommandInteraction): string {
    // Discord doesn't provide real IP addresses for privacy
    // This would be handled by your API/proxy layer
    return 'Discord-Hidden';
  }

  // Check for suspicious activity patterns
  async checkSuspiciousActivity(userId: string, operation: string): Promise<{ 
    suspicious: boolean; 
    reason?: string; 
    riskScore: number 
  }> {
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
  createSecuritySummaryEmbed(userId: string, events: SecurityEvent[]): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Security Summary')
      .setDescription(`Security events for <@${userId}>`)
      .setColor(0x0099FF)
      .setTimestamp();

    if (events.length === 0) {
      embed.addFields({ name: 'Status', value: 'No recent security events' });
    } else {
      const recentEvents = events.slice(0, 5);
      const eventList = recentEvents.map(event => 
        `• **${event.event}** - ${new Date(event.timestamp).toLocaleString()}`
      ).join('\n');

      embed.addFields(
        { name: 'Recent Events', value: eventList },
        { name: 'Total Events', value: events.length.toString(), inline: true }
      );
    }

    return embed;
  }
}
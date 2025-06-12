import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { UserData, ServerData, TicketData, SecurityEvent, BillingInfo } from '../types';

export class DatabaseManager {
  private db: sqlite3.Database;
  private initialized = false;

  constructor() {
    const dbPath = process.env.DATABASE_PATH || './data/playpulse.db';
    const dbDir = path.dirname(dbPath);
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const runAsync = promisify(this.db.run.bind(this.db));

    // Create tables
    await runAsync(`
      CREATE TABLE IF NOT EXISTS users (
        discord_id TEXT PRIMARY KEY,
        email TEXT,
        panel_user_id TEXT,
        subscription_tier TEXT DEFAULT 'free',
        two_factor_enabled BOOLEAN DEFAULT 0,
        api_key_hash TEXT,
        last_login DATETIME,
        total_servers INTEGER DEFAULT 0,
        monthly_usage INTEGER DEFAULT 0,
        notifications BOOLEAN DEFAULT 1,
        auto_renewal BOOLEAN DEFAULT 1,
        security_alerts BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        plan TEXT NOT NULL,
        region TEXT NOT NULL,
        status TEXT DEFAULT 'offline',
        ip TEXT,
        port INTEGER,
        user_id TEXT NOT NULL,
        server_type TEXT DEFAULT 'minecraft',
        auto_start BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_reboot DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (discord_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'medium',
        assigned_to TEXT,
        tags TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (discord_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        event TEXT NOT NULL,
        ip TEXT,
        user_agent TEXT,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (discord_id)
      )
    `);

    await runAsync(`
      CREATE TABLE IF NOT EXISTS billing_info (
        user_id TEXT PRIMARY KEY,
        subscription_id TEXT,
        plan_name TEXT,
        status TEXT DEFAULT 'active',
        next_billing_date DATETIME,
        amount REAL,
        currency TEXT DEFAULT 'USD',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (discord_id)
      )
    `);

    // Create indexes
    await runAsync('CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers (user_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets (user_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets (status)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events (user_id)');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events (timestamp)');

    this.initialized = true;
  }

  // User operations
  async createUser(userData: Partial<UserData>): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO users (
        discord_id, email, panel_user_id, subscription_tier,
        two_factor_enabled, notifications, auto_renewal, security_alerts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(query, [
        userData.discordId,
        userData.email,
        userData.panelUserId,
        userData.subscriptionTier || 'free',
        userData.twoFactorEnabled ? 1 : 0,
        userData.settings?.notifications ? 1 : 0,
        userData.settings?.autoRenewal ? 1 : 0,
        userData.settings?.securityAlerts ? 1 : 0
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getUser(discordId: string): Promise<UserData | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE discord_id = ?',
        [discordId],
        (err, row: any) => {
          if (err) reject(err);
          else if (!row) resolve(null);
          else {
            resolve({
              discordId: row.discord_id,
              email: row.email,
              panelUserId: row.panel_user_id,
              subscriptionTier: row.subscription_tier,
              twoFactorEnabled: row.two_factor_enabled === 1,
              apiKeyHash: row.api_key_hash,
              lastLogin: row.last_login ? new Date(row.last_login) : undefined,
              totalServers: row.total_servers,
              monthlyUsage: row.monthly_usage,
              settings: {
                notifications: row.notifications === 1,
                autoRenewal: row.auto_renewal === 1,
                securityAlerts: row.security_alerts === 1
              }
            });
          }
        }
      );
    });
  }

  // Server operations
  async createServer(serverData: ServerData): Promise<void> {
    const query = `
      INSERT INTO servers (
        id, name, plan, region, status, ip, port, user_id, server_type, auto_start
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(query, [
        serverData.id,
        serverData.name,
        serverData.plan,
        serverData.region,
        serverData.status,
        serverData.ip,
        serverData.port,
        serverData.userId,
        'minecraft', // default type
        1 // auto_start default
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getUserServers(userId: string): Promise<ServerData[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
        (err, rows: any[]) => {
          if (err) reject(err);
          else {
            const servers = rows.map(row => ({
              id: row.id,
              name: row.name,
              plan: row.plan,
              region: row.region,
              status: row.status,
              ip: row.ip,
              port: row.port,
              userId: row.user_id,
              createdAt: new Date(row.created_at),
              lastReboot: row.last_reboot ? new Date(row.last_reboot) : undefined
            }));
            resolve(servers);
          }
        }
      );
    });
  }

  // Ticket operations
  async createTicket(ticketData: TicketData): Promise<void> {
    const query = `
      INSERT INTO tickets (
        id, user_id, guild_id, channel_id, category, status, priority, tags, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(query, [
        ticketData.id,
        ticketData.userId,
        ticketData.guildId,
        ticketData.channelId,
        ticketData.category,
        ticketData.status,
        ticketData.priority,
        JSON.stringify(ticketData.tags),
        JSON.stringify(ticketData.metadata)
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Security event logging
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const query = `
      INSERT INTO security_events (user_id, event, ip, user_agent, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(query, [
        event.userId,
        event.event,
        event.ip,
        event.userAgent,
        JSON.stringify(event.metadata)
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
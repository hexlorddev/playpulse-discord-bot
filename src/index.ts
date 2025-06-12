import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { BotCommand, ExtendedClient } from './types';
import { Logger } from './utils/logger';
import { DatabaseManager } from './database/manager';
import { RateLimiter } from './middleware/rateLimiter';
import { SecurityManager } from './services/security';

// Load environment variables
config();

class PlaypulseBot {
  private client: ExtendedClient;
  private logger: Logger;
  private database: DatabaseManager;
  private rateLimiter: RateLimiter;
  private security: SecurityManager;

  constructor() {
    // Initialize Discord client with necessary intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
      ]
    }) as ExtendedClient;

    this.client.commands = new Collection();
    this.logger = new Logger();
    this.database = new DatabaseManager();
    this.rateLimiter = new RateLimiter();
    this.security = new SecurityManager();
  }

  async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Playpulse Discord Bot...');
      
      // Initialize database
      await this.database.initialize();
      this.logger.info('✅ Database initialized');

      // Load commands
      await this.loadCommands();
      this.logger.info('✅ Commands loaded');

      // Load events
      await this.loadEvents();
      this.logger.info('✅ Events loaded');

      // Login to Discord
      await this.client.login(process.env.DISCORD_TOKEN);
      this.logger.info('✅ Bot logged in successfully');

    } catch (error) {
      this.logger.error('❌ Failed to start bot:', error);
      process.exit(1);
    }
  }

  private async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, 'commands');
    const commandCategories = fs.readdirSync(commandsPath);

    for (const category of commandCategories) {
      const categoryPath = path.join(commandsPath, category);
      const commandFiles = fs.readdirSync(categoryPath).filter(file => 
        file.endsWith('.ts') || file.endsWith('.js')
      );

      for (const file of commandFiles) {
        const filePath = path.join(categoryPath, file);
        const command: BotCommand = require(filePath);

        if ('data' in command && 'execute' in command) {
          this.client.commands.set(command.data.name, command);
          this.logger.debug(`Loaded command: ${command.data.name}`);
        } else {
          this.logger.warn(`Command at ${filePath} is missing required properties`);
        }
      }
    }
  }

  private async loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => 
      file.endsWith('.ts') || file.endsWith('.js')
    );

    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);

      if (event.once) {
        this.client.once(event.name, (...args) => event.execute(...args, this));
      } else {
        this.client.on(event.name, (...args) => event.execute(...args, this));
      }
      
      this.logger.debug(`Loaded event: ${event.name}`);
    }
  }

  getClient(): ExtendedClient {
    return this.client;
  }

  getLogger(): Logger {
    return this.logger;
  }

  getDatabase(): DatabaseManager {
    return this.database;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  getSecurity(): SecurityManager {
    return this.security;
  }
}

// Start the bot
const bot = new PlaypulseBot();
bot.start();

// Graceful shutdown
process.on('SIGINT', () => {
  bot.getLogger().info('🛑 Received SIGINT, shutting down gracefully...');
  bot.getClient().destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.getLogger().info('🛑 Received SIGTERM, shutting down gracefully...');
  bot.getClient().destroy();
  process.exit(0);
});

export { PlaypulseBot };
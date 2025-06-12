"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaypulseBot = void 0;
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("./utils/logger");
const manager_1 = require("./database/manager");
const rateLimiter_1 = require("./middleware/rateLimiter");
const security_1 = require("./services/security");
// Load environment variables
(0, dotenv_1.config)();
class PlaypulseBot {
    constructor() {
        // Initialize Discord client with necessary intents
        this.client = new discord_js_1.Client({
            intents: [
                discord_js_1.GatewayIntentBits.Guilds,
                discord_js_1.GatewayIntentBits.GuildMessages,
                discord_js_1.GatewayIntentBits.MessageContent,
                discord_js_1.GatewayIntentBits.GuildMembers,
                discord_js_1.GatewayIntentBits.DirectMessages
            ]
        });
        this.client.commands = new discord_js_1.Collection();
        this.logger = new logger_1.Logger();
        this.database = new manager_1.DatabaseManager();
        this.rateLimiter = new rateLimiter_1.RateLimiter();
        this.security = new security_1.SecurityManager();
    }
    async start() {
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
        }
        catch (error) {
            this.logger.error('❌ Failed to start bot:', error);
            process.exit(1);
        }
    }
    async loadCommands() {
        const commandsPath = path_1.default.join(__dirname, 'commands');
        const commandCategories = fs_1.default.readdirSync(commandsPath);
        for (const category of commandCategories) {
            const categoryPath = path_1.default.join(commandsPath, category);
            const commandFiles = fs_1.default.readdirSync(categoryPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path_1.default.join(categoryPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    this.client.commands.set(command.data.name, command);
                    this.logger.debug(`Loaded command: ${command.data.name}`);
                }
                else {
                    this.logger.warn(`Command at ${filePath} is missing required properties`);
                }
            }
        }
    }
    async loadEvents() {
        const eventsPath = path_1.default.join(__dirname, 'events');
        const eventFiles = fs_1.default.readdirSync(eventsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));
        for (const file of eventFiles) {
            const filePath = path_1.default.join(eventsPath, file);
            const event = require(filePath);
            if (event.once) {
                this.client.once(event.name, (...args) => event.execute(...args, this));
            }
            else {
                this.client.on(event.name, (...args) => event.execute(...args, this));
            }
            this.logger.debug(`Loaded event: ${event.name}`);
        }
    }
    getClient() {
        return this.client;
    }
    getLogger() {
        return this.logger;
    }
    getDatabase() {
        return this.database;
    }
    getRateLimiter() {
        return this.rateLimiter;
    }
    getSecurity() {
        return this.security;
    }
}
exports.PlaypulseBot = PlaypulseBot;
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
//# sourceMappingURL=index.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = void 0;
const discord_js_1 = require("discord.js");
const dotenv_1 = require("dotenv");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Load environment variables
(0, dotenv_1.config)();
const commands = [];
exports.commands = commands;
// Function to load commands from all subdirectories
function loadCommandsFromDirectory(dir) {
    const items = fs_1.default.readdirSync(dir);
    for (const item of items) {
        const itemPath = path_1.default.join(dir, item);
        const stat = fs_1.default.statSync(itemPath);
        if (stat.isDirectory()) {
            // Recursively load from subdirectories
            loadCommandsFromDirectory(itemPath);
        }
        else if (item.endsWith('.ts') || item.endsWith('.js')) {
            // Load command file
            try {
                const command = require(itemPath);
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                    console.log(`✅ Loaded command: ${command.data.name}`);
                }
                else {
                    console.log(`⚠️  Command at ${itemPath} is missing required properties`);
                }
            }
            catch (error) {
                console.error(`❌ Error loading command at ${itemPath}:`, error);
            }
        }
    }
}
// Load all commands
const commandsPath = path_1.default.join(__dirname, 'commands');
if (fs_1.default.existsSync(commandsPath)) {
    loadCommandsFromDirectory(commandsPath);
}
else {
    console.error('❌ Commands directory not found');
    process.exit(1);
}
console.log(`📦 Loaded ${commands.length} commands`);
// Construct and prepare an instance of the REST module
const rest = new discord_js_1.REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
// Deploy commands
(async () => {
    try {
        console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);
        // Check if we should deploy globally or to a specific guild
        const clientId = process.env.DISCORD_CLIENT_ID;
        const guildId = process.env.ADMIN_GUILD_ID;
        let data;
        if (guildId) {
            // Deploy to specific guild (faster for development)
            console.log(`🎯 Deploying to guild: ${guildId}`);
            data = await rest.put(discord_js_1.Routes.applicationGuildCommands(clientId, guildId), { body: commands });
        }
        else {
            // Deploy globally (takes up to 1 hour to propagate)
            console.log('🌍 Deploying globally');
            data = await rest.put(discord_js_1.Routes.applicationCommands(clientId), { body: commands });
        }
        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
        // Log deployed commands
        console.log('\n📋 Deployed Commands:');
        commands.forEach((cmd, index) => {
            console.log(`${index + 1}. /${cmd.name} - ${cmd.description}`);
        });
    }
    catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
})();
//# sourceMappingURL=deploy-commands.js.map
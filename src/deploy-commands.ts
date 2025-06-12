import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

const commands: any[] = [];

// Function to load commands from all subdirectories
function loadCommandsFromDirectory(dir: string) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      // Recursively load from subdirectories
      loadCommandsFromDirectory(itemPath);
    } else if (item.endsWith('.ts') || item.endsWith('.js')) {
      // Load command file
      try {
        const command = require(itemPath);
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON());
          console.log(`✅ Loaded command: ${command.data.name}`);
        } else {
          console.log(`⚠️  Command at ${itemPath} is missing required properties`);
        }
      } catch (error) {
        console.error(`❌ Error loading command at ${itemPath}:`, error);
      }
    }
  }
}

// Load all commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  loadCommandsFromDirectory(commandsPath);
} else {
  console.error('❌ Commands directory not found');
  process.exit(1);
}

console.log(`📦 Loaded ${commands.length} commands`);

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// Deploy commands
(async () => {
  try {
    console.log(`🚀 Started refreshing ${commands.length} application (/) commands.`);

    // Check if we should deploy globally or to a specific guild
    const clientId = process.env.DISCORD_CLIENT_ID!;
    const guildId = process.env.ADMIN_GUILD_ID;

    let data: any;
    
    if (guildId) {
      // Deploy to specific guild (faster for development)
      console.log(`🎯 Deploying to guild: ${guildId}`);
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
    } else {
      // Deploy globally (takes up to 1 hour to propagate)
      console.log('🌍 Deploying globally');
      data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
    }

    console.log(`✅ Successfully reloaded ${(data as any).length} application (/) commands.`);

    // Log deployed commands
    console.log('\n📋 Deployed Commands:');
    commands.forEach((cmd, index) => {
      console.log(`${index + 1}. /${cmd.name} - ${cmd.description}`);
    });

  } catch (error) {
    console.error('❌ Error deploying commands:', error);
    process.exit(1);
  }
})();

export { commands };
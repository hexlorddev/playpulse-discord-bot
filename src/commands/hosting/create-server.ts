import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import { BotCommand, ServerCreationOptions, PanelAPIResponse } from '../../types';
import axios from 'axios';

const createServerCommand: BotCommand = {
  category: 'hosting',
  cooldown: 60, // 1 minute cooldown
  data: new SlashCommandBuilder()
    .setName('create-server')
    .setDescription('Create a new server on Playpulse Ultimate')
    .addStringOption(option =>
      option.setName('plan')
        .setDescription('Server plan to use')
        .setRequired(true)
        .addChoices(
          { name: '💧 Basic - 2GB RAM', value: 'basic' },
          { name: '💎 Premium - 4GB RAM', value: 'premium' },
          { name: '🚀 Enterprise - 8GB RAM', value: 'enterprise' },
          { name: '⚡ Custom - Contact Support', value: 'custom' }
        ))
    .addStringOption(option =>
      option.setName('region')
        .setDescription('Server region')
        .setRequired(true)
        .addChoices(
          { name: '🇺🇸 US East (Virginia)', value: 'us-east' },
          { name: '🇺🇸 US West (California)', value: 'us-west' },
          { name: '🇪🇺 EU Central (Germany)', value: 'eu-central' },
          { name: '🌏 Asia Pacific (Singapore)', value: 'asia-pacific' }
        ))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Server type')
        .setRequired(false)
        .addChoices(
          { name: '⛏️ Minecraft Server', value: 'minecraft' },
          { name: '🤖 Discord Bot', value: 'discord-bot' },
          { name: '🌐 Web Application', value: 'web-app' },
          { name: '🎮 Game Server', value: 'game-server' }
        ))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Server name (optional)')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('auto-start')
        .setDescription('Auto-start server after creation')
        .setRequired(false)),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const plan = interaction.options.getString('plan', true);
    const region = interaction.options.getString('region', true);
    const serverType = interaction.options.getString('type') || 'minecraft';
    const serverName = interaction.options.getString('name') || `${interaction.user.username}-server`;
    const autoStart = interaction.options.getBoolean('auto-start') ?? true;

    // Defer reply as this might take some time
    await interaction.deferReply();

    try {
      // Check if user has reached server limit
      const userServers = await getUserServers(interaction.user.id);
      const maxServers = getMaxServersForUser(interaction.user.id); // Would check subscription
      
      if (userServers.length >= maxServers) {
        const embed = new EmbedBuilder()
          .setTitle('🚫 Server Limit Reached')
          .setDescription(`You have reached your server limit of ${maxServers} servers.`)
          .addFields({
            name: 'Upgrade to Premium',
            value: `[Get More Servers](${process.env.BILLING_PORTAL_URL || 'https://playpulse.com/upgrade'})`
          })
          .setColor(0xFF6B6B)
          .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Create server via Panel API
      const serverOptions: ServerCreationOptions = {
        plan: plan as any,
        region: region as any,
        serverType: serverType as any,
        name: serverName,
        autoStart
      };

      const serverData = await createServerViaAPI(interaction.user.id, serverOptions);

      if (!serverData.success) {
        throw new Error(serverData.error || 'Failed to create server');
      }

      // Success embed with server details
      const embed = new EmbedBuilder()
        .setTitle('🚀 Server Created Successfully!')
        .setDescription(`Your ${serverType} server has been created and is starting up.`)
        .addFields(
          { name: '📋 Server Name', value: serverName, inline: true },
          { name: '💽 Plan', value: getPlanDisplayName(plan), inline: true },
          { name: '🌍 Region', value: getRegionDisplayName(region), inline: true },
          { name: '🆔 Server ID', value: serverData.data.id, inline: true },
          { name: '📡 Status', value: '🟡 Starting...', inline: true },
          { name: '🎮 Type', value: getServerTypeDisplayName(serverType), inline: true }
        )
        .setColor(0x00FF00)
        .setThumbnail('https://cdn.playpulse.com/icons/server-success.png')
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' })
        .setTimestamp();

      // Add IP and port if available
      if (serverData.data.ip && serverData.data.port) {
        embed.addFields({
          name: '🔗 Connection Details',
          value: `\`${serverData.data.ip}:${serverData.data.port}\``,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Send follow-up with next steps
      setTimeout(async () => {
        const followUpEmbed = new EmbedBuilder()
          .setTitle('📖 Next Steps')
          .setDescription('Your server is now being configured. Here\'s what you can do:')
          .addFields(
            { name: '📊 Check Status', value: '`/server-status ' + serverData.data.id + '`', inline: true },
            { name: '📋 View Logs', value: '`/view-logs ' + serverData.data.id + '`', inline: true },
            { name: '🔄 Reboot', value: '`/reboot-server ' + serverData.data.id + '`', inline: true },
            { name: '⚙️ Manage', value: `[Control Panel](${process.env.PANEL_API_URL}/servers/${serverData.data.id})`, inline: false }
          )
          .setColor(0x0099FF)
          .setFooter({ text: 'Need help? Create a ticket with /ticket' });

        await interaction.followUp({ embeds: [followUpEmbed], ephemeral: true });
      }, 5000); // Send after 5 seconds

    } catch (error) {
      console.error('Server creation error:', error);

      const embed = new EmbedBuilder()
        .setTitle('❌ Server Creation Failed')
        .setDescription('Failed to create your server. Please try again or contact support.')
        .addFields({
          name: '🎫 Need Help?',
          value: 'Use `/ticket` to get support from our team.'
        })
        .setColor(0xFF6B6B)
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

      await interaction.editReply({ embeds: [embed] });
    }
  }
};

// Helper functions
async function getUserServers(userId: string): Promise<any[]> {
  // This would query the database for user's servers
  // For now, return empty array
  return [];
}

function getMaxServersForUser(userId: string): number {
  // This would check user's subscription tier
  // For now, return default limit
  return 3; // Free tier limit
}

async function createServerViaAPI(userId: string, options: ServerCreationOptions): Promise<PanelAPIResponse> {
  try {
    const response = await axios.post(`${process.env.PANEL_API_URL}/servers/create`, {
      userId,
      ...options
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.PANEL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    return response.data;
  } catch (error: any) {
    console.error('Panel API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || 'API request failed'
    };
  }
}

function getPlanDisplayName(plan: string): string {
  const plans: Record<string, string> = {
    'basic': '💧 Basic (2GB)',
    'premium': '💎 Premium (4GB)',
    'enterprise': '🚀 Enterprise (8GB)',
    'custom': '⚡ Custom'
  };
  return plans[plan] || plan;
}

function getRegionDisplayName(region: string): string {
  const regions: Record<string, string> = {
    'us-east': '🇺🇸 US East',
    'us-west': '🇺🇸 US West',
    'eu-central': '🇪🇺 EU Central',
    'asia-pacific': '🌏 Asia Pacific'
  };
  return regions[region] || region;
}

function getServerTypeDisplayName(type: string): string {
  const types: Record<string, string> = {
    'minecraft': '⛏️ Minecraft',
    'discord-bot': '🤖 Discord Bot',
    'web-app': '🌐 Web App',
    'game-server': '🎮 Game Server'
  };
  return types[type] || type;
}

module.exports = createServerCommand;
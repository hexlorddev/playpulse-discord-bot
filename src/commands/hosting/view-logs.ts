import { SlashCommandBuilder, EmbedBuilder, CommandInteraction, AttachmentBuilder } from 'discord.js';
import { BotCommand } from '../../types';
import axios from 'axios';

const viewLogsCommand: BotCommand = {
  category: 'hosting',
  data: new SlashCommandBuilder()
    .setName('view-logs')
    .setDescription('View server logs')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('Server ID to view logs for')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('lines')
        .setDescription('Number of lines to show (default: 50)')
        .setRequired(false)
        .addChoices(
          { name: '25 lines', value: '25' },
          { name: '50 lines', value: '50' },
          { name: '100 lines', value: '100' },
          { name: '200 lines', value: '200' }
        ))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Log type to view')
        .setRequired(false)
        .addChoices(
          { name: '📄 Application Logs', value: 'app' },
          { name: '🚨 Error Logs', value: 'error' },
          { name: '🔧 System Logs', value: 'system' },
          { name: '🌐 Access Logs', value: 'access' }
        )),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const serverId = interaction.options.getString('server-id', true);
    const lines = parseInt(interaction.options.getString('lines') || '50');
    const logType = interaction.options.getString('type') || 'app';

    await interaction.deferReply();

    try {
      // Verify server ownership
      const ownership = await verifyServerOwnership(interaction.user.id, serverId);
      if (!ownership.success) {
        const embed = new EmbedBuilder()
          .setTitle('🚫 Access Denied')
          .setDescription('You don\'t have permission to view logs for this server.')
          .setColor(0xFF6B6B)
          .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Fetch logs from API
      const logs = await fetchServerLogs(serverId, logType, lines);
      
      if (!logs.success) {
        throw new Error(logs.error || 'Failed to fetch logs');
      }

      const logContent = logs.data.logs;
      const serverInfo = logs.data.server;

      // Create embed
      const embed = new EmbedBuilder()
        .setTitle(`📋 Server Logs - ${serverInfo.name}`)
        .setDescription(`**Log Type:** ${getLogTypeDisplayName(logType)}\n**Lines:** ${lines}`)
        .addFields(
          { name: '🆔 Server ID', value: serverId, inline: true },
          { name: '📊 Status', value: getStatusEmoji(serverInfo.status), inline: true },
          { name: '🕒 Last Update', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
        )
        .setColor(0x0099FF)
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' })
        .setTimestamp();

      // If logs are short enough, show in embed
      if (logContent.length <= 1024) {
        embed.addFields({
          name: '📄 Recent Logs',
          value: '```\n' + logContent + '\n```',
          inline: false
        });

        await interaction.editReply({ embeds: [embed] });
      } else {
        // If logs are too long, send as file attachment
        const logFile = new AttachmentBuilder(
          Buffer.from(logContent, 'utf-8'),
          { name: `${serverId}-${logType}-logs.txt` }
        );

        embed.addFields({
          name: '📎 Log File',
          value: `Logs are too large to display inline. See attached file with ${lines} lines.`,
          inline: false
        });

        await interaction.editReply({ 
          embeds: [embed],
          files: [logFile]
        });
      }

      // Add helpful commands
      const helpEmbed = new EmbedBuilder()
        .setTitle('💡 Helpful Commands')
        .addFields(
          { name: '🔄 Reboot Server', value: `/reboot-server ${serverId}`, inline: true },
          { name: '📊 Check Status', value: `/server-status ${serverId}`, inline: true },
          { name: '⚙️ Change Plan', value: `/change-plan ${serverId}`, inline: true }
        )
        .setColor(0x00FF00)
        .setFooter({ text: 'Need more help? Use /ticket to contact support' });

      setTimeout(async () => {
        await interaction.followUp({ embeds: [helpEmbed], ephemeral: true });
      }, 2000);

    } catch (error) {
      console.error('View logs error:', error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Failed to Fetch Logs')
        .setDescription('Unable to retrieve server logs. Please try again or contact support.')
        .addFields({
          name: '🎫 Need Help?',
          value: 'Use `/ticket` to get support from our team.'
        })
        .setColor(0xFF6B6B)
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

async function verifyServerOwnership(userId: string, serverId: string) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/servers/${serverId}/owner`, {
      headers: {
        'Authorization': `Bearer ${process.env.PANEL_API_KEY}`
      }
    });

    return {
      success: response.data.ownerId === userId,
      server: response.data
    };
  } catch (error) {
    return { success: false, error: 'Failed to verify ownership' };
  }
}

async function fetchServerLogs(serverId: string, logType: string, lines: number) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/servers/${serverId}/logs`, {
      params: {
        type: logType,
        lines: lines
      },
      headers: {
        'Authorization': `Bearer ${process.env.PANEL_API_KEY}`
      },
      timeout: 15000 // 15 second timeout for logs
    });

    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch logs'
    };
  }
}

function getLogTypeDisplayName(type: string): string {
  const types: Record<string, string> = {
    'app': '📄 Application Logs',
    'error': '🚨 Error Logs',
    'system': '🔧 System Logs',
    'access': '🌐 Access Logs'
  };
  return types[type] || type;
}

function getStatusEmoji(status: string): string {
  const statuses: Record<string, string> = {
    'online': '🟢 Online',
    'offline': '🔴 Offline',
    'starting': '🟡 Starting',
    'stopping': '🟠 Stopping',
    'crashed': '💥 Crashed',
    'maintenance': '🔧 Maintenance'
  };
  return statuses[status] || '❓ Unknown';
}

module.exports = viewLogsCommand;
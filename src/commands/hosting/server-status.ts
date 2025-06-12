import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import { BotCommand } from '../../types';
import axios from 'axios';

const serverStatusCommand: BotCommand = {
  category: 'hosting',
  data: new SlashCommandBuilder()
    .setName('server-status')
    .setDescription('Get detailed server status and performance metrics')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('Server ID to check status for')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('detailed')
        .setDescription('Show detailed performance metrics')
        .setRequired(false)),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const serverId = interaction.options.getString('server-id', true);
    const detailed = interaction.options.getBoolean('detailed') ?? false;

    await interaction.deferReply();

    try {
      // Verify server ownership
      const ownership = await verifyServerOwnership(interaction.user.id, serverId);
      if (!ownership.success) {
        const embed = new EmbedBuilder()
          .setTitle('🚫 Access Denied')
          .setDescription('You don\'t have permission to view this server\'s status.')
          .setColor(0xFF3366)
          .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Get server status and metrics
      const [statusData, metricsData] = await Promise.all([
        getServerStatus(serverId),
        detailed ? getServerMetrics(serverId) : Promise.resolve({ success: false })
      ]);

      if (!statusData.success) {
        throw new Error(statusData.error || 'Failed to fetch server status');
      }

      const server = statusData.data;
      const uptime = calculateUptime(server.startTime);

      // Create main status embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 ${server.name} - Status Dashboard`)
        .setDescription(`**Current Status:** ${getStatusWithEmoji(server.status)}`)
        .addFields(
          { name: '🆔 Server ID', value: `\`${serverId}\``, inline: true },
          { name: '🌍 Region', value: getRegionFlag(server.region), inline: true },
          { name: '💽 Plan', value: getPlanBadge(server.plan), inline: true },
          { name: '⏰ Uptime', value: uptime, inline: true },
          { name: '🔗 IP Address', value: `\`${server.ip}:${server.port}\``, inline: true },
          { name: '🔧 Server Type', value: getServerTypeIcon(server.type), inline: true }
        )
        .setColor(getStatusColor(server.status))
        .setThumbnail(getServerTypeImage(server.type))
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' })
        .setTimestamp();

      // Add performance metrics if detailed view requested
      if (detailed && metricsData.success) {
        const metrics = metricsData.data;
        
        embed.addFields(
          { name: '📈 Performance Metrics', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
          { name: '🖥️ CPU Usage', value: `${metrics.cpu.current}% ${createProgressBar(metrics.cpu.current)}`, inline: true },
          { name: '💾 RAM Usage', value: `${metrics.memory.used}/${metrics.memory.total} GB ${createProgressBar(metrics.memory.percentage)}`, inline: true },
          { name: '💿 Disk Usage', value: `${metrics.disk.used}/${metrics.disk.total} GB ${createProgressBar(metrics.disk.percentage)}`, inline: true },
          { name: '🌐 Network In', value: formatBytes(metrics.network.incoming), inline: true },
          { name: '🌐 Network Out', value: formatBytes(metrics.network.outgoing), inline: true },
          { name: '🔥 Load Average', value: `${metrics.load.avg1m} | ${metrics.load.avg5m} | ${metrics.load.avg15m}`, inline: true }
        );

        // Add alerts if any
        const alerts = checkMetricAlerts(metrics);
        if (alerts.length > 0) {
          embed.addFields({
            name: '⚠️ Performance Alerts',
            value: alerts.join('\n'),
            inline: false
          });
        }
      }

      // Add recent activity
      const activity = await getRecentActivity(serverId);
      if (activity.success && activity.data.length > 0) {
        const recentEvents = activity.data.slice(0, 3).map(event => 
          `• ${getEventEmoji(event.type)} ${event.description} - <t:${Math.floor(new Date(event.timestamp).getTime() / 1000)}:R>`
        ).join('\n');

        embed.addFields({
          name: '📋 Recent Activity',
          value: recentEvents,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Send follow-up with quick actions
      const actionsEmbed = new EmbedBuilder()
        .setTitle('⚡ Quick Actions')
        .addFields(
          { name: '🔄 Reboot', value: `/reboot-server ${serverId}`, inline: true },
          { name: '📄 View Logs', value: `/view-logs ${serverId}`, inline: true },
          { name: '⚙️ Change Plan', value: `/change-plan ${serverId}`, inline: true },
          { name: '📊 Analytics', value: `/server-analytics ${serverId}`, inline: true },
          { name: '💾 Backup', value: `/create-backup ${serverId}`, inline: true },
          { name: '🔧 Manage', value: `/server-manage ${serverId}`, inline: true }
        )
        .setColor(0x00D4FF)
        .setFooter({ text: 'Use these commands for quick server management' });

      setTimeout(async () => {
        await interaction.followUp({ embeds: [actionsEmbed], ephemeral: true });
      }, 2000);

    } catch (error) {
      console.error('Server status error:', error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Status Check Failed')
        .setDescription('Unable to retrieve server status. Please try again later.')
        .setColor(0xFF3366)
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

// Helper functions
async function verifyServerOwnership(userId: string, serverId: string) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/servers/${serverId}/owner`, {
      headers: { 'Authorization': `Bearer ${process.env.PANEL_API_KEY}` }
    });
    return { success: response.data.ownerId === userId };
  } catch (error) {
    return { success: false };
  }
}

async function getServerStatus(serverId: string) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/servers/${serverId}/status`, {
      headers: { 'Authorization': `Bearer ${process.env.PANEL_API_KEY}` }
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || 'Failed to fetch status' };
  }
}

async function getServerMetrics(serverId: string) {
  try {
    const response = await axios.get(`${process.env.MONITORING_API_URL}/servers/${serverId}/metrics`, {
      headers: { 'Authorization': `Bearer ${process.env.MONITORING_API_KEY}` }
    });
    return response.data;
  } catch (error) {
    return { success: false };
  }
}

async function getRecentActivity(serverId: string) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/servers/${serverId}/activity`, {
      headers: { 'Authorization': `Bearer ${process.env.PANEL_API_KEY}` }
    });
    return response.data;
  } catch (error) {
    return { success: false };
  }
}

function getStatusWithEmoji(status: string): string {
  const statuses: Record<string, string> = {
    'online': '🟢 **ONLINE**',
    'offline': '🔴 **OFFLINE**',
    'starting': '🟡 **STARTING**',
    'stopping': '🟠 **STOPPING**',
    'crashed': '💥 **CRASHED**',
    'maintenance': '🔧 **MAINTENANCE**',
    'suspended': '⏸️ **SUSPENDED**'
  };
  return statuses[status] || '❓ **UNKNOWN**';
}

function getStatusColor(status: string): number {
  const colors: Record<string, number> = {
    'online': 0x00FF88,
    'offline': 0xFF3366,
    'starting': 0xFFD700,
    'stopping': 0xFF6B00,
    'crashed': 0xFF0000,
    'maintenance': 0x00D4FF,
    'suspended': 0x808080
  };
  return colors[status] || 0x808080;
}

function calculateUptime(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function createProgressBar(percentage: number): string {
  const filled = Math.floor(percentage / 10);
  const empty = 10 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  
  if (percentage >= 90) return `🔴 ${bar}`;
  if (percentage >= 70) return `🟡 ${bar}`;
  return `🟢 ${bar}`;
}

function getRegionFlag(region: string): string {
  const flags: Record<string, string> = {
    'us-east': '🇺🇸 US East',
    'us-west': '🇺🇸 US West',
    'eu-central': '🇪🇺 EU Central',
    'asia-pacific': '🌏 Asia Pacific',
    'canada': '🇨🇦 Canada',
    'brazil': '🇧🇷 Brazil',
    'australia': '🇦🇺 Australia'
  };
  return flags[region] || '🌍 ' + region;
}

function getPlanBadge(plan: string): string {
  const badges: Record<string, string> = {
    'basic': '💧 Basic',
    'premium': '💎 Premium',
    'enterprise': '🚀 Enterprise',
    'ultimate': '⚡ Ultimate',
    'custom': '🔧 Custom'
  };
  return badges[plan] || plan;
}

function getServerTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    'minecraft': '⛏️ Minecraft',
    'discord-bot': '🤖 Discord Bot',
    'web-app': '🌐 Web App',
    'game-server': '🎮 Game Server',
    'database': '💾 Database',
    'api': '🔌 API Server'
  };
  return icons[type] || '🖥️ ' + type;
}

function getServerTypeImage(type: string): string {
  const images: Record<string, string> = {
    'minecraft': 'https://cdn.playpulse.com/icons/minecraft.png',
    'discord-bot': 'https://cdn.playpulse.com/icons/discord.png',
    'web-app': 'https://cdn.playpulse.com/icons/webapp.png',
    'game-server': 'https://cdn.playpulse.com/icons/gameserver.png'
  };
  return images[type] || 'https://cdn.playpulse.com/icons/server.png';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkMetricAlerts(metrics: any): string[] {
  const alerts = [];
  if (metrics.cpu.current > 90) alerts.push('🔴 High CPU usage detected');
  if (metrics.memory.percentage > 85) alerts.push('🔴 High memory usage detected');
  if (metrics.disk.percentage > 90) alerts.push('🔴 Disk space running low');
  if (metrics.load.avg1m > 2) alerts.push('🟡 High system load detected');
  return alerts;
}

function getEventEmoji(type: string): string {
  const emojis: Record<string, string> = {
    'start': '▶️',
    'stop': '⏹️',
    'restart': '🔄',
    'crash': '💥',
    'backup': '💾',
    'update': '🔄',
    'scale': '📈',
    'error': '❌'
  };
  return emojis[type] || '📋';
}

module.exports = serverStatusCommand;
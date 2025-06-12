import { SlashCommandBuilder, EmbedBuilder, CommandInteraction, AttachmentBuilder } from 'discord.js';
import { BotCommand } from '../../types';
import axios from 'axios';

const serverAnalyticsCommand: BotCommand = {
  category: 'hosting',
  data: new SlashCommandBuilder()
    .setName('server-analytics')
    .setDescription('View comprehensive server analytics and insights')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('Server ID to analyze')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('timeframe')
        .setDescription('Analytics timeframe')
        .setRequired(false)
        .addChoices(
          { name: '📅 Last 24 Hours', value: '24h' },
          { name: '📅 Last 7 Days', value: '7d' },
          { name: '📅 Last 30 Days', value: '30d' },
          { name: '📅 Last 90 Days', value: '90d' }
        ))
    .addStringOption(option =>
      option.setName('metric')
        .setDescription('Specific metric to analyze')
        .setRequired(false)
        .addChoices(
          { name: '🖥️ CPU Performance', value: 'cpu' },
          { name: '💾 Memory Usage', value: 'memory' },
          { name: '💿 Disk I/O', value: 'disk' },
          { name: '🌐 Network Traffic', value: 'network' },
          { name: '👥 User Activity', value: 'users' },
          { name: '💰 Cost Analysis', value: 'cost' }
        )),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const serverId = interaction.options.getString('server-id', true);
    const timeframe = interaction.options.getString('timeframe') || '24h';
    const metric = interaction.options.getString('metric') || 'overview';

    await interaction.deferReply();

    try {
      // Verify server ownership
      const ownership = await verifyServerOwnership(interaction.user.id, serverId);
      if (!ownership.success) {
        const embed = new EmbedBuilder()
          .setTitle('🚫 Access Denied')
          .setDescription('You don\'t have permission to view analytics for this server.')
          .setColor(0xFF3366)
          .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Fetch analytics data
      const [analyticsData, predictionsData, alertsData] = await Promise.all([
        getServerAnalytics(serverId, timeframe, metric),
        getPerformancePredictions(serverId),
        getAnalyticsAlerts(serverId)
      ]);

      if (!analyticsData.success) {
        throw new Error(analyticsData.error || 'Failed to fetch analytics data');
      }

      const analytics = analyticsData.data;
      
      // Create main analytics embed
      const embed = new EmbedBuilder()
        .setTitle(`📊 Server Analytics - ${analytics.serverName}`)
        .setDescription(`**Timeframe:** ${getTimeframeLabel(timeframe)} | **Focus:** ${getMetricLabel(metric)}`)
        .setColor(0x00D4FF)
        .setThumbnail('https://cdn.playpulse.com/icons/analytics.png')
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' })
        .setTimestamp();

      // Add overview metrics
      embed.addFields(
        { name: '📈 Performance Overview', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
        { name: '⚡ Avg Response Time', value: `${analytics.performance.avgResponseTime}ms`, inline: true },
        { name: '💯 Uptime', value: `${analytics.performance.uptime}%`, inline: true },
        { name: '🔥 Peak Load', value: `${analytics.performance.peakLoad}%`, inline: true }
      );

      // Add specific metric analysis based on selection
      if (metric === 'cpu' || metric === 'overview') {
        embed.addFields(
          { name: '🖥️ CPU Analysis', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
          { name: 'Average Usage', value: `${analytics.cpu.average}%`, inline: true },
          { name: 'Peak Usage', value: `${analytics.cpu.peak}%`, inline: true },
          { name: 'Efficiency Score', value: `${analytics.cpu.efficiency}/100`, inline: true }
        );
      }

      if (metric === 'memory' || metric === 'overview') {
        embed.addFields(
          { name: '💾 Memory Analysis', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
          { name: 'Avg Usage', value: `${analytics.memory.averageUsed}/${analytics.memory.total} GB`, inline: true },
          { name: 'Peak Usage', value: `${analytics.memory.peakUsed} GB`, inline: true },
          { name: 'Memory Leaks', value: analytics.memory.leaksDetected ? '⚠️ Detected' : '✅ None', inline: true }
        );
      }

      if (metric === 'network' || metric === 'overview') {
        embed.addFields(
          { name: '🌐 Network Analysis', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
          { name: 'Data In', value: formatBytes(analytics.network.totalIn), inline: true },
          { name: 'Data Out', value: formatBytes(analytics.network.totalOut), inline: true },
          { name: 'Avg Bandwidth', value: `${formatBytes(analytics.network.avgBandwidth)}/s`, inline: true }
        );
      }

      if (metric === 'users' || metric === 'overview') {
        embed.addFields(
          { name: '👥 User Activity', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
          { name: 'Total Visits', value: analytics.users.totalVisits.toLocaleString(), inline: true },
          { name: 'Peak Concurrent', value: analytics.users.peakConcurrent.toString(), inline: true },
          { name: 'Avg Session Time', value: formatDuration(analytics.users.avgSessionTime), inline: true }
        );
      }

      if (metric === 'cost' || metric === 'overview') {
        embed.addFields(
          { name: '💰 Cost Analysis', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
          { name: 'Current Period', value: `$${analytics.cost.currentPeriod}`, inline: true },
          { name: 'Projected Monthly', value: `$${analytics.cost.projectedMonthly}`, inline: true },
          { name: 'Cost Efficiency', value: `${analytics.cost.efficiency}%`, inline: true }
        );
      }

      // Add predictions if available
      if (predictionsData.success) {
        const predictions = predictionsData.data;
        embed.addFields(
          { name: '🔮 AI Predictions', value: '━━━━━━━━━━━━━━━━━━━━', inline: false },
          { name: 'Resource Needs', value: predictions.resourceRecommendation, inline: true },
          { name: 'Scaling Advice', value: predictions.scalingAdvice, inline: true },
          { name: 'Next 7 Days', value: predictions.weekForecast, inline: true }
        );
      }

      // Add alerts if any
      if (alertsData.success && alertsData.data.length > 0) {
        const alerts = alertsData.data.slice(0, 3).map((alert: any) => 
          `${getAlertEmoji(alert.severity)} ${alert.message}`
        ).join('\n');
        
        embed.addFields({
          name: '🚨 Active Alerts',
          value: alerts,
          inline: false
        });
      }

      // Add performance trends
      const trends = generateTrendIndicators(analytics);
      embed.addFields({
        name: '📈 Performance Trends',
        value: `CPU: ${trends.cpu} | Memory: ${trends.memory} | Network: ${trends.network} | Users: ${trends.users}`,
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

      // Generate and send detailed report as attachment if requested
      if (metric === 'overview') {
        const reportData = await generateDetailedReport(serverId, timeframe, analytics);
        if (reportData.success) {
          const attachment = new AttachmentBuilder(
            Buffer.from(reportData.data, 'utf-8'),
            { name: `server-analytics-${serverId}-${timeframe}.txt` }
          );

          const reportEmbed = new EmbedBuilder()
            .setTitle('📋 Detailed Analytics Report')
            .setDescription('Comprehensive analytics report has been generated and attached.')
            .addFields(
              { name: '📊 Report Contents', value: 'Performance metrics, trends, recommendations, and insights', inline: false },
              { name: '🔍 Analysis Period', value: getTimeframeLabel(timeframe), inline: true },
              { name: '📈 Data Points', value: analytics.totalDataPoints?.toString() || 'N/A', inline: true }
            )
            .setColor(0x00FF88)
            .setFooter({ text: 'Use this data for capacity planning and optimization' });

          setTimeout(async () => {
            await interaction.followUp({ 
              embeds: [reportEmbed], 
              files: [attachment],
              ephemeral: true 
            });
          }, 3000);
        }
      }

      // Send optimization suggestions
      const optimizationEmbed = new EmbedBuilder()
        .setTitle('⚡ Optimization Suggestions')
        .setDescription('AI-powered recommendations to improve your server performance:')
        .addFields(
          { name: '🎯 Top Priority', value: getTopOptimization(analytics), inline: false },
          { name: '💡 Quick Wins', value: getQuickOptimizations(analytics).join('\n'), inline: false },
          { name: '🔮 Future Planning', value: getFuturePlanningAdvice(analytics), inline: false }
        )
        .setColor(0xFFD700)
        .setFooter({ text: 'Implementing these suggestions can improve performance by up to 40%' });

      setTimeout(async () => {
        await interaction.followUp({ embeds: [optimizationEmbed], ephemeral: true });
      }, 5000);

    } catch (error) {
      console.error('Server analytics error:', error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Analytics Unavailable')
        .setDescription('Unable to retrieve server analytics. Please try again later.')
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

async function getServerAnalytics(serverId: string, timeframe: string, metric: string) {
  try {
    const response = await axios.get(`${process.env.ANALYTICS_API_URL}/servers/${serverId}/analytics`, {
      params: { timeframe, metric },
      headers: { 'Authorization': `Bearer ${process.env.ANALYTICS_API_KEY}` }
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || 'Failed to fetch analytics' };
  }
}

async function getPerformancePredictions(serverId: string) {
  try {
    const response = await axios.get(`${process.env.ANALYTICS_API_URL}/servers/${serverId}/predictions`, {
      headers: { 'Authorization': `Bearer ${process.env.ANALYTICS_API_KEY}` }
    });
    return response.data;
  } catch (error) {
    return { success: false };
  }
}

async function getAnalyticsAlerts(serverId: string) {
  try {
    const response = await axios.get(`${process.env.MONITORING_API_URL}/servers/${serverId}/alerts`, {
      headers: { 'Authorization': `Bearer ${process.env.MONITORING_API_KEY}` }
    });
    return response.data;
  } catch (error) {
    return { success: false };
  }
}

async function generateDetailedReport(serverId: string, timeframe: string, analytics: any) {
  try {
    const reportContent = `
PLAYPULSE ULTIMATE - SERVER ANALYTICS REPORT
Generated by hexlorddev • ${new Date().toISOString()}
═══════════════════════════════════════════════════════

Server ID: ${serverId}
Analysis Period: ${getTimeframeLabel(timeframe)}
Report Generated: ${new Date().toLocaleString()}

PERFORMANCE SUMMARY
───────────────────
Average Response Time: ${analytics.performance.avgResponseTime}ms
Uptime Percentage: ${analytics.performance.uptime}%
Peak Load: ${analytics.performance.peakLoad}%
Efficiency Score: ${analytics.performance.efficiency}/100

CPU ANALYSIS
────────────
Average Usage: ${analytics.cpu.average}%
Peak Usage: ${analytics.cpu.peak}%
Minimum Usage: ${analytics.cpu.minimum}%
CPU Efficiency: ${analytics.cpu.efficiency}/100
Throttling Events: ${analytics.cpu.throttlingEvents || 0}

MEMORY ANALYSIS
───────────────
Total Memory: ${analytics.memory.total} GB
Average Used: ${analytics.memory.averageUsed} GB
Peak Usage: ${analytics.memory.peakUsed} GB
Memory Efficiency: ${analytics.memory.efficiency}%
Swap Usage: ${analytics.memory.swapUsed || 0} GB

NETWORK ANALYSIS
────────────────
Total Data In: ${formatBytes(analytics.network.totalIn)}
Total Data Out: ${formatBytes(analytics.network.totalOut)}
Average Bandwidth: ${formatBytes(analytics.network.avgBandwidth)}/s
Peak Bandwidth: ${formatBytes(analytics.network.peakBandwidth)}/s
Network Errors: ${analytics.network.errors || 0}

USER ACTIVITY
─────────────
Total Visits: ${analytics.users.totalVisits}
Unique Visitors: ${analytics.users.uniqueVisitors}
Peak Concurrent: ${analytics.users.peakConcurrent}
Average Session: ${formatDuration(analytics.users.avgSessionTime)}
Bounce Rate: ${analytics.users.bounceRate}%

COST ANALYSIS
─────────────
Current Period Cost: $${analytics.cost.currentPeriod}
Projected Monthly: $${analytics.cost.projectedMonthly}
Cost per Hour: $${analytics.cost.perHour}
Cost Efficiency: ${analytics.cost.efficiency}%

RECOMMENDATIONS
───────────────
${getDetailedRecommendations(analytics)}

END OF REPORT
═════════════
This report was generated using AI-powered analytics.
For questions, contact support or use /ticket command.
`;
    
    return { success: true, data: reportContent };
  } catch (error) {
    return { success: false };
  }
}

function getTimeframeLabel(timeframe: string): string {
  const labels: Record<string, string> = {
    '24h': 'Last 24 Hours',
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days'
  };
  return labels[timeframe] || timeframe;
}

function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    'overview': 'Complete Overview',
    'cpu': 'CPU Performance',
    'memory': 'Memory Usage',
    'disk': 'Disk I/O',
    'network': 'Network Traffic',
    'users': 'User Activity',
    'cost': 'Cost Analysis'
  };
  return labels[metric] || metric;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function getAlertEmoji(severity: string): string {
  const emojis: Record<string, string> = {
    'critical': '🔴',
    'high': '🟠',
    'medium': '🟡',
    'low': '🟢',
    'info': '🔵'
  };
  return emojis[severity] || '⚪';
}

function generateTrendIndicators(analytics: any): Record<string, string> {
  return {
    cpu: analytics.trends?.cpu > 0 ? '📈' : analytics.trends?.cpu < 0 ? '📉' : '➡️',
    memory: analytics.trends?.memory > 0 ? '📈' : analytics.trends?.memory < 0 ? '📉' : '➡️',
    network: analytics.trends?.network > 0 ? '📈' : analytics.trends?.network < 0 ? '📉' : '➡️',
    users: analytics.trends?.users > 0 ? '📈' : analytics.trends?.users < 0 ? '📉' : '➡️'
  };
}

function getTopOptimization(analytics: any): string {
  if (analytics.cpu.average > 80) return '🔧 Consider upgrading CPU or optimizing code';
  if (analytics.memory.efficiency < 70) return '💾 Optimize memory usage and clear memory leaks';
  if (analytics.cost.efficiency < 60) return '💰 Right-size your resources to reduce costs';
  return '✅ Server is performing optimally';
}

function getQuickOptimizations(analytics: any): string[] {
  const suggestions = [];
  if (analytics.cache?.hitRate < 80) suggestions.push('📦 Enable or optimize caching');
  if (analytics.database?.slowQueries > 0) suggestions.push('🗃️ Optimize database queries');
  if (analytics.network.errors > 0) suggestions.push('🌐 Check network configuration');
  if (suggestions.length === 0) suggestions.push('✨ All systems optimized');
  return suggestions;
}

function getFuturePlanningAdvice(analytics: any): string {
  if (analytics.trends?.users > 20) return '📈 Plan for increased capacity - user growth detected';
  if (analytics.cost.projectedMonthly > analytics.cost.currentPeriod * 1.5) return '💰 Consider cost optimization strategies';
  return '📊 Current resources should meet near-future demands';
}

function getDetailedRecommendations(analytics: any): string {
  let recommendations = '';
  
  if (analytics.cpu.average > 70) {
    recommendations += '• Consider CPU optimization or upgrading to a higher plan\n';
  }
  
  if (analytics.memory.efficiency < 80) {
    recommendations += '• Implement memory optimization techniques\n';
  }
  
  if (analytics.cost.efficiency < 70) {
    recommendations += '• Review resource allocation for cost optimization\n';
  }
  
  if (analytics.users.bounceRate > 50) {
    recommendations += '• Improve application performance to reduce bounce rate\n';
  }
  
  if (!recommendations) {
    recommendations = '• Server is performing optimally - no immediate actions needed\n';
  }
  
  return recommendations;
}

module.exports = serverAnalyticsCommand;
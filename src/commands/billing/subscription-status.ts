import { SlashCommandBuilder, EmbedBuilder, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotCommand } from '../../types';
import axios from 'axios';

const subscriptionStatusCommand: BotCommand = {
  category: 'billing',
  data: new SlashCommandBuilder()
    .setName('subscription-status')
    .setDescription('View your current subscription and billing information'),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Get user's subscription data
      const subscriptionData = await getUserSubscription(interaction.user.id);
      
      if (!subscriptionData.success) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Subscription Not Found')
          .setDescription('No active subscription found for your account.')
          .addFields({
            name: '🚀 Get Started',
            value: `[View Plans](${process.env.BILLING_PORTAL_URL || 'https://playpulse.com/pricing'})`
          })
          .setColor(0xFFA500)
          .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const subscription = subscriptionData.data;
      const usage = await getUserUsage(interaction.user.id);

      // Create main subscription embed
      const embed = new EmbedBuilder()
        .setTitle('💎 Subscription Status')
        .setDescription(`Hey <@${interaction.user.id}>! Here's your current subscription information.`)
        .addFields(
          { name: '📋 Plan', value: `**${subscription.planName}**`, inline: true },
          { name: '💳 Status', value: getStatusBadge(subscription.status), inline: true },
          { name: '💰 Amount', value: `$${subscription.amount}/${subscription.interval}`, inline: true },
          { name: '🗓️ Next Billing', value: `<t:${Math.floor(new Date(subscription.nextBillingDate).getTime() / 1000)}:D>`, inline: true },
          { name: '🆔 Subscription ID', value: `\`${subscription.id}\``, inline: true },
          { name: '🔄 Auto Renewal', value: subscription.autoRenewal ? '✅ Enabled' : '❌ Disabled', inline: true }
        )
        .setColor(getStatusColor(subscription.status))
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' })
        .setTimestamp();

      // Add usage information if available
      if (usage.success) {
        const usageData = usage.data;
        embed.addFields(
          { name: '📊 Current Usage', value: 'Resource utilization this month', inline: false },
          { name: '🖥️ Servers', value: `${usageData.serversUsed}/${usageData.serversLimit}`, inline: true },
          { name: '💾 Storage', value: `${formatBytes(usageData.storageUsed)}/${formatBytes(usageData.storageLimit)}`, inline: true },
          { name: '🔄 Bandwidth', value: `${formatBytes(usageData.bandwidthUsed)}/${formatBytes(usageData.bandwidthLimit)}`, inline: true }
        );

        // Add usage bars
        const serverUsagePercent = Math.round((usageData.serversUsed / usageData.serversLimit) * 100);
        const storageUsagePercent = Math.round((usageData.storageUsed / usageData.storageLimit) * 100);
        
        embed.addFields({
          name: '📈 Usage Overview',
          value: `**Servers:** ${createUsageBar(serverUsagePercent)} ${serverUsagePercent}%\n**Storage:** ${createUsageBar(storageUsagePercent)} ${storageUsagePercent}%`,
          inline: false
        });
      }

      // Create action buttons
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setLabel('💳 Manage Billing')
            .setStyle(ButtonStyle.Link)
            .setURL(process.env.BILLING_PORTAL_URL || 'https://playpulse.com/billing')
            .setEmoji('💳'),
          new ButtonBuilder()
            .setLabel('🚀 Upgrade Plan')
            .setStyle(ButtonStyle.Link)
            .setURL(process.env.BILLING_PORTAL_URL + '/upgrade' || 'https://playpulse.com/upgrade')
            .setEmoji('🚀'),
          new ButtonBuilder()
            .setCustomId('billing_history')
            .setLabel('📊 View History')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📊')
        );

      await interaction.editReply({ 
        embeds: [embed],
        components: [actionRow]
      });

      // Send additional information based on subscription status
      if (subscription.status === 'past_due') {
        const warningEmbed = new EmbedBuilder()
          .setTitle('⚠️ Payment Overdue')
          .setDescription('Your subscription payment is overdue. Please update your billing information to avoid service interruption.')
          .setColor(0xFF6B6B)
          .setFooter({ text: 'Update your payment method to continue service' });

        setTimeout(async () => {
          await interaction.followUp({ embeds: [warningEmbed], ephemeral: true });
        }, 2000);
      }

      if (isNearBillingDate(subscription.nextBillingDate)) {
        const reminderEmbed = new EmbedBuilder()
          .setTitle('🔔 Billing Reminder')
          .setDescription(`Your next billing date is coming up on ${new Date(subscription.nextBillingDate).toLocaleDateString()}.`)
          .addFields({
            name: '💡 Tip',
            value: 'Make sure your payment method is up to date to avoid any service interruptions.'
          })
          .setColor(0x0099FF);

        setTimeout(async () => {
          await interaction.followUp({ embeds: [reminderEmbed], ephemeral: true });
        }, 3000);
      }

    } catch (error) {
      console.error('Subscription status error:', error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Unable to Load Subscription')
        .setDescription('Failed to retrieve your subscription information. Please try again later.')
        .addFields({
          name: '🎫 Need Help?',
          value: 'Use `/ticket` to contact our billing support team.'
        })
        .setColor(0xFF6B6B)
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};

async function getUserSubscription(userId: string) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/billing/subscription/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.PANEL_API_KEY}`
      }
    });

    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to fetch subscription'
    };
  }
}

async function getUserUsage(userId: string) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/users/${userId}/usage`, {
      headers: {
        'Authorization': `Bearer ${process.env.PANEL_API_KEY}`
      }
    });

    return response.data;
  } catch (error) {
    return { success: false };
  }
}

function getStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    'active': '🟢 **Active**',
    'cancelled': '🟡 **Cancelled**',
    'past_due': '🔴 **Past Due**',
    'unpaid': '🔴 **Unpaid**',
    'trialing': '🔵 **Trial**'
  };
  return badges[status] || '❓ Unknown';
}

function getStatusColor(status: string): number {
  const colors: Record<string, number> = {
    'active': 0x00FF00,
    'cancelled': 0xFFA500,
    'past_due': 0xFF0000,
    'unpaid': 0xFF0000,
    'trialing': 0x0099FF
  };
  return colors[status] || 0x808080;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function createUsageBar(percentage: number): string {
  const filledBlocks = Math.floor(percentage / 10);
  const emptyBlocks = 10 - filledBlocks;
  
  let bar = '';
  for (let i = 0; i < filledBlocks; i++) {
    bar += '█';
  }
  for (let i = 0; i < emptyBlocks; i++) {
    bar += '░';
  }
  
  return bar;
}

function isNearBillingDate(billingDate: string): boolean {
  const billing = new Date(billingDate);
  const now = new Date();
  const daysUntilBilling = Math.ceil((billing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return daysUntilBilling <= 7 && daysUntilBilling > 0;
}

module.exports = subscriptionStatusCommand;
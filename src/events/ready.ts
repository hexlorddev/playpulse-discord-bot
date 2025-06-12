import { Events, ActivityType } from 'discord.js';
import { PlaypulseBot } from '..';

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client: any, bot: PlaypulseBot) {
    const logger = bot.getLogger();
    
    logger.info(`🚀 ${client.user.tag} is now online!`);
    logger.info(`📊 Serving ${client.guilds.cache.size} guilds with ${client.users.cache.size} users`);

    // Set bot status
    client.user.setPresence({
      activities: [{
        name: 'Playpulse Ultimate Panel 🚀',
        type: ActivityType.Watching
      }],
      status: 'online'
    });

    // Log startup to admin channel if configured
    const adminChannelId = process.env.ADMIN_CHANNEL_ID;
    if (adminChannelId) {
      try {
        const adminChannel = await client.channels.fetch(adminChannelId);
        if (adminChannel && adminChannel.isTextBased()) {
          const { EmbedBuilder } = require('discord.js');
          
          const embed = new EmbedBuilder()
            .setTitle('🟢 Bot Online')
            .setDescription('Playpulse Discord Bot has started successfully!')
            .addFields(
              { name: 'Guilds', value: client.guilds.cache.size.toString(), inline: true },
              { name: 'Users', value: client.users.cache.size.toString(), inline: true },
              { name: 'Commands', value: client.commands.size.toString(), inline: true }
            )
            .setColor(0x00FF00)
            .setTimestamp()
            .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

          await adminChannel.send({ embeds: [embed] });
        }
      } catch (error) {
        logger.error('Failed to send startup message to admin channel:', error);
      }
    }

    // Initialize periodic tasks
    await initializePeriodicTasks(bot);
  }
};

async function initializePeriodicTasks(bot: PlaypulseBot) {
  const cron = require('node-cron');
  const logger = bot.getLogger();

  // Health check every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await performHealthCheck(bot);
    } catch (error) {
      logger.error('Health check failed:', error);
    }
  });

  // Cleanup old tickets daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      await cleanupOldTickets(bot);
    } catch (error) {
      logger.error('Ticket cleanup failed:', error);
    }
  });

  // Send billing reminders daily at 10 AM
  cron.schedule('0 10 * * *', async () => {
    try {
      await sendBillingReminders(bot);
    } catch (error) {
      logger.error('Billing reminders failed:', error);
    }
  });

  logger.info('✅ Periodic tasks initialized');
}

async function performHealthCheck(bot: PlaypulseBot) {
  const logger = bot.getLogger();
  const client = bot.getClient();
  
  // Check bot connectivity
  if (!client.isReady()) {
    logger.warn('Bot is not ready');
    return;
  }

  // Check database connection
  try {
    const db = bot.getDatabase();
    // Simple database check (you might want to implement a ping method)
    await db.getUser('health-check-test');
  } catch (error) {
    logger.error('Database health check failed:', error);
  }

  // Update status periodically with different messages
  const statusMessages = [
    'Playpulse Ultimate Panel 🚀',
    'Server Management 🖥️',
    'Ticket Support 🎫',
    `${client.guilds.cache.size} Servers Online 📊`
  ];
  
  const randomStatus = statusMessages[Math.floor(Math.random() * statusMessages.length)];
  client.user.setActivity(randomStatus, { type: ActivityType.Watching });
}

async function cleanupOldTickets(bot: PlaypulseBot) {
  const logger = bot.getLogger();
  // Implementation would clean up tickets older than 30 days
  logger.info('Cleaning up old tickets...');
  // TODO: Implement actual cleanup logic
}

async function sendBillingReminders(bot: PlaypulseBot) {
  const logger = bot.getLogger();
  // Implementation would send billing reminders to users
  logger.info('Sending billing reminders...');
  // TODO: Implement billing reminder logic
}
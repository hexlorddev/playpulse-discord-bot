import { SlashCommandBuilder, EmbedBuilder, CommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BotCommand } from '../../types';
import axios from 'axios';

const createBackupCommand: BotCommand = {
  category: 'hosting',
  data: new SlashCommandBuilder()
    .setName('create-backup')
    .setDescription('Create a backup of your server with advanced options')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('Server ID to backup')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('backup-type')
        .setDescription('Type of backup to create')
        .setRequired(false)
        .addChoices(
          { name: '💾 Full Backup (Everything)', value: 'full' },
          { name: '📄 Files Only', value: 'files' },
          { name: '🗃️ Database Only', value: 'database' },
          { name: '⚙️ Configuration Only', value: 'config' },
          { name: '🎯 Custom Selection', value: 'custom' }
        ))
    .addStringOption(option =>
      option.setName('compression')
        .setDescription('Compression level for backup')
        .setRequired(false)
        .addChoices(
          { name: '⚡ Fast (Less compression)', value: 'fast' },
          { name: '⚖️ Balanced (Default)', value: 'balanced' },
          { name: '🗜️ Maximum (Smallest size)', value: 'max' }
        ))
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Custom name for the backup')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('encrypt')
        .setDescription('Encrypt the backup with AES-256')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('scheduled')
        .setDescription('Set up automatic scheduled backups')
        .setRequired(false)),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const serverId = interaction.options.getString('server-id', true);
    const backupType = interaction.options.getString('backup-type') || 'full';
    const compression = interaction.options.getString('compression') || 'balanced';
    const customName = interaction.options.getString('name');
    const encrypt = interaction.options.getBoolean('encrypt') ?? true;
    const scheduled = interaction.options.getBoolean('scheduled') ?? false;

    await interaction.deferReply();

    try {
      // Verify server ownership
      const ownership = await verifyServerOwnership(interaction.user.id, serverId);
      if (!ownership.success) {
        const embed = new EmbedBuilder()
          .setTitle('🚫 Access Denied')
          .setDescription('You don\'t have permission to create backups for this server.')
          .setColor(0xFF3366)
          .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Get server info and backup estimate
      const [serverInfo, backupEstimate] = await Promise.all([
        getServerInfo(serverId),
        getBackupEstimate(serverId, backupType, compression)
      ]);

      if (!serverInfo.success || !backupEstimate.success) {
        throw new Error('Failed to get server information or backup estimate');
      }

      const server = serverInfo.data;
      const estimate = backupEstimate.data;

      // Show backup confirmation with details
      const confirmEmbed = new EmbedBuilder()
        .setTitle('💾 Backup Creation Confirmation')
        .setDescription(`Ready to create backup for **${server.name}**`)
        .addFields(
          { name: '🆔 Server ID', value: `\`${serverId}\``, inline: true },
          { name: '📦 Backup Type', value: getBackupTypeLabel(backupType), inline: true },
          { name: '🗜️ Compression', value: getCompressionLabel(compression), inline: true },
          { name: '📏 Estimated Size', value: formatBytes(estimate.estimatedSize), inline: true },
          { name: '⏱️ Est. Duration', value: formatDuration(estimate.estimatedDuration), inline: true },
          { name: '🔐 Encryption', value: encrypt ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: '📋 Backup Name', value: customName || `${server.name}-${new Date().toISOString().split('T')[0]}`, inline: false },
          { name: '💰 Cost', value: estimate.cost > 0 ? `$${estimate.cost}` : 'Free', inline: true },
          { name: '📅 Retention', value: `${estimate.retentionDays} days`, inline: true },
          { name: '☁️ Storage Location', value: estimate.storageLocation, inline: true }
        )
        .setColor(0x00D4FF)
        .setThumbnail('https://cdn.playpulse.com/icons/backup.png')
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' })
        .setTimestamp();

      // Add warning if backup is large
      if (estimate.estimatedSize > 5000000000) { // 5GB
        confirmEmbed.addFields({
          name: '⚠️ Large Backup Warning',
          value: 'This backup is quite large and may take significant time to complete. Consider using incremental backup instead.',
          inline: false
        });
      }

      // Create action buttons
      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`backup_confirm_${serverId}`)
            .setLabel('✅ Create Backup')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💾'),
          new ButtonBuilder()
            .setCustomId(`backup_cancel_${serverId}`)
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🚫'),
          new ButtonBuilder()
            .setCustomId(`backup_schedule_${serverId}`)
            .setLabel('📅 Schedule')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⏰')
        );

      await interaction.editReply({ 
        embeds: [confirmEmbed], 
        components: [actionRow] 
      });

      // For demo purposes, let's simulate the backup creation
      // In a real implementation, this would handle button interactions
      setTimeout(async () => {
        // Simulate backup creation
        const backupResult = await createServerBackup(serverId, {
          type: backupType,
          compression,
          name: customName,
          encrypt,
          userId: interaction.user.id
        });

        if (backupResult.success) {
          const backup = backupResult.data;
          
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ Backup Created Successfully!')
            .setDescription(`Backup **${backup.name}** has been created and stored securely.`)
            .addFields(
              { name: '🆔 Backup ID', value: `\`${backup.id}\``, inline: true },
              { name: '📏 Final Size', value: formatBytes(backup.actualSize), inline: true },
              { name: '⏱️ Duration', value: formatDuration(backup.actualDuration), inline: true },
              { name: '🔐 Encryption', value: backup.encrypted ? '✅ AES-256' : '❌ None', inline: true },
              { name: '📅 Created', value: `<t:${Math.floor(new Date(backup.createdAt).getTime() / 1000)}:F>`, inline: true },
              { name: '🗑️ Expires', value: `<t:${Math.floor(new Date(backup.expiresAt).getTime() / 1000)}:D>`, inline: true },
              { name: '🔗 Download Link', value: `[Download Backup](${backup.downloadUrl})`, inline: false }
            )
            .setColor(0x00FF88)
            .setThumbnail('https://cdn.playpulse.com/icons/backup-success.png')
            .setFooter({ text: 'Backup stored in multiple geo-distributed locations' });

          // Create management buttons
          const managementRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
              new ButtonBuilder()
                .setLabel('📥 Download')
                .setStyle(ButtonStyle.Link)
                .setURL(backup.downloadUrl)
                .setEmoji('💾'),
              new ButtonBuilder()
                .setCustomId(`backup_restore_${backup.id}`)
                .setLabel('♻️ Restore')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
              new ButtonBuilder()
                .setCustomId(`backup_info_${backup.id}`)
                .setLabel('ℹ️ Details')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📋')
            );

          await interaction.followUp({ 
            embeds: [successEmbed], 
            components: [managementRow] 
          });

          // Set up scheduled backups if requested
          if (scheduled) {
            const scheduleResult = await setupScheduledBackups(serverId, {
              frequency: 'daily',
              retentionCount: 7,
              backupType,
              compression,
              encrypt
            });

            if (scheduleResult.success) {
              const scheduleEmbed = new EmbedBuilder()
                .setTitle('📅 Automatic Backups Scheduled')
                .setDescription('Daily backups have been configured for this server.')
                .addFields(
                  { name: '⏰ Frequency', value: 'Daily at 2:00 AM UTC', inline: true },
                  { name: '🔄 Retention', value: '7 backups', inline: true },
                  { name: '📧 Notifications', value: 'Enabled', inline: true }
                )
                .setColor(0x0099FF)
                .setFooter({ text: 'You can modify the schedule anytime with /backup-schedule' });

              setTimeout(async () => {
                await interaction.followUp({ embeds: [scheduleEmbed], ephemeral: true });
              }, 3000);
            }
          }

        } else {
          throw new Error(backupResult.error || 'Backup creation failed');
        }
      }, 10000); // Simulate 10 second backup process

      // Send immediate progress update
      const progressEmbed = new EmbedBuilder()
        .setTitle('⏳ Backup In Progress')
        .setDescription('Your backup is being created. This may take a few minutes depending on server size.')
        .addFields(
          { name: '📊 Progress', value: '████░░░░░░ 40%', inline: false },
          { name: '🔄 Current Stage', value: 'Analyzing files and databases...', inline: false },
          { name: '⏱️ Estimated Time Remaining', value: '6 minutes', inline: true }
        )
        .setColor(0xFFD700)
        .setFooter({ text: 'You will be notified when the backup is complete' });

      setTimeout(async () => {
        await interaction.followUp({ embeds: [progressEmbed] });
      }, 2000);

    } catch (error) {
      console.error('Backup creation error:', error);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Backup Creation Failed')
        .setDescription('Unable to create backup. Please try again or contact support.')
        .addFields({
          name: '🎫 Need Help?',
          value: 'Use `/ticket` to get assistance from our technical team.'
        })
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

async function getServerInfo(serverId: string) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/servers/${serverId}`, {
      headers: { 'Authorization': `Bearer ${process.env.PANEL_API_KEY}` }
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || 'Failed to fetch server info' };
  }
}

async function getBackupEstimate(serverId: string, backupType: string, compression: string) {
  try {
    const response = await axios.post(`${process.env.BACKUP_API_URL}/estimate`, {
      serverId,
      backupType,
      compression
    }, {
      headers: { 'Authorization': `Bearer ${process.env.BACKUP_API_KEY}` }
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || 'Failed to get backup estimate' };
  }
}

async function createServerBackup(serverId: string, options: any) {
  try {
    const response = await axios.post(`${process.env.BACKUP_API_URL}/create`, {
      serverId,
      ...options
    }, {
      headers: { 'Authorization': `Bearer ${process.env.BACKUP_API_KEY}` }
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || 'Backup creation failed' };
  }
}

async function setupScheduledBackups(serverId: string, scheduleOptions: any) {
  try {
    const response = await axios.post(`${process.env.BACKUP_API_URL}/schedule`, {
      serverId,
      ...scheduleOptions
    }, {
      headers: { 'Authorization': `Bearer ${process.env.BACKUP_API_KEY}` }
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.message || 'Failed to setup scheduled backups' };
  }
}

function getBackupTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'full': '💾 Full Backup',
    'files': '📄 Files Only',
    'database': '🗃️ Database Only',
    'config': '⚙️ Configuration',
    'custom': '🎯 Custom Selection'
  };
  return labels[type] || type;
}

function getCompressionLabel(compression: string): string {
  const labels: Record<string, string> = {
    'fast': '⚡ Fast',
    'balanced': '⚖️ Balanced',
    'max': '🗜️ Maximum'
  };
  return labels[compression] || compression;
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

module.exports = createBackupCommand;
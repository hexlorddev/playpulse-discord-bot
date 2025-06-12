import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import { BotCommand } from '../../types';
import axios from 'axios';

const rebootServerCommand: BotCommand = {
  category: 'hosting',
  cooldown: 30, // 30 second cooldown
  data: new SlashCommandBuilder()
    .setName('reboot-server')
    .setDescription('Reboot your server')
    .addStringOption(option =>
      option.setName('server-id')
        .setDescription('Server ID to reboot')
        .setRequired(true)),

  async execute(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const serverId = interaction.options.getString('server-id', true);

    await interaction.deferReply();

    try {
      // Verify server ownership
      const serverOwnership = await verifyServerOwnership(interaction.user.id, serverId);
      if (!serverOwnership.success) {
        const embed = new EmbedBuilder()
          .setTitle('🚫 Access Denied')
          .setDescription('You don\'t have permission to reboot this server.')
          .setColor(0xFF6B6B)
          .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Reboot server via API
      const rebootResult = await rebootServerViaAPI(serverId);
      
      if (rebootResult.success) {
        const embed = new EmbedBuilder()
          .setTitle('🔄 Server Rebooting')
          .setDescription(`Server \`${serverId}\` is being rebooted...`)
          .addFields(
            { name: '⏱️ Estimated Time', value: '30-60 seconds', inline: true },
            { name: '📊 Status', value: '🟡 Rebooting', inline: true }
          )
          .setColor(0xFFA500)
          .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Send follow-up status after 30 seconds
        setTimeout(async () => {
          try {
            const status = await getServerStatus(serverId);
            const statusEmbed = new EmbedBuilder()
              .setTitle('✅ Reboot Complete')
              .setDescription(`Server \`${serverId}\` has been rebooted successfully.`)
              .addFields({ name: '📊 Current Status', value: status.online ? '🟢 Online' : '🔴 Offline' })
              .setColor(status.online ? 0x00FF00 : 0xFF6B6B)
              .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

            await interaction.followUp({ embeds: [statusEmbed] });
          } catch (error) {
            console.error('Status check error:', error);
          }
        }, 30000);

      } else {
        throw new Error(rebootResult.error || 'Reboot failed');
      }

    } catch (error) {
      console.error('Reboot error:', error);

      const embed = new EmbedBuilder()
        .setTitle('❌ Reboot Failed')
        .setDescription('Failed to reboot the server. Please try again or contact support.')
        .setColor(0xFF6B6B)
        .setFooter({ text: 'Powered by hexlorddev • Playpulse Ultimate' });

      await interaction.editReply({ embeds: [embed] });
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

async function rebootServerViaAPI(serverId: string) {
  try {
    const response = await axios.post(`${process.env.PANEL_API_URL}/servers/${serverId}/reboot`, {}, {
      headers: {
        'Authorization': `Bearer ${process.env.PANEL_API_KEY}`
      }
    });

    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || 'Reboot request failed'
    };
  }
}

async function getServerStatus(serverId: string) {
  try {
    const response = await axios.get(`${process.env.PANEL_API_URL}/servers/${serverId}/status`, {
      headers: {
        'Authorization': `Bearer ${process.env.PANEL_API_KEY}`
      }
    });

    return response.data;
  } catch (error) {
    return { online: false, status: 'unknown' };
  }
}

module.exports = rebootServerCommand;
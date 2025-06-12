"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ticketCommand = {
    category: 'ticket',
    data: new discord_js_1.SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a support ticket')
        .addStringOption(option => option.setName('category')
        .setDescription('Ticket category')
        .setRequired(true)
        .addChoices({ name: '🛠️ Technical Support', value: 'support' }, { name: '🚀 Upgrade Request', value: 'upgrade' }, { name: '🔐 Security Issue', value: 'security' }, { name: '💰 Billing Question', value: 'billing' }))
        .addStringOption(option => option.setName('priority')
        .setDescription('Ticket priority')
        .setRequired(false)
        .addChoices({ name: '🟢 Low', value: 'low' }, { name: '🟡 Medium', value: 'medium' }, { name: '🔴 High', value: 'high' }, { name: '🚨 Critical', value: 'critical' }))
        .addStringOption(option => option.setName('description')
        .setDescription('Brief description of your issue')
        .setRequired(false)),
    async execute(interaction) {
        if (!interaction.isChatInputCommand() || !interaction.guild)
            return;
        const category = interaction.options.getString('category', true);
        const priority = interaction.options.getString('priority') || 'medium';
        const description = interaction.options.getString('description') || 'No description provided';
        await interaction.deferReply({ ephemeral: true });
        try {
            // Check if user already has an open ticket
            const existingTicket = await checkExistingTicket(interaction.user.id, interaction.guild.id);
            if (existingTicket) {
                const embed = new discord_js_1.EmbedBuilder()
                    .setTitle('🎫 Existing Ticket Found')
                    .setDescription(`You already have an open ticket: <#${existingTicket.channelId}>`)
                    .setColor(0xFFA500)
                    .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
                await interaction.editReply({ embeds: [embed] });
                return;
            }
            // Create ticket channel
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}-${Date.now().toString().slice(-4)}`,
                type: discord_js_1.ChannelType.GuildText,
                parent: await getTicketCategory(interaction.guild, category),
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [discord_js_1.PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            discord_js_1.PermissionFlagsBits.ViewChannel,
                            discord_js_1.PermissionFlagsBits.SendMessages,
                            discord_js_1.PermissionFlagsBits.ReadMessageHistory
                        ]
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [
                            discord_js_1.PermissionFlagsBits.ViewChannel,
                            discord_js_1.PermissionFlagsBits.SendMessages,
                            discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                            discord_js_1.PermissionFlagsBits.ManageMessages
                        ]
                    }
                ]
            });
            // Add support staff permissions
            const supportRoleId = getSupportRoleId(category);
            if (supportRoleId) {
                await ticketChannel.permissionOverwrites.create(supportRoleId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    ManageMessages: true
                });
            }
            // Create ticket in database
            const ticketId = await createTicketInDatabase({
                userId: interaction.user.id,
                guildId: interaction.guild.id,
                channelId: ticketChannel.id,
                category,
                priority,
                description
            });
            // Create ticket embed
            const ticketEmbed = new discord_js_1.EmbedBuilder()
                .setTitle(`🎫 Support Ticket #${ticketId.slice(-4)}`)
                .setDescription('Thank you for creating a support ticket! Our team will be with you shortly.')
                .addFields({ name: '👤 User', value: `<@${interaction.user.id}>`, inline: true }, { name: '📂 Category', value: getCategoryDisplayName(category), inline: true }, { name: '⚡ Priority', value: getPriorityDisplayName(priority), inline: true }, { name: '📝 Description', value: description, inline: false }, { name: '📅 Created', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true })
                .setColor(getCategoryColor(category))
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' })
                .setTimestamp();
            // Create action buttons
            const actionRow = new discord_js_1.ActionRowBuilder()
                .addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_close_${ticketId}`)
                .setLabel('Close Ticket')
                .setStyle(discord_js_1.ButtonStyle.Danger)
                .setEmoji('🔒'), new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_priority_${ticketId}`)
                .setLabel('Change Priority')
                .setStyle(discord_js_1.ButtonStyle.Secondary)
                .setEmoji('⚡'), new discord_js_1.ButtonBuilder()
                .setCustomId(`ticket_assign_${ticketId}`)
                .setLabel('Assign Staff')
                .setStyle(discord_js_1.ButtonStyle.Primary)
                .setEmoji('👤'));
            // Send ticket message
            await ticketChannel.send({
                content: `<@${interaction.user.id}> ${supportRoleId ? `<@&${supportRoleId}>` : ''}`,
                embeds: [ticketEmbed],
                components: [actionRow]
            });
            // Send helpful information
            const infoEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('📖 Ticket Information')
                .setDescription('Here are some helpful tips for your support ticket:')
                .addFields({ name: '📸 Screenshots', value: 'Please share screenshots of any errors you\'re experiencing' }, { name: '🆔 Server Details', value: 'Include your server ID if this is related to a specific server' }, { name: '⏰ Response Time', value: getPriorityResponseTime(priority) }, { name: '❓ Need Help?', value: 'Type your questions and our support team will assist you!' })
                .setColor(0x0099FF)
                .setFooter({ text: 'We\'re here to help! 💙' });
            await ticketChannel.send({ embeds: [infoEmbed] });
            // Confirm ticket creation to user
            const confirmEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('✅ Ticket Created Successfully!')
                .setDescription(`Your support ticket has been created: ${ticketChannel}`)
                .addFields({
                name: '🎫 Ticket ID',
                value: `#${ticketId.slice(-4)}`,
                inline: true
            })
                .setColor(0x00FF00)
                .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
            await interaction.editReply({ embeds: [confirmEmbed] });
            // Log ticket creation for analytics
            console.log(`Ticket created: ${ticketId} by ${interaction.user.tag} (${interaction.user.id})`);
        }
        catch (error) {
            console.error('Ticket creation error:', error);
            const errorEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('❌ Ticket Creation Failed')
                .setDescription('Failed to create support ticket. Please contact an administrator.')
                .setColor(0xFF6B6B)
                .setFooter({ text: 'Powered by Dineth Nethsara • Playpulse Hosting' });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
// Helper functions
async function checkExistingTicket(userId, guildId) {
    // This would check the database for existing open tickets
    // For now, return null (no existing ticket)
    return null;
}
async function getTicketCategory(guild, category) {
    // This would get or create the appropriate category channel
    // For now, return null (creates in main channel list)
    return null;
}
function getSupportRoleId(category) {
    const supportRoles = {
        'support': process.env.SUPPORT_ROLE_ID,
        'upgrade': process.env.SALES_ROLE_ID,
        'security': process.env.SECURITY_ROLE_ID,
        'billing': process.env.BILLING_ROLE_ID
    };
    return supportRoles[category] || process.env.SUPPORT_ROLE_ID || null;
}
async function createTicketInDatabase(ticketData) {
    // Generate ticket ID
    const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // This would save to database
    // For now, just return the generated ID
    return ticketId;
}
function getCategoryDisplayName(category) {
    const categories = {
        'support': '🛠️ Technical Support',
        'upgrade': '🚀 Upgrade Request',
        'security': '🔐 Security Issue',
        'billing': '💰 Billing Question'
    };
    return categories[category] || category;
}
function getPriorityDisplayName(priority) {
    const priorities = {
        'low': '🟢 Low',
        'medium': '🟡 Medium',
        'high': '🔴 High',
        'critical': '🚨 Critical'
    };
    return priorities[priority] || priority;
}
function getCategoryColor(category) {
    const colors = {
        'support': 0x0099FF,
        'upgrade': 0x00FF00,
        'security': 0xFF0000,
        'billing': 0xFFD700
    };
    return colors[category] || 0x0099FF;
}
function getPriorityResponseTime(priority) {
    const times = {
        'low': '⏰ 24-48 hours',
        'medium': '⏰ 12-24 hours',
        'high': '⏰ 2-6 hours',
        'critical': '⏰ 15-30 minutes'
    };
    return times[priority] || '⏰ 12-24 hours';
}
module.exports = ticketCommand;
//# sourceMappingURL=ticket.js.map